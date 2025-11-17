import { Box } from '@mui/material';
import { useRef, useEffect } from 'react'

interface VoipCameraProps extends React.CanvasHTMLAttributes<HTMLCanvasElement> {
    wsUrl?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface PlayerWithDestroy {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    player: any;
    destroy: () => void;
}

export const VoipCamera = ({ wsUrl, ...rest }: VoipCameraProps) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const boxRef = useRef<HTMLDivElement | null>(null);
    const playerLoadedRef = useRef(false);
    const destroyFnRef = useRef<(() => void) | null>(null);


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

        console.log(`Carregando VoipCamera com URL: ${wsUrl}`);

        if (!wsUrl) {
            console.warn("URL WebSocket não fornecida para VoipCamera.");

            // Limpa o player se não houver URL
            if (destroyFnRef.current) {
                destroyFnRef.current();
                destroyFnRef.current = null;
            }
            return;
        }

        let destroyed = false;

        const initPlayer = async () => {
            // Limpa player anterior se existir
            if (destroyFnRef.current) {
                console.log("Destruindo player anterior...");
                try {
                    destroyFnRef.current();
                } catch (e) {
                    console.warn("Erro ao destruir player:", e);
                }
                destroyFnRef.current = null;
                playerLoadedRef.current = false;
            }

            // Aguarda um pouco após destruir o player anterior
            await new Promise(resolve => setTimeout(resolve, 200));

            if (destroyed) return;

            // Recria o canvas para garantir contexto WebGL limpo
            const oldCanvas = canvasRef.current;
            if (oldCanvas && oldCanvas.parentNode) {
                const newCanvas = document.createElement('canvas');
                // Copia todos os estilos
                newCanvas.style.cssText = oldCanvas.style.cssText;
                oldCanvas.parentNode.replaceChild(newCanvas, oldCanvas);
                canvasRef.current = newCanvas;
                console.log("Canvas recriado com sucesso");
            }

            // Mais um pequeno delay após recriar o canvas
            await new Promise(resolve => setTimeout(resolve, 100));

            if (destroyed) return;

            const canvas = canvasRef.current;

            if (!canvas) {
                console.error("Canvas não encontrado");
                return;
            }
            if (!window.loadPlayer) {
                console.error("loadPlayer não encontrado no window");
                return;
            }

            console.log("Iniciando player WebRTC Relay...");

            try {
                const result = await window.loadPlayer({
                    url: wsUrl,
                    canvas: canvas,
                }) as unknown as PlayerWithDestroy;

                if (!destroyed && result && result.destroy) {
                    destroyFnRef.current = result.destroy;
                    playerLoadedRef.current = true;
                    console.log("Player carregado com sucesso");
                }
            } catch (error) {
                console.error("Erro ao carregar player:", error);
            }
        };

        // Verifica se o script já existe
        const existingScript = document.querySelector('script[src="/rtsp-relay.js"]');

        if (existingScript && window.loadPlayer) {
            // Script já carregado, executa direto
            console.log("Script já carregado, iniciando player...");
            initPlayer();
        } else if (!existingScript) {
            // Script não existe, cria novo
            const script = document.createElement("script");
            script.src = "/rtsp-relay.js";
            script.async = true;
            script.onload = () => {
                console.log("Script carregado, iniciando player...");
                initPlayer();
            };
            document.body.appendChild(script);
        } else {
            // Script existe mas loadPlayer ainda não está pronto, aguarda
            const checkInterval = setInterval(() => {
                if (window.loadPlayer) {
                    clearInterval(checkInterval);
                    console.log("loadPlayer disponível, iniciando player...");
                    initPlayer();
                }
            }, 100);

            return () => {
                clearInterval(checkInterval);
            };
        }

        return () => {
            destroyed = true;

            // Chama a função destroy se disponível
            if (destroyFnRef.current) {
                console.log("Destruindo player no cleanup...");
                try {
                    destroyFnRef.current();
                } catch (e) {
                    console.warn("Erro ao destruir player no cleanup:", e);
                }
                destroyFnRef.current = null;
            }
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

