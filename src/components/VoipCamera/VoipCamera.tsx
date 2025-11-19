import { Box, Chip, CircularProgress, IconButton } from '@mui/material';
import { useRef, useEffect, useState } from 'react';
import PhoneIcon from '@mui/icons-material/Phone';
import CallEndIcon from '@mui/icons-material/CallEnd';
import { useVoipCamera } from '../../contexts/useVoipCamera';

interface VoipCameraProps extends React.CanvasHTMLAttributes<HTMLCanvasElement> {
    wsUrl?: string;
    onClick?: () => void;
    isIncomingCall?: boolean;
    isInCall?: boolean;
    isOutgoingCall?: boolean;
    onReject?: () => void;
    onHangup?: () => void;
    hasVoip?: boolean; // Indica se a câmera tem funcionalidade VoIP
}

interface PlayerWithDestroy {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    player: any;
    destroy: () => void;
}

export const VoipCamera = ({ wsUrl, onClick, isIncomingCall = false, isInCall = false, isOutgoingCall = false, onReject, onHangup, hasVoip = true, ...rest }: VoipCameraProps) => {
    const { setIsVoipCameraLoading } = useVoipCamera();

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const boxRef = useRef<HTMLDivElement | null>(null);
    const playerLoadedRef = useRef(false);
    const destroyFnRef = useRef<(() => void) | null>(null);
    const [isHovering, setIsHovering] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const retryTimeoutRef = useRef<number | null>(null);
    const loadSuccessRef = useRef(false);
    const MAX_RETRIES = 3;


    // Força o redimensionamento do canvas
    const forceCanvasResize = () => {
        if (!canvasRef.current || !boxRef.current || !playerLoadedRef.current) return;

        const { clientWidth, clientHeight } = boxRef.current;

        // Força via style inline para sobrescrever qualquer estilo aplicado pelo script
        canvasRef.current.style.width = `${clientWidth}px`;
        canvasRef.current.style.height = `${clientHeight}px`;
    };

    // Monitora mudanças de tamanho do container pai
    useEffect(() => {
        const resizeObserver = new ResizeObserver(() => {
            forceCanvasResize();
        });

        if (boxRef.current) {
            resizeObserver.observe(boxRef.current);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    useEffect(() => {

        console.log(`Carregando VoipCamera com URL: ${wsUrl}`);

        if (!wsUrl) {
            console.warn("URL WebSocket não fornecida para VoipCamera.");

            // Limpa o player se não houver URL
            if (destroyFnRef.current) {
                destroyFnRef.current();
                destroyFnRef.current = null;
            }
            return;
        }

        let destroyed = false;

        const handleLoadError = () => {
            if (destroyed) return;

            if (retryCount < MAX_RETRIES) {
                const nextRetry = retryCount + 1;
                console.log(`[VoIP ${wsUrl}] Tentando reconectar (${nextRetry}/${MAX_RETRIES})...`);
                setRetryCount(nextRetry);

                // Aguarda 2s antes de tentar novamente
                retryTimeoutRef.current = window.setTimeout(() => {
                    if (!destroyed) {
                        initPlayer();
                    }
                }, 2000);
            } else {
                console.error(`[VoIP ${wsUrl}] Falha após ${MAX_RETRIES} tentativas`);
                setIsLoading(false);
            }
        };

        const initPlayer = async () => {
            setIsLoading(true);
            loadSuccessRef.current = false;
            let init = true;

            // Limpa player anterior se existir
            if (destroyFnRef.current) {
                console.log("Destruindo player anterior...");
                try {
                    destroyFnRef.current();
                } catch (e) {
                    console.warn("Erro ao destruir player:", e);
                }
                destroyFnRef.current = null;
                playerLoadedRef.current = false;
            }

            // Aguarda um pouco após destruir o player anterior
            await new Promise(resolve => setTimeout(resolve, 50));

            if (destroyed) return;

            // Recria o canvas para garantir contexto WebGL limpo
            const oldCanvas = canvasRef.current;
            if (oldCanvas && oldCanvas.parentNode) {
                const newCanvas = document.createElement('canvas');
                // Copia todos os estilos
                newCanvas.style.cssText = oldCanvas.style.cssText;
                oldCanvas.parentNode.replaceChild(newCanvas, oldCanvas);
                canvasRef.current = newCanvas;
                console.log("Canvas recriado com sucesso");
            }

            // Mais um pequeno delay após recriar o canvas
            await new Promise(resolve => setTimeout(resolve, 50));

            if (destroyed) return;

            const canvas = canvasRef.current;

            if (!canvas) {
                console.error("Canvas não encontrado");
                setIsLoading(false);
                return;
            }
            if (!window.loadPlayer) {
                console.error("loadPlayer não encontrado no window");
                setIsLoading(false);
                return;
            }

            console.log(`[VoIP ${wsUrl}] Iniciando player (tentativa ${retryCount + 1}/${MAX_RETRIES})...`);

            try {
                const result = await window.loadPlayer({
                    url: wsUrl,
                    canvas: canvas,
                    onSourceEstablished: () => {
                        console.log(`[VoIP ${wsUrl}] Conexão estabelecida`);
                        loadSuccessRef.current = true;
                        setRetryCount(0);
                    },
                    onVideoDecode: () => {
                        // Remove loading quando o primeiro frame é decodificado
                        if (!destroyed) {
                            if (init) {
                                console.log(`[VoIP ${wsUrl}] Vídeo carregado com sucesso`);
                                setIsLoading(false);
                                loadSuccessRef.current = true;
                                setRetryCount(0);
                                init = false;
                            }
                        }
                    }
                }) as unknown as PlayerWithDestroy;

                if (!destroyed && result && result.destroy) {
                    destroyFnRef.current = result.destroy;
                    playerLoadedRef.current = true;
                    console.log("Player carregado com sucesso");
                    setIsVoipCameraLoading(false);
                }

                // Timeout de segurança
                retryTimeoutRef.current = window.setTimeout(() => {
                    if (!loadSuccessRef.current && !destroyed) {
                        console.warn(`[VoIP ${wsUrl}] Timeout - nenhum frame recebido em 10s`);
                        handleLoadError();
                    }
                }, 10000);
            } catch (error) {
                console.error(`[VoIP ${wsUrl}] Erro ao carregar player:`, error);
                handleLoadError();
                setIsLoading(false);
            }
        };

        // Verifica se o script já existe
        const existingScript = document.querySelector('script[src="rtsp-relay.js"]');

        if (existingScript && window.loadPlayer) {
            // Script já carregado, executa direto
            console.log("Script já carregado, iniciando player...");
            initPlayer();
        } else if (!existingScript) {
            // Script não existe, cria novo
            const script = document.createElement("script");
            script.src = "rtsp-relay.js";
            script.async = true;
            script.onload = () => {
                console.log("Script carregado, iniciando player...");
                initPlayer();
            };
            document.body.appendChild(script);
        } else {
            // Script existe mas loadPlayer ainda não está pronto, aguarda
            const checkInterval = setInterval(() => {
                if (window.loadPlayer) {
                    clearInterval(checkInterval);
                    console.log("loadPlayer disponível, iniciando player...");
                    initPlayer();
                }
            }, 100);

            return () => {
                clearInterval(checkInterval);
            };
        }

        return () => {
            destroyed = true;

            // Limpa timeout de retry
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
                retryTimeoutRef.current = null;
            }

            // Chama a função destroy se disponível
            if (destroyFnRef.current) {
                console.log("Destruindo player no cleanup...");
                try {
                    destroyFnRef.current();
                } catch (e) {
                    console.warn("Erro ao destruir player no cleanup:", e);
                }
                destroyFnRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wsUrl, retryCount, MAX_RETRIES]);

    return (
        <Box
            ref={boxRef}
            display='flex'
            width="100%"
            height="100%"
            sx={{
                overflow: 'hidden',
                minWidth: 0,
                minHeight: 0,
                position: 'relative',
                cursor: hasVoip ? 'pointer' : 'default',
                outline: isInCall
                    ? '3px solid #f44336'
                    : (isHovering && !isIncomingCall && !isOutgoingCall && hasVoip ? '3px solid #4CAF50' : 'none'),
                outlineOffset: '-3px',
                transition: 'outline 0.1s ease',
                animation: (isOutgoingCall || isIncomingCall) ? 'blink-border 1s infinite' : 'none',
                '@keyframes blink-border': {
                    '0%': { outline: '3px solid rgba(244, 67, 54, 0.3)', outlineOffset: '-3px' },
                    '50%': { outline: '3px solid rgba(244, 67, 54, 1)', outlineOffset: '-3px' },
                    '100%': { outline: '3px solid rgba(244, 67, 54, 0.3)', outlineOffset: '-3px' },
                },
                '& canvas': {
                    maxWidth: '100% !important',
                    maxHeight: '100% !important',
                    objectFit: 'fill !important'
                }
            }}
            onMouseEnter={() => hasVoip && !isInCall && !isIncomingCall && !isOutgoingCall && setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            onClick={() => {
                if (!hasVoip) return; // Sem VoIP, não faz nada

                // isIncomingCall: clica no canvas, atende a chamada
                if (isIncomingCall) {
                    if (onClick) onClick();
                }
                // isOutgoingCall ou isInCall: clica no canvas, encerra a chamada
                else if (isOutgoingCall || isInCall) {
                    if (onHangup) onHangup();
                }
                // Sem chamada: clica no canvas, inicia uma chamada
                else {
                    if (onClick) onClick();
                }
            }}
        >
            <canvas
                ref={canvasRef}
                style={{
                    width: "100%",
                    height: "100%",
                    maxWidth: "100%",
                    maxHeight: "100%",
                    background: "black",
                    objectFit: "fill",
                    display: "block",
                    ...rest.style
                }}
                {...rest}
            />

            {isLoading && (
                <Box
                    sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        zIndex: 5
                    }}
                >
                    <CircularProgress size={60} sx={{ color: 'white' }} />
                </Box>
            )}

            {/* Botões de controle */}
            {hasVoip && isIncomingCall ? (
                // Chamada recebida - mostra botões Recusar e Atender
                <Box sx={{
                    position: 'absolute',
                    bottom: 20,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    gap: 3,
                    zIndex: 10
                }}>
                    <Chip
                        icon={<CallEndIcon />}
                        label="RECUSAR"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onReject) onReject();
                        }}
                        sx={{
                            width: '180px',
                            height: '56px',
                            backgroundColor: '#d32f2f',
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '1.2rem',
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                            '&:hover': {
                                backgroundColor: '#b71c1c'
                            },
                            '& .MuiChip-icon': {
                                color: 'white',
                                fontSize: '1.6rem'
                            },
                            '& .MuiChip-label': {
                                fontSize: '1.2rem',
                                fontWeight: 'bold'
                            }
                        }}
                    />
                    <Chip
                        icon={<PhoneIcon />}
                        label="ATENDER"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onClick) onClick();
                        }}
                        sx={{
                            width: '180px',
                            height: '56px',
                            backgroundColor: '#43a047',
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '1.2rem',
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                            '&:hover': {
                                backgroundColor: '#2e7d32'
                            },
                            '& .MuiChip-icon': {
                                color: 'white',
                                fontSize: '1.6rem'
                            },
                            '& .MuiChip-label': {
                                fontSize: '1.2rem',
                                fontWeight: 'bold'
                            }
                        }}
                    />
                </Box>
            ) : hasVoip && (isInCall || isOutgoingCall) ? (
                // Em chamada ativa ou chamada sainte - botão ENCERRAR circular vermelho
                <IconButton
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onHangup) onHangup();
                    }}
                    sx={{
                        position: 'absolute',
                        bottom: 16,
                        right: 16,
                        width: '64px',
                        height: '64px',
                        backgroundColor: '#d32f2f',
                        color: 'white',
                        zIndex: 10,
                        '&:hover': {
                            backgroundColor: '#b71c1c',
                        },
                        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)'
                    }}
                >
                    <CallEndIcon sx={{ fontSize: '2rem' }} />
                </IconButton>
            ) : hasVoip ? (
                // Comportamento normal - botão circular Ligar/Desligar
                <IconButton
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onClick) {
                            onClick();
                        }
                    }}
                    sx={{
                        position: 'absolute',
                        bottom: 16,
                        right: 16,
                        width: '64px',
                        height: '64px',
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        zIndex: 10,
                        '&:hover': {
                            backgroundColor: '#388e3c',
                        },
                        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)'
                    }}
                >
                    <PhoneIcon sx={{ fontSize: '2rem' }} />
                </IconButton>
            ) : null}
        </Box>
    );
};


