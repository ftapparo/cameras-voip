import { Box } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useRef, useEffect, useState } from 'react';
import Hls from 'hls.js';

interface CameraPlayerProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
    hlsUrl: string;
}

export const CameraPlayer = ({ hlsUrl, ...rest }: CameraPlayerProps) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const boxRef = useRef<HTMLDivElement | null>(null);
    const hlsRef = useRef<Hls | null>(null);
    
    // Estado para controle de retry
    const [retryState, setRetryState] = useState({ 
        isRetrying: false, 
        lastError: null as string | null 
    });

    // Configuração HLS.js
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Limpa instância anterior do HLS
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }

        if (Hls.isSupported()) {
            console.log('[CameraPlayer] Usando HLS.js para:', hlsUrl);
            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 90
            });
            
            hlsRef.current = hls;
            hls.loadSource(hlsUrl);
            hls.attachMedia(video);
            
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                console.log('[CameraPlayer] HLS manifest carregado');
                setRetryState({ isRetrying: false, lastError: null });
            });
            
            hls.on(Hls.Events.ERROR, (_, data) => {
                console.error('[CameraPlayer] Erro HLS:', data);
                if (data.fatal) {
                    setRetryState({ isRetrying: true, lastError: `HLS Error: ${data.type}` });
                    // Retry após 5 segundos
                    setTimeout(() => {
                        hls.loadSource(hlsUrl);
                    }, 5000);
                }
            });
            
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            console.log('[CameraPlayer] Usando HLS nativo para:', hlsUrl);
            video.src = hlsUrl;
        } else {
            console.warn('[CameraPlayer] HLS não suportado');
            setRetryState({ isRetrying: false, lastError: 'HLS não suportado' });
        }

        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
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
                controls={false}
                autoPlay
                muted
                playsInline
                preload="metadata"
                crossOrigin="anonymous"
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

