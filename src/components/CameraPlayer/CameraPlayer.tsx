import { Box, CircularProgress } from '@mui/material';
import { useRef, useEffect, useState } from 'react'

interface CameraPlayerProps extends React.CanvasHTMLAttributes<HTMLCanvasElement> {
    wsUrl: string;
}

export const CameraPlayer = ({ wsUrl, ...rest }: CameraPlayerProps) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const boxRef = useRef<HTMLDivElement | null>(null);
    const playerLoadedRef = useRef(false);
    const [isVisible, setIsVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

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
        const script = document.createElement("script");
        script.src = "/rtsp-relay.js";
        script.async = true;

        script.onload = () => {
            if (destroyed) return;
            if (!canvasRef.current) {
                console.error("Canvas não encontrado");
                return;
            }
            if (!window.loadPlayer) {
                console.error("loadPlayer não encontrado no window");
                return;
            }
            console.log("Iniciando player WebRTC Relay...");
            window.loadPlayer({
                url: wsUrl,
                canvas: canvasRef.current,
                onSourceEstablished: () => {
                    console.log("Conexão estabelecida");
                },
                onVideoDecode: () => {
                    // Remove loading quando o primeiro frame é decodificado
                    if (!destroyed) {
                        setIsLoading(false);
                    }
                }
            });
        };
        document.body.appendChild(script);

        return () => {
            destroyed = true;
            // Libera contexto WebGL manualmente
            if (canvasRef.current) {
                // eslint-disable-next-line react-hooks/exhaustive-deps
                const gl = canvasRef.current.getContext('webgl') || canvasRef.current.getContext('experimental-webgl');
                if (gl && typeof (gl as WebGLRenderingContext).getExtension === 'function') {
                    const loseCtx = (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context');
                    if (loseCtx) loseCtx.loseContext();
                }
            }
            document.body.removeChild(script);
        };
    }, [wsUrl, isVisible]);

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

