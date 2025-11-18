import { useEffect, useState } from 'react';
import { Download } from '@mui/icons-material';
import { Button, Box, Snackbar, Alert } from '@mui/material';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPWA() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showInstallPrompt, setShowInstallPrompt] = useState(false);
    const [installSuccess, setInstallSuccess] = useState(false);

    useEffect(() => {
        // Detectar se já está instalado
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        if (isStandalone) {
            return;
        }

        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            const promptEvent = e as BeforeInstallPromptEvent;
            setDeferredPrompt(promptEvent);
            setShowInstallPrompt(true);
        };

        const handleAppInstalled = () => {
            console.log('PWA instalada com sucesso!');
            setInstallSuccess(true);
            setShowInstallPrompt(false);
            setDeferredPrompt(null);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        try {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;

            if (outcome === 'accepted') {
                console.log('Usuário aceitou a instalação');
            } else {
                console.log('Usuário recusou a instalação');
            }

            setDeferredPrompt(null);
            setShowInstallPrompt(false);
        } catch (error) {
            console.error('Erro ao instalar:', error);
        }
    };

    // Não mostrar se não há prompt disponível
    if (!showInstallPrompt) {
        return null;
    }

    return (
        <>
            <Box sx={{ p: 1 }}>
                <Button
                    variant="contained"
                    startIcon={<Download />}
                    onClick={handleInstallClick}
                    fullWidth
                    sx={{
                        backgroundColor: '#1976d2',
                        '&:hover': {
                            backgroundColor: '#1565c0',
                        }
                    }}
                >
                    📲 Instalar no Desktop
                </Button>
            </Box>

            <Snackbar
                open={installSuccess}
                autoHideDuration={6000}
                onClose={() => setInstallSuccess(false)}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert severity="success" sx={{ width: '100%' }}>
                    ✅ Aplicação instalada com sucesso! Verifique seu Desktop.
                </Alert>
            </Snackbar>
        </>
    );
}

export default InstallPWA;
