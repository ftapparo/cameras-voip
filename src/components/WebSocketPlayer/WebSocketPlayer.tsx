import { Box } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useRef, useEffect, useState, memo } from 'react';

interface WebSocketPlayerProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    cameraId: string;
    lazy?: boolean;
}

export const WebSocketPlayer = memo<WebSocketPlayerProps>(({ cameraId, lazy = true, ...rest }) => {
    const imgRef = useRef<HTMLImageElement | null>(null);
    const boxRef = useRef<HTMLDivElement | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<number | null>(null);
    
    const [isVisible, setIsVisible] = useState(!lazy);
    const [retryState, setRetryState] = useState({ 
        isRetrying: false, 
        lastError: null as string | null 
    });

    // Intersection Observer para lazy loading
    useEffect(() => {
        if (!lazy) return;
        
        const currentBox = boxRef.current;
        if (!currentBox) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.1 }
        );

        observer.observe(currentBox);
        
        return () => observer.disconnect();
    }, [lazy]);

    // WebSocket connection effect
    useEffect(() => {
        if (!isVisible) return;

        const connectWebSocket = () => {
            try {
                setRetryState({ isRetrying: true, lastError: null });
                console.log(`[WebSocketPlayer] Conectando câmera ${cameraId}`);

                const wsUrl = `ws://localhost:3001/?camera=${cameraId}`;
                const ws = new WebSocket(wsUrl);
                wsRef.current = ws;

                ws.onopen = () => {
                    console.log(`[WebSocketPlayer] Conexão WebSocket aberta para câmera ${cameraId}`);
                    setRetryState({ isRetrying: false, lastError: null });
                };

                ws.onclose = () => {
                    console.log(`[WebSocketPlayer] Conexão WebSocket fechada para câmera ${cameraId}`);
                    setRetryState({ isRetrying: true, lastError: 'Conexão perdida' });
                    
                    if (isVisible) {
                        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000) as unknown as number;
                    }
                };

                ws.onerror = (event) => {
                    console.error(`[WebSocketPlayer] Erro WebSocket na câmera ${cameraId}:`, event);
                    setRetryState({ isRetrying: true, lastError: 'Erro de conexão' });
                };

                ws.onmessage = async (event) => {
                    try {
                        if (typeof event.data === 'string') {
                            const message = JSON.parse(event.data);
                            
                            if (message.type === 'connected') {
                                console.log(`[WebSocketPlayer] Stream iniciado para câmera ${cameraId}`);
                                setRetryState({ isRetrying: false, lastError: null });
                            } else if (message.type === 'error') {
                                console.error(`[WebSocketPlayer] Erro do servidor:`, message.message);
                                setRetryState({ isRetrying: true, lastError: message.message });
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
                            
                            if (imgRef.current) {
                                if (imgRef.current.src.startsWith('blob:')) {
                                    URL.revokeObjectURL(imgRef.current.src);
                                }
                                
                                imgRef.current.src = imageUrl;
                                setRetryState({ isRetrying: false, lastError: null });
                            }
                        }
                    } catch (error) {
                        console.error(`[WebSocketPlayer] Erro ao processar mensagem:`, error);
                        setRetryState({ isRetrying: true, lastError: 'Erro de processamento' });
                    }
                };

            } catch (error) {
                console.error(`[WebSocketPlayer] Erro ao criar WebSocket:`, error);
                setRetryState({ isRetrying: true, lastError: 'Falha na conexão' });
            }
        };

        connectWebSocket();

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
            
            if (wsRef.current) {
                console.log(`[WebSocketPlayer] Fechando WebSocket para câmera ${cameraId}`);
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [isVisible, cameraId]);

    const handleImageLoad = () => {
        setRetryState({ isRetrying: false, lastError: null });
    };

    const handleImageError = () => {
        setRetryState({ isRetrying: true, lastError: 'Erro de carregamento' });
    };

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
                cursor: 'pointer',
                transition: 'outline 0.1s ease',
                position: 'relative',
                '&:hover': {
                    outline: '2px solid white',
                    outlineOffset: '-2px',
                },
                '& img': {
                    maxWidth: '100% !important',
                    maxHeight: '100% !important',
                    objectFit: 'fill !important',
                    background: 'black',
                }
            }}
            {...(rest.onClick && { onClick: rest.onClick })}
        >
            {!isVisible ? (
                <Box
                    sx={{
                        width: '100%',
                        height: '100%',
                        background: '#1a1a1a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#666',
                        fontSize: '12px'
                    }}
                >
                    Carregando...
                </Box>
            ) : (
                <img
                    ref={imgRef}
                    crossOrigin="anonymous"
                    style={{ width: '100%', height: '100%', display: 'block', ...rest.style }}
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                    alt={rest.alt || `Camera ${cameraId}`}
                />
            )}
            
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
            
            {!retryState.isRetrying && retryState.lastError && (
                <Box
                    sx={{
                        position: 'absolute',
                        bottom: 8,
                        right: 8,
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

// Comparador para React.memo - só re-renderiza se cameraId mudar
WebSocketPlayer.displayName = 'WebSocketPlayer';