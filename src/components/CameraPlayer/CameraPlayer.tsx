import { Box } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useRef, useEffect, useState } from 'react';

interface CameraPlayerProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
    hlsUrl: string;
}

export const CameraPlayer = ({ hlsUrl, ...rest }: CameraPlayerProps) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const boxRef = useRef<HTMLDivElement | null>(null);
    
    // Estado para controle de retry
    const [retryState, setRetryState] = useState({ 
        isRetrying: false, 
        lastError: null as string | null 
    });

    // Sistema de retry para erros de rede
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        
        const onLoadedData = () => {
            setRetryState({ isRetrying: false, lastError: null }); // Reset retry ao carregar com sucesso
        };
        
        const onError = (event: Event) => {
            // Detecta erro de rede (404, conexão perdida, etc.)
            const target = event.target as HTMLVideoElement;
            const error = target.error;
            
            let shouldRetry = false;
            let errorMessage = 'Erro desconhecido';
            
            if (error) {
                switch (error.code) {
                    case MediaError.MEDIA_ERR_NETWORK:
                        errorMessage = 'Erro de rede (404/conexão perdida)';
                        shouldRetry = true;
                        break;
                    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                        errorMessage = 'Formato não suportado';
                        shouldRetry = true;
                        break;
                    case MediaError.MEDIA_ERR_DECODE:
                        errorMessage = 'Erro de decodificação';
                        shouldRetry = true;
                        break;
                    case MediaError.MEDIA_ERR_ABORTED:
                        errorMessage = 'Reprodução abortada';
                        shouldRetry = false; // Não tenta retry em abort
                        break;
                }
            }
            
            if (shouldRetry) {
                console.log(`[CameraPlayer] ${errorMessage} - Retry em 5s: ${hlsUrl.split('/').pop()}`);
                
                setRetryState({
                    isRetrying: true,
                    lastError: errorMessage
                });
                
                // Retry após 5 segundos
                setTimeout(() => {
                    if (video && hlsUrl) {
                        video.load(); // Força reload do vídeo
                    }
                }, 5000);
            } else {
                console.warn(`[CameraPlayer] ${errorMessage} (sem retry): ${hlsUrl.split('/').pop()}`);
                setRetryState({ 
                    isRetrying: false, 
                    lastError: errorMessage 
                });
            }
        };
        
        video.addEventListener('loadeddata', onLoadedData);
        video.addEventListener('error', onError);
        
        return () => {
            video.removeEventListener('loadeddata', onLoadedData);
            video.removeEventListener('error', onError);
        };
    }, [hlsUrl]);
    
    // Reset retry state quando URL muda
    useEffect(() => {
        setRetryState({ isRetrying: false, lastError: null });
    }, [hlsUrl]);

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
                '& video': {
                    maxWidth: '100% !important',
                    maxHeight: '100% !important',
                    objectFit: 'fill !important',
                    background: 'black',
                }
            }}
        >
            <video
                ref={videoRef}
                src={hlsUrl}
                controls={false}
                autoPlay
                muted
                playsInline
                style={{ width: '100%', height: '100%', display: 'block', ...rest.style }}
                {...rest}
            />
            
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

