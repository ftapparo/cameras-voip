import { Box } from '@mui/material';
import { useRef, useEffect } from 'react'

interface CameraPlayerProps extends React.CanvasHTMLAttributes<HTMLCanvasElement> {
    wsUrl: string;
}

export const CameraPlayer = ({ wsUrl, ...rest }: CameraPlayerProps) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const boxRef = useRef<HTMLDivElement | null>(null);
    const playerLoadedRef = useRef(false);

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
            });
        };
        document.body.appendChild(script);

        return () => {
            destroyed = true;
            // Libera contexto WebGL manualmente
            if (canvasRef.current) {
                const gl = canvasRef.current.getContext('webgl') || canvasRef.current.getContext('experimental-webgl');
                if (gl && typeof (gl as WebGLRenderingContext).getExtension === 'function') {
                    const loseCtx = (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context');
                    if (loseCtx) loseCtx.loseContext();
                }
            }
            document.body.removeChild(script);
        };
    }, [wsUrl]);

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
                border: '0px',
                transition: 'border-color 0.2s ease',
                cursor: 'pointer',
                '&:hover': {
                    border: '2px solid transparent',
                    borderColor: 'white',
                },
                '& canvas': {
                    maxWidth: '100% !important',
                    maxHeight: '100% !important',
                    objectFit: 'fill !important'
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
        </Box>
    );
};

