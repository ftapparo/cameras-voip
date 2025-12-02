import { Box } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useRef, useEffect, useState } from 'react';
import { connectionPool } from '../../utils/connectionPool';

interface CameraPlayerProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    cameraUrl: string;
    lazy?: boolean; // Habilita lazy loading
}

export const CameraPlayer = ({ cameraUrl, lazy = true, ...rest }: CameraPlayerProps) => {
    const imgRef = useRef<HTMLImageElement | null>(null);
    const boxRef = useRef<HTMLDivElement | null>(null);
    const [isVisible, setIsVisible] = useState(!lazy); // Se lazy=false, carrega imediatamente
    
    // Estado para controle de retry
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

    // Configuração de imagem MJPEG via proxy
    useEffect(() => {
        if (!isVisible) return;
        
        const img = imgRef.current;
        if (!img) return;

        let connectionAcquired = false;

        const loadCamera = async () => {
            try {
                // Solicita uma conexão do pool
                await connectionPool.requestConnection(cameraUrl);
                connectionAcquired = true;

                console.log('[CameraPlayer] Carregando câmera via proxy:', cameraUrl);
                
                // Configurar source diretamente para MJPEG
                img.src = cameraUrl;
                
                const onLoad = () => {
                    console.log('[CameraPlayer] Imagem carregada com sucesso');
                    setRetryState({ isRetrying: false, lastError: null });
                };
                
                const onError = () => {
                    console.error('[CameraPlayer] Erro ao carregar imagem');
                    setRetryState({ isRetrying: true, lastError: 'Erro de carregamento' });
                    
                    // Retry após 5 segundos
                    setTimeout(() => {
                        if (img.src) {
                            img.src = cameraUrl + '?t=' + Date.now(); // Force reload com timestamp
                        }
                    }, 5000);
                };
                
                const onLoadStart = () => {
                    console.log('[CameraPlayer] Iniciando carregamento da imagem');
                    setRetryState({ isRetrying: false, lastError: null });
                };

                img.addEventListener('load', onLoad);
                img.addEventListener('error', onError);
                img.addEventListener('loadstart', onLoadStart);
                
                return () => {
                    img.removeEventListener('load', onLoad);
                    img.removeEventListener('error', onError);
                    img.removeEventListener('loadstart', onLoadStart);
                    
                    // Libera a conexão do pool
                    if (connectionAcquired) {
                        connectionPool.releaseConnection(cameraUrl);
                    }
                };
            } catch (error) {
                console.error('[CameraPlayer] Erro ao adquirir conexão:', error);
                setRetryState({ isRetrying: true, lastError: 'Pool de conexões esgotado' });
            }
        };

        const cleanup = loadCamera();
        
        return () => {
            if (cleanup) {
                cleanup.then(cleanupFn => cleanupFn?.());
            }
        };
    }, [cameraUrl, isVisible]);

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
        >
            {!isVisible ? (
                // Placeholder quando não carregada
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
                    {...rest}
                />
            )}
            
            {/* Ícone discreto de retry */}
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
                                '0%': {
                                    transform: 'rotate(0deg)',
                                },
                                '100%': {
                                    transform: 'rotate(360deg)',
                                },
                            }
                        }} 
                    />
                </Box>
            )}
            
            {/* Indicador de erro (sem retry) */}
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
};

