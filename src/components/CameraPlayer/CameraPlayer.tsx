import { Box, CircularProgress } from '@mui/material';
import { useRef, useEffect, useState } from 'react';
import { cameraQueue } from '../../utils/cameraQueue';

interface CameraPlayerProps extends React.CanvasHTMLAttributes<HTMLCanvasElement> {
    wsUrl: string;
}

export const CameraPlayer = ({ wsUrl, ...rest }: CameraPlayerProps) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const boxRef = useRef<HTMLDivElement | null>(null);
    const playerLoadedRef = useRef(false);
    const [isVisible, setIsVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [retryCount, setRetryCount] = useState(0);
    const retryTimeoutRef = useRef<number | null>(null);
    const loadSuccessRef = useRef(false);
    const releaseQueueRef = useRef<(() => void) | null>(null);
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

    // Intersection Observer para detectar quando o componente está visível
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsVisible(entry.isIntersecting);
            },
            {
                threshold: 0.1, // Começa a carregar quando 10% está visível
                rootMargin: '50px' // Começa a carregar 50px antes de entrar na tela
            }
        );

        if (boxRef.current) {
            observer.observe(boxRef.current);
        }

        return () => {
            observer.disconnect();
        };
    }, []);

    useEffect(() => {
        if (!isVisible) return; // Só carrega quando visível

        let destroyed = false;
        loadSuccessRef.current = false;

        let init = true;

        const loadPlayer = async () => {
            // Aguarda slot na fila
            const releaseQueue = await cameraQueue.acquire();
            releaseQueueRef.current = releaseQueue;

            const script = document.createElement("script");
            script.src = "/rtsp-relay.js";
            script.async = true;

            script.onload = async () => {
                if (destroyed) {
                    releaseQueue(); // Libera se foi destruído
                    return;
                }
                if (!canvasRef.current) {
                    console.error("Canvas não encontrado");
                    releaseQueue(); // Libera em caso de erro
                    handleLoadError();
                    return;
                }
                if (!window.loadPlayer) {
                    console.error("loadPlayer não encontrado no window");
                    releaseQueue(); // Libera em caso de erro
                    handleLoadError();
                    return;
                }

                console.log(`[Câmera ${wsUrl}] Iniciando player (tentativa ${retryCount + 1}/${MAX_RETRIES})...`);

                await window.loadPlayer({
                    url: wsUrl,
                    canvas: canvasRef.current,
                    onSourceEstablished: () => {
                        console.log(`[Câmera ${wsUrl}] Conexão estabelecida`);
                        loadSuccessRef.current = true;
                        setRetryCount(0);
                    },
                    onVideoDecode: () => {
                        // Remove loading quando o primeiro frame é decodificado
                        if (!destroyed && init) {
                            console.log(`[Câmera ${wsUrl}] Vídeo carregado com sucesso`);
                            setIsLoading(false);
                            loadSuccessRef.current = true;
                            setRetryCount(0);
                            init = false;

                            // LIBERA A FILA AQUI - quando vídeo realmente carregou
                            releaseQueue();
                            releaseQueueRef.current = null;
                        }
                    }
                }).catch((error: Error) => {
                    console.error(`[Câmera ${wsUrl}] Erro ao carregar player:`, error);
                    releaseQueue(); // Libera em caso de erro
                    handleLoadError();
                });

                // Timeout de segurança: se após 10s não receber vídeo, considera falha
                retryTimeoutRef.current = window.setTimeout(() => {
                    if (!loadSuccessRef.current && !destroyed) {
                        console.warn(`[Câmera ${wsUrl}] Timeout - nenhum frame recebido em 10s`);
                        if (releaseQueueRef.current) {
                            releaseQueueRef.current(); // Libera em caso de timeout
                            releaseQueueRef.current = null;
                        }
                        handleLoadError();
                    }
                }, 10000);
            };

            script.onerror = () => {
                console.error(`[Câmera ${wsUrl}] Erro ao carregar script rtsp-relay.js`);
                releaseQueue(); // Libera em caso de erro
                handleLoadError();
            };

            document.body.appendChild(script);
        };

        const handleLoadError = () => {
            if (destroyed) return;

            if (retryCount < MAX_RETRIES) {
                const nextRetry = retryCount + 1;
                console.log(`[Câmera ${wsUrl}] Tentando reconectar (${nextRetry}/${MAX_RETRIES})...`);
                setRetryCount(nextRetry);

                // Aguarda 2s antes de tentar novamente
                retryTimeoutRef.current = window.setTimeout(() => {
                    if (!destroyed) {
                        loadPlayer();
                    }
                }, 2000);
            } else {
                console.error(`[Câmera ${wsUrl}] Falha após ${MAX_RETRIES} tentativas`);
                setIsLoading(false);
            }
        };

        // Inicia o carregamento
        loadPlayer();

        return () => {
            destroyed = true;

            // Limpa timeout de retry
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
                retryTimeoutRef.current = null;
            }

            // Libera contexto WebGL manualmente
            if (canvasRef.current) {
                // eslint-disable-next-line react-hooks/exhaustive-deps
                const gl = canvasRef.current.getContext('webgl') || canvasRef.current.getContext('experimental-webgl');
                if (gl && typeof (gl as WebGLRenderingContext).getExtension === 'function') {
                    const loseCtx = (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context');
                    if (loseCtx) loseCtx.loseContext();
                }
            }
        };
    }, [wsUrl, isVisible, retryCount, MAX_RETRIES]);


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
                '& canvas': {
                    maxWidth: '100% !important',
                    maxHeight: '100% !important',
                    objectFit: 'fill !important'
                }
            }}
        >
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
                        zIndex: 10
                    }}
                >
                    <CircularProgress sx={{ color: 'white' }} />
                </Box>
            )}

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
        </Box>
    );
};

