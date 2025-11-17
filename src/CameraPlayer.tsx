import { useEffect, useRef } from "react";

interface CameraPlayerProps {
  wsUrl: string;
}

interface CanvasWithStop extends HTMLCanvasElement {
  __stop?: () => void;
}

export function CameraPlayer({ wsUrl }: CameraPlayerProps) {
  const canvasRef = useRef<CanvasWithStop | null>(null);

  useEffect(() => {
    let destroyed = false;

    // Carrega script do player
    const script = document.createElement("script");
    script.src = "http://localhost:2000/rtsp-relay/index.js";
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

      const stop = window.loadPlayer({
        url: wsUrl,
        canvas: canvasRef.current,
      });

      // salva função cleanup
      canvasRef.current.__stop = stop;
    };

    document.body.appendChild(script);

    return () => {
      destroyed = true;
      if (canvasRef.current && canvasRef.current.__stop) {
        console.log("Parando player WebRTC...");
        canvasRef.current.__stop();
      }
      document.body.removeChild(script);
    };
  }, [wsUrl]);

  return (
    <canvas
      ref={canvasRef}
      width={500}
      height={300}
      style={{ width: "100%", height: "100%", background: "black" }}
    />
  );
}
