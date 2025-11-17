/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useRef, useState } from "react";
import JsSIP from "jssip";
import { CameraPlayer } from "./CameraPlayer";

// JsSIP.debug.enable("JsSIP:*");

// === CONFIG SIP === //
const SIP_WEBSOCKET = "ws://192.168.0.251:8088/ws";
const SIP_URI = "sip:101@192.168.0.251";
const SIP_PASSWORD = "abcd1234";
const SIP_DESTINATION = "9999";

export const VoipTest: React.FC = () => {
  const [status, setStatus] = useState("Parado");
  const [registered, setRegistered] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  const uaRef = useRef<any>(null);
  const sessionRef = useRef<any>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // === Iniciar / Registrar UA === //
  const startUA = async () => {
    if (uaRef.current) return;

    const socket = new JsSIP.WebSocketInterface(SIP_WEBSOCKET);

    const ua = new JsSIP.UA({
      sockets: [socket],
      uri: SIP_URI,
      password: SIP_PASSWORD,
      register: true,
    });

    ua.on("connected", () => setStatus("Conectado ao servidor SIP"));
    ua.on("registered", () => {
      setRegistered(true);
      setStatus("Registrado");
    });
    ua.on("disconnected", () => {
      setRegistered(false);
      setStatus("Desconectado");
      setShowCamera(false);
    });
    ua.on("registrationFailed", (e: any) => {
      setRegistered(false);
      setStatus("Falha no registro: " + e.cause);
      setShowCamera(false);
    });

    // === Recebendo chamada (interfone chamando o porteiro) === //
    ua.on("newRTCSession", (data: any) => {
      const session = data.session;

      if (data.originator === "remote") {
        setStatus("Chamada recebida");
        setShowCamera(true);

        session.answer({
          mediaConstraints: { audio: false, video: false },
        });

        sessionRef.current = session;
        attachRemoteAudio(session);

        session.on("ended", () => {
          setStatus("Chamada encerrada");
          setShowCamera(false);
        });

        session.on("failed", () => {
          setStatus("Chamada falhou");
          setShowCamera(false);
        });
      }
    });

    ua.start();
    uaRef.current = ua;
  };

  // === Áudio vindo do interfone === //
  const attachRemoteAudio = (session: any) => {
    session.connection.addEventListener("track", (event: any) => {
      const [stream] = event.streams;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.play().catch(() => {});
      }
    });
  };

  // === Fazer chamada (opcional) === //
  const makeCall = () => {
    if (!registered) {
      alert("A UA ainda não está registrada!");
      return;
    }

    setShowCamera(true);
    setStatus("Chamando...");

    const session = uaRef.current.call(SIP_DESTINATION, {
      mediaConstraints: { audio: false, video: false },
      rtcOfferConstraints: {
        offerToReceiveAudio: true,
      },
    });

    sessionRef.current = session;
    attachRemoteAudio(session);

    session.on("confirmed", () => setStatus("Em chamada"));
    session.on("ended", () => {
      setStatus("Chamada encerrada");
      setShowCamera(false);
    });
    session.on("failed", (e: any) => {
      setStatus("Chamada falhou: " + e.cause);
      setShowCamera(false);
    });
  };

  // === Encerrar chamada === //
  const hangup = () => {
    if (sessionRef.current) {
      sessionRef.current.terminate();
      sessionRef.current = null;
    }
    setShowCamera(false);
  };

  // === Cleanup ao desmontar === //
  useEffect(() => {
    return () => {
      if (uaRef.current) uaRef.current.stop();
    };
  }, []);

  return (
    <div style={{ display: "flex", gap: 24 }}>
      {/* CONTROLE SIP */}
      <div>
        <p>Status: {status}</p>

        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button onClick={startUA} disabled={!!uaRef.current}>
            Iniciar/Registrar
          </button>
          <button onClick={makeCall} disabled={!registered}>
            Fazer chamada
          </button>
          <button onClick={hangup}>Encerrar</button>
        </div>

        <audio ref={remoteAudioRef} autoPlay />
        <p style={{ fontSize: 12, opacity: 0.7 }}>
          Áudio vem do interfone (SIP).  
          Vídeo é da câmera vinculada, via <code>rtsp-relay</code>.
        </p>
      </div>

      {/* CÂMERA */}
      <div>
        <p>Câmera vinculada ao interfone</p>
        <div
          style={{
            width: 500,
            height: 300,
            background: "#000",
            borderRadius: 8,
            overflow: "hidden",
            border: "1px solid #1f2937",
          }}
        >
          {showCamera ? (
             <CameraPlayer wsUrl="ws://localhost:2000/api/stream/camera1" />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ccc",
                fontSize: 12,
              }}
            >
              Câmera será exibida durante a chamada.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
