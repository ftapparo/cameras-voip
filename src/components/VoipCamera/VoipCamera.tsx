import { Box, Chip, CircularProgress, IconButton } from '@mui/material';
import { useRef, useEffect, useState } from 'react';
import PhoneIcon from '@mui/icons-material/Phone';
import CallEndIcon from '@mui/icons-material/CallEnd';
import { connectionPool } from '../../utils/connectionPool';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import RefreshIcon from '@mui/icons-material/Refresh';

interface VoipCameraProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    cameraUrl?: string;
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

export const VoipCamera = ({ cameraUrl, onClick, isIncomingCall = false, isInCall = false, isOutgoingCall = false, callConfirmed = false, onReject, onHangup, hasVoip = true, onLoadingComplete, ...rest }: VoipCameraProps) => {
    const imgRef = useRef<HTMLImageElement | null>(null);
    const boxRef = useRef<HTMLDivElement | null>(null);
    const [isHovering, setIsHovering] = useState(false);
    const [isHoveringCenter, setIsHoveringCenter] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    
    // Estado de loading baseado na URL - resetado quando URL muda
    const [loadingState, setLoadingState] = useState({ url: cameraUrl, loaded: false });
    
    // Estado para controle de retry
    const [retryState, setRetryState] = useState({ 
        isRetrying: false, 
        lastError: null as string | null 
    });
    
    // Se URL mudou, resetar estado
    if (loadingState.url !== cameraUrl) {
        setLoadingState({ url: cameraUrl, loaded: false });
        setRetryState({ isRetrying: false, lastError: null });
    }

    // Resetar fullscreen quando chamada encerrar
    useEffect(() => {
        if (!isInCall && !isIncomingCall && !isOutgoingCall) {
            setTimeout(() => setIsFullscreen(false), 0);
        }
    }, [isInCall, isIncomingCall, isOutgoingCall]);

    // State derivado: loading quando há URL mas vídeo não carregou
    const isLoading = Boolean(cameraUrl && !loadingState.loaded);

    // Configuração de imagem MJPEG via proxy
    useEffect(() => {
        const img = imgRef.current;
        if (!img || !cameraUrl) return;

        console.log('[VoipCamera] Carregando câmera via proxy:', cameraUrl);
        
        // Configurar source diretamente
        img.src = cameraUrl;
        
        const onLoad = () => {
            console.log('[VoipCamera] Imagem carregada com sucesso');
            setLoadingState({ url: cameraUrl, loaded: true });
            setRetryState({ isRetrying: false, lastError: null });
            onLoadingComplete?.();
        };
        
        const onError = () => {
            console.error('[VoipCamera] Erro ao carregar imagem');
            setRetryState({ isRetrying: false, lastError: 'Erro de carregamento' });
            onLoadingComplete?.();
        };

        img.addEventListener('load', onLoad);
        img.addEventListener('error', onError);
        
        return () => {
            img.removeEventListener('load', onLoad);
            img.removeEventListener('error', onError);
        };
    }, [cameraUrl, onLoadingComplete]);

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
                backgroundColor: isFullscreen ? '#000' : 'transparent',
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
                '& video': {
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

                // isIncomingCall: clica no vídeo, atende a chamada
                if (isIncomingCall) {
                    if (onClick) onClick();
                }
                // isOutgoingCall ou isInCall: clica no vídeo, encerra a chamada
                else if (isOutgoingCall || isInCall) {
                    if (onHangup) onHangup();
                }
                // Sem chamada: clica no vídeo, inicia uma chamada
                else {
                    if (onClick) onClick();
                }
            }}
        >
            <img
                ref={imgRef}
                crossOrigin="anonymous"
                style={{ width: '100%', height: '100%', display: 'block', ...rest.style }}
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

            {/* Área circular central para fullscreen - só durante chamada estabelecida */}
            {callConfirmed && (
                <Box
                    onMouseEnter={() => setIsHoveringCenter(true)}
                    onMouseLeave={() => setIsHoveringCenter(false)}
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsFullscreen(!isFullscreen);
                    }}
                    sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        zIndex: 8,
                        backgroundColor: isHoveringCenter ? 'rgba(0, 0, 0, 0.7)' : 'transparent',
                        transition: 'background-color 0.3s ease',
                    }}
                >
                    {isHoveringCenter && (
                        isFullscreen ? (
                            <ZoomOutIcon sx={{ fontSize: '2rem', color: 'white' }} />
                        ) : (
                            <ZoomInIcon sx={{ fontSize: '2rem', color: 'white' }} />
                        )
                    )}
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


