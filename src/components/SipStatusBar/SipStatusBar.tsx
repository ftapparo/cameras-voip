import { Box, IconButton, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from '@mui/material';
import { useState, useEffect } from 'react';
import SettingsIcon from '@mui/icons-material/Settings';
import PhoneIcon from '@mui/icons-material/Phone';
import PhoneDisabledIcon from '@mui/icons-material/PhoneDisabled';
import DownloadIcon from '@mui/icons-material/Download';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface SipConfig {
    websocket: string;
    uri: string;
    password: string;
    extension: string;
}

interface SipStatusBarProps {
    isConnected: boolean;
    isRegistered: boolean;
    extension?: string;
    onConfigSave: (config: SipConfig) => void;
}

const SIP_CONFIG_KEY = 'sip_config';

export const SipStatusBar = ({ isConnected, isRegistered, extension, onConfigSave }: SipStatusBarProps) => {
    const [configOpen, setConfigOpen] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showInstallButton, setShowInstallButton] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Carrega configuração do localStorage
    const loadSavedConfig = (): SipConfig => {
        try {
            const saved = localStorage.getItem(SIP_CONFIG_KEY);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            console.error('Erro ao carregar configuração SIP:', error);
        }
        // Valores padrão
        return {
            websocket: 'ws://192.168.0.251:8088/ws',
            uri: 'sip:101@192.168.0.251',
            password: '',
            extension: '101'
        };
    };

    const [formData, setFormData] = useState<SipConfig>(loadSavedConfig());

    // Carrega e conecta automaticamente se houver config salva
    useEffect(() => {
        const savedConfig = loadSavedConfig();
        if (savedConfig.password) { // Só conecta se tiver senha salva
            console.log('Conectando automaticamente com configuração salva...');
            onConfigSave(savedConfig);
        }
    }, [onConfigSave]);

    // Gerenciar PWA install prompt
    useEffect(() => {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        if (isStandalone) {
            return;
        }

        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            const promptEvent = e as BeforeInstallPromptEvent;
            setDeferredPrompt(promptEvent);
            setShowInstallButton(true);
        };

        const handleAppInstalled = () => {
            setShowInstallButton(false);
            setDeferredPrompt(null);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const handleSave = () => {
        // Salva no localStorage
        localStorage.setItem(SIP_CONFIG_KEY, JSON.stringify(formData));
        console.log('Configuração SIP salva no localStorage');
        onConfigSave(formData);
        setConfigOpen(false);
    };

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        try {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`App install ${outcome}`);
            setDeferredPrompt(null);
            setShowInstallButton(false);
        } catch (error) {
            console.error('Erro ao instalar:', error);
        }
    };

    const getStatusColor = () => {
        if (isRegistered) return '#4CAF50'; // Verde - registrado
        if (isConnected) return '#FF9800'; // Laranja - conectado mas não registrado
        return '#f44336'; // Vermelho - desconectado
    };

    const getStatusText = () => {
        if (isRegistered && extension) return `Ramal ${extension}`;
        if (isRegistered) return 'Registrado';
        if (isConnected) return 'Conectando...';
        return 'Desconectado';
    };

    const handleOpenDevTools = () => {
        const electron = (window as unknown as { electron?: { ipcRenderer?: { send: (channel: string) => void } } }).electron;
        if (electron?.ipcRenderer?.send) {
            electron.ipcRenderer.send('toggle-devtools');
        } else {
            console.log('Abrindo DevTools via Ctrl+Shift+I');
            // Fallback para browsers
            const devToolsKey = new KeyboardEvent('keydown', {
                key: 'I',
                code: 'KeyI',
                ctrlKey: true,
                shiftKey: true
            });
            document.dispatchEvent(devToolsKey);
        }
    };

    const handleToggleFullscreen = async () => {
        try {
            if (!isFullscreen) {
                // Entrar em fullscreen
                await document.documentElement.requestFullscreen();
                setIsFullscreen(true);
            } else {
                // Sair de fullscreen
                if (document.fullscreenElement) {
                    await document.exitFullscreen();
                }
                setIsFullscreen(false);
            }
        } catch (error) {
            console.error('Erro ao alternar fullscreen:', error);
        }
    };

    // Monitora mudanças de fullscreen
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, []);

    return (
        <>
            <Box
                sx={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '50px',
                    backgroundColor: '#1a1a1a',
                    borderTop: '1px solid #333',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 2,
                    zIndex: 1000
                }}
            >
                {/* Status */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Chip
                        icon={isRegistered ? <PhoneIcon /> : <PhoneDisabledIcon />}
                        label={getStatusText()}
                        sx={{
                            backgroundColor: getStatusColor(),
                            color: 'white',
                            fontWeight: 'bold',
                            '& .MuiChip-icon': {
                                color: 'white'
                            }
                        }}
                    />
                </Box>

                {/* Botão de Instalação (centro) */}
                {showInstallButton && (
                    <Button
                        startIcon={<DownloadIcon />}
                        onClick={handleInstallClick}
                        sx={{
                            color: 'white',
                            textTransform: 'none',
                            fontSize: '0.9rem',
                            '&:hover': {
                                backgroundColor: 'rgba(255, 255, 255, 0.1)'
                            }
                        }}
                    >
                        Clique para instalar
                    </Button>
                )}

                {/* Fullscreen */}
                <IconButton
                    onClick={handleToggleFullscreen}
                    title={isFullscreen ? 'Sair de tela cheia' : 'Entrar em tela cheia'}
                    sx={{
                        color: 'white',
                        '&:hover': {
                            backgroundColor: 'rgba(255, 255, 255, 0.1)'
                        }
                    }}
                >
                    {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                </IconButton>

                {/* Configurações */}
                <IconButton
                    onClick={() => setConfigOpen(true)}
                    sx={{
                        color: 'white',
                        '&:hover': {
                            backgroundColor: 'rgba(255, 255, 255, 0.1)'
                        }
                    }}
                >
                    <SettingsIcon />
                </IconButton>

                {/* DevTools */}
                <IconButton
                    onClick={handleOpenDevTools}
                    title="Abrir DevTools"
                    sx={{
                        color: 'white',
                        '&:hover': {
                            backgroundColor: 'rgba(255, 255, 255, 0.1)'
                        }
                    }}
                >
                    <MoreVertIcon />
                </IconButton>
            </Box>

            {/* Dialog de Configuração */}
            <Dialog
                open={configOpen}
                onClose={() => setConfigOpen(false)}
                maxWidth="sm"
                fullWidth
                disableRestoreFocus
                keepMounted={false}
            >
                <DialogTitle>Configuração SIP</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                        <TextField
                            label="WebSocket URL"
                            value={formData.websocket}
                            onChange={(e) => setFormData({ ...formData, websocket: e.target.value })}
                            fullWidth
                            placeholder="ws://192.168.0.251:8088/ws"
                        />
                        <TextField
                            label="SIP URI"
                            value={formData.uri}
                            onChange={(e) => setFormData({ ...formData, uri: e.target.value })}
                            fullWidth
                            placeholder="sip:101@192.168.0.251"
                        />
                        <TextField
                            label="Ramal"
                            value={formData.extension}
                            onChange={(e) => setFormData({ ...formData, extension: e.target.value })}
                            fullWidth
                            placeholder="101"
                        />
                        <TextField
                            label="Senha"
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            fullWidth
                            placeholder="********"
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => {
                            localStorage.removeItem(SIP_CONFIG_KEY);
                            setFormData({
                                websocket: 'ws://192.168.0.251:8088/ws',
                                uri: 'sip:101@192.168.0.251',
                                password: '',
                                extension: '101'
                            });
                            console.log('Configuração SIP limpa');
                        }}
                        color="error"
                    >
                        Limpar
                    </Button>
                    <Box sx={{ flex: 1 }} />
                    <Button onClick={() => setConfigOpen(false)}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSave}
                        variant="contained"
                        color="primary"
                    >
                        Salvar e Conectar
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};
