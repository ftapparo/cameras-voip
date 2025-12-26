import { Box, Chip, CircularProgress, IconButton } from '@mui/material';
import { useRef, useEffect, useState, memo } from 'react';
import PhoneIcon from '@mui/icons-material/Phone';
import CallEndIcon from '@mui/icons-material/CallEnd';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import RefreshIcon from '@mui/icons-material/Refresh';

interface WebSocketVoipProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    cameraId?: string;
    onClick?: () => void;
    isIncomingCall?: boolean;
    isInCall?: boolean;
    isOutgoingCall?: boolean;
    callConfirmed?: boolean; // Indica se a chamada foi confirmada/estabelecida
    onReject?: () => void;
    onHangup?: () => void;
    hasVoip?: boolean; // Indica se a câmera tem funcionalidade VoIP
    onLoadingComplete?: () => void; // Callback quando o carregamento termina
}

export const WebSocketVoip = memo<WebSocketVoipProps>(({ 
    cameraId, 
    onClick, 
    isIncomingCall = false, 
    isInCall = false, 
    isOutgoingCall = false, 
    onReject, 
    onHangup, 
    hasVoip = true, 
    onLoadingComplete, 
    ...rest 
}) => {
    const imgRef = useRef<HTMLImageElement | null>(null);
    const boxRef = useRef<HTMLDivElement | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<number | null>(null);
    
    const [isHovering, setIsHovering] = useState(false);
    const [isHoveringCenter, setIsHoveringCenter] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    
    // Estado para controle de retry
    const [retryState, setRetryState] = useState({ 
        isRetrying: false, 
        lastError: null as string | null 
    });

    // Resetar fullscreen quando chamada encerrar
    useEffect(() => {
        if (!isInCall && !isIncomingCall && !isOutgoingCall) {
            setTimeout(() => setIsFullscreen(false), 0);
        }
    }, [isInCall, isIncomingCall, isOutgoingCall]);

    // State derivado: loading quando há ID mas vídeo não carregou
    const isLoading = Boolean(cameraId && !isLoaded);

    // WebSocket connection effect
    useEffect(() => {
        if (!cameraId) {
            // Limpa conexão se não houver cameraId
            if (wsRef.current) {
                console.log(`[WebSocketVoip] Fechando WebSocket - sem cameraId`);
                wsRef.current.close();
                wsRef.current = null;
            }
            return;
        }

        // Reset estados quando cameraId mudar
        let isCurrentCamera = true;

        const connectWebSocket = () => {
            try {
                if (isCurrentCamera) {
                    setRetryState({ isRetrying: true, lastError: null });
                    console.log(`[WebSocketVoip] Conectando câmera ${cameraId}`);
                }

                const wsUrl = `ws://localhost:3001/?camera=${cameraId}`;
                const ws = new WebSocket(wsUrl);
                wsRef.current = ws;

                ws.onopen = () => {
                    if (isCurrentCamera) {
                        console.log(`[WebSocketVoip] Conexão WebSocket aberta para câmera ${cameraId}`);
                        setRetryState({ isRetrying: false, lastError: null });
                    }
                };

                ws.onclose = () => {
                    console.log(`[WebSocketVoip] Conexão WebSocket fechada para câmera ${cameraId}`);
                    if (isCurrentCamera) {
                        setIsLoaded(false);
                        setRetryState({ isRetrying: true, lastError: 'Conexão perdida' });
                        
                        // Reconecta apenas se o componente ainda estiver montado
                        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000) as unknown as number;
                    }
                };

                ws.onerror = (event) => {
                    console.error(`[WebSocketVoip] Erro WebSocket na câmera ${cameraId}:`, event);
                    if (isCurrentCamera) {
                        setRetryState({ isRetrying: true, lastError: 'Erro de conexão' });
                    }
                };

                ws.onmessage = async (event) => {
                    try {
                        if (typeof event.data === 'string') {
                            const message = JSON.parse(event.data);
                            
                            if (message.type === 'connected') {
                                console.log(`[WebSocketVoip] Stream iniciado para câmera ${cameraId}`);
                                if (isCurrentCamera) {
                                    setRetryState({ isRetrying: false, lastError: null });
                                }
                            } else if (message.type === 'error') {
                                console.error(`[WebSocketVoip] Erro do servidor:`, message.message);
                                if (isCurrentCamera) {
                                    setRetryState({ isRetrying: true, lastError: message.message });
                                }
                            }
                        } 
                        else if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
                            let blob: Blob;
                            if (event.data instanceof ArrayBuffer) {
                                blob = new Blob([event.data], { type: 'image/jpeg' });
                            } else {
                                blob = event.data;
                            }
                            
                            const imageUrl = URL.createObjectURL(blob);
                            
                            if (imgRef.current && isCurrentCamera) {
                                if (imgRef.current.src.startsWith('blob:')) {
                                    URL.revokeObjectURL(imgRef.current.src);
                                }
                                
                                imgRef.current.src = imageUrl;
                                
                                // Marca como carregado na primeira imagem
                                if (!isLoaded) {
                                    setIsLoaded(true);
                                    setRetryState({ isRetrying: false, lastError: null });
                                    onLoadingComplete?.();
                                }
                            }
                        }
                    } catch (error) {
                        console.error(`[WebSocketVoip] Erro ao processar mensagem:`, error);
                        if (isCurrentCamera) {
                            setRetryState({ isRetrying: true, lastError: 'Erro de processamento' });
                        }
                    }
                };

            } catch (error) {
                console.error(`[WebSocketVoip] Erro ao criar WebSocket:`, error);
                if (isCurrentCamera) {
                    setRetryState({ isRetrying: true, lastError: 'Falha na conexão' });
                }
            }
        };

        connectWebSocket();

        return () => {
            isCurrentCamera = false;
            
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
            
            if (wsRef.current) {
                console.log(`[WebSocketVoip] Fechando WebSocket para câmera ${cameraId}`);
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [cameraId, onLoadingComplete, isLoaded]);

    const handleImageLoad = () => {
        setRetryState({ isRetrying: false, lastError: null });
    };

    const handleImageError = () => {
        setRetryState({ isRetrying: true, lastError: 'Erro de carregamento' });
        onLoadingComplete?.();
    };

    const handleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
    };

    return (
        <Box
            ref={boxRef}
            display='flex'
            width={isFullscreen ? "100vw" : "100%"}
            height={isFullscreen ? "100vh" : "100%"}
            sx={{
                overflow: 'hidden',
                minWidth: 0,
                minHeight: 0,
                position: isFullscreen ? 'fixed' : 'relative',
                top: isFullscreen ? 0 : 'auto',
                left: isFullscreen ? 0 : 'auto',
                zIndex: isFullscreen ? 9999 : 'auto',
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
                '& img': {
                    maxWidth: '100% !important',
                    maxHeight: '100% !important',
                    objectFit: 'fill !important',
                    background: 'black',
                }
            }}
            onMouseEnter={() => hasVoip && !isInCall && !isIncomingCall && !isOutgoingCall && setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            onClick={() => {
                if (!hasVoip) return; // Sem VoIP, não faz nada

                // isIncomingCall: clica na imagem, atende a chamada
                if (isIncomingCall) {
                    if (onClick) onClick();
                }
                // isOutgoingCall ou isInCall: clica na imagem, encerra a chamada
                else if (isOutgoingCall || isInCall) {
                    if (onHangup) onHangup();
                }
                // Sem chamada: clica na imagem, inicia uma chamada
                else {
                    if (onClick) onClick();
                }
            }}
        >
            {!cameraId ? (
                <Box
                    sx={{
                        width: '100%',
                        height: '100%',
                        background: '#1a1a1a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#666',
                        fontSize: '14px'
                    }}
                >
                    Nenhuma câmera selecionada
                </Box>
            ) : (
                <img
                    ref={imgRef}
                    crossOrigin="anonymous"
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
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                    alt={rest.alt || `VoIP Camera ${cameraId}`}
                    {...rest}
                />
            )}

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

            {/* Botões de controle VoIP */}
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
                // Comportamento normal - botão circular Ligar
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

            {/* Botão de fullscreen quando não está em chamada */}
            {!isInCall && !isIncomingCall && !isOutgoingCall && (
                <IconButton
                    onClick={(e) => {
                        e.stopPropagation();
                        handleFullscreen();
                    }}
                    sx={{
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        width: '40px',
                        height: '40px',
                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                        color: 'white',
                        zIndex: 10,
                        opacity: isHoveringCenter ? 1 : 0,
                        transition: 'opacity 0.3s ease',
                        '&:hover': {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        }
                    }}
                    onMouseEnter={() => setIsHoveringCenter(true)}
                    onMouseLeave={() => setIsHoveringCenter(false)}
                >
                    {isFullscreen ? (
                        <ZoomOutIcon sx={{ fontSize: '1.5rem' }} />
                    ) : (
                        <ZoomInIcon sx={{ fontSize: '1.5rem' }} />
                    )}
                </IconButton>
            )}

            {/* Indicador de retry */}
            {retryState.isRetrying && (
                <Box
                    sx={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        zIndex: 10
                    }}
                >
                    <RefreshIcon 
                        sx={{ 
                            fontSize: '16px', 
                            color: 'rgba(255, 255, 255, 0.8)',
                            animation: 'spin 2s linear infinite',
                            '@keyframes spin': {
                                '0%': { transform: 'rotate(0deg)' },
                                '100%': { transform: 'rotate(360deg)' },
                            }
                        }} 
                    />
                </Box>
            )}
            
            {/* Indicador de erro */}
            {!retryState.isRetrying && retryState.lastError && (
                <Box
                    sx={{
                        position: 'absolute',
                        bottom: 8,
                        left: 8,
                        backgroundColor: 'rgba(244, 67, 54, 0.9)',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        zIndex: 10
                    }}
                >
                    Erro: {retryState.lastError}
                </Box>
            )}
        </Box>
    );
});

// Comparador para React.memo
WebSocketVoip.displayName = 'WebSocketVoip';