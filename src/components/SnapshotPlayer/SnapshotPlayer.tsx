import { Box } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useRef, useEffect, useState, useCallback } from 'react';
import { globalCameraSequencer } from '../../utils/cameraSequencer';

interface SnapshotPlayerProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    cameraSnapshotUrl: string;
    lazy?: boolean; // Habilita lazy loading
}

export const SnapshotPlayer = ({ 
    cameraSnapshotUrl, 
    lazy = true, 
    ...rest 
}: SnapshotPlayerProps) => {
    const imgRef = useRef<HTMLImageElement | null>(null);
    const boxRef = useRef<HTMLDivElement | null>(null);
    const [isVisible, setIsVisible] = useState(!lazy);
    const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

    // Estado para controle de retry
    const [retryState, setRetryState] = useState({ 
        isRetrying: false, 
        lastError: null as string | null 
    });

    // ID único da câmera (baseado na URL)
    const cameraId = useRef(cameraSnapshotUrl.split('/').pop()?.split('?')[0] || 'unknown');

    // Callbacks para o sequenciador
    const handleUpdate = useCallback((imageUrl: string) => {
        // Libera URL anterior se existir
        if (currentImageUrl) {
            URL.revokeObjectURL(currentImageUrl);
        }
        
        setCurrentImageUrl(imageUrl);
        setLastUpdate(new Date());
        setRetryState({ isRetrying: false, lastError: null });
        
        console.log(`[SnapshotPlayer] Câmera ${cameraId.current} atualizada`);
    }, [currentImageUrl]);

    const handleError = useCallback((error: string) => {
        setRetryState({ isRetrying: true, lastError: error });
        console.error(`[SnapshotPlayer] Erro na câmera ${cameraId.current}:`, error);
    }, []);

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

    // Registro/desregistro no sequenciador global
    useEffect(() => {
        if (!isVisible) return;

        const currentCameraId = cameraId.current;
        console.log(`[SnapshotPlayer] Registrando câmera ${currentCameraId} no sequenciador`);

        // Registra a câmera no sequenciador global
        globalCameraSequencer.registerCamera({
            id: currentCameraId,
            snapshotUrl: cameraSnapshotUrl,
            onUpdate: handleUpdate,
            onError: handleError
        });

        // Inicia o sequenciador se não estiver rodando
        globalCameraSequencer.start();

        return () => {
            console.log(`[SnapshotPlayer] Removendo câmera ${currentCameraId} do sequenciador`);
            globalCameraSequencer.unregisterCamera(currentCameraId);
            
            // Libera URL da imagem se existir
            if (currentImageUrl) {
                URL.revokeObjectURL(currentImageUrl);
            }
        };
    }, [isVisible, cameraSnapshotUrl, handleUpdate, handleError, currentImageUrl]);

    // Cleanup ao desmontar
    useEffect(() => {
        return () => {
            if (currentImageUrl) {
                URL.revokeObjectURL(currentImageUrl);
            }
        };
    }, [currentImageUrl]);

    const handleImageLoad = () => {
        console.log(`[SnapshotPlayer] Imagem da câmera ${cameraId.current} carregada no DOM`);
    };

    const handleImageError = () => {
        console.error(`[SnapshotPlayer] Erro ao exibir imagem da câmera ${cameraId.current}`);
    };

    return (
        <Box 
            ref={boxRef} 
            sx={{ 
                position: 'relative',
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                borderRadius: 1,
                backgroundColor: '#000'
            }}
        >
            {isVisible && (
                <>
                    {/* Indicador de carregamento/erro */}
                    {!currentImageUrl && !retryState.isRetrying && (
                        <Box
                            sx={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 1,
                                color: 'white',
                                zIndex: 2
                            }}
                        >
                            <RefreshIcon sx={{ fontSize: 40, animation: 'spin 2s linear infinite' }} />
                            <div style={{ fontSize: '12px' }}>Aguardando...</div>
                        </Box>
                    )}

                    {/* Indicador de erro */}
                    {retryState.isRetrying && (
                        <Box
                            sx={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 1,
                                color: '#ff6b6b',
                                zIndex: 2,
                                textAlign: 'center'
                            }}
                        >
                            <RefreshIcon sx={{ fontSize: 40, animation: 'spin 1s linear infinite' }} />
                            <div style={{ fontSize: '10px' }}>{retryState.lastError}</div>
                        </Box>
                    )}

                    {/* Informações de debug */}
                    {lastUpdate && (
                        <Box
                            sx={{
                                position: 'absolute',
                                bottom: 4,
                                right: 4,
                                backgroundColor: 'rgba(0,0,0,0.7)',
                                color: 'white',
                                fontSize: '10px',
                                padding: '2px 6px',
                                borderRadius: 1,
                                zIndex: 3
                            }}
                        >
                            {lastUpdate.toLocaleTimeString()}
                        </Box>
                    )}

                    {/* Imagem da câmera */}
                    <img
                        ref={imgRef}
                        src={currentImageUrl || undefined}
                        onLoad={handleImageLoad}
                        onError={handleImageError}
                        {...rest}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: currentImageUrl ? 'block' : 'none',
                            ...rest.style
                        }}
                    />
                </>
            )}

            {/* Animação de rotação */}
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </Box>
    );
};