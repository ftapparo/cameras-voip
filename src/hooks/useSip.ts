/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import JsSIP from 'jssip';

export interface SipConfig {
    websocket: string;
    uri: string;
    password: string;
    extension: string;
}

export interface SipStatus {
    isConnected: boolean;
    isRegistered: boolean;
    extension?: string;
    inCall: boolean;
    callStatus: string;
}

export const useSip = () => {
    const [status, setStatus] = useState<SipStatus>({
        isConnected: false,
        isRegistered: false,
        inCall: false,
        callStatus: 'Parado'
    });

    const uaRef = useRef<any>(null);
    const sessionRef = useRef<any>(null);
    const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
    const [config, setConfig] = useState<SipConfig | null>(null);

    const attachRemoteAudio = (session: any) => {
        session.connection.addEventListener('track', (event: any) => {
            const [stream] = event.streams;
            if (remoteAudioRef.current) {
                remoteAudioRef.current.srcObject = stream;
                remoteAudioRef.current.play().catch(() => { });
            }
        });
    };

    const startUA = (sipConfig: SipConfig) => {
        // Limpa UA anterior se existir
        if (uaRef.current) {
            uaRef.current.stop();
            uaRef.current = null;
        }

        const socket = new JsSIP.WebSocketInterface(sipConfig.websocket);

        const ua = new JsSIP.UA({
            sockets: [socket],
            uri: sipConfig.uri,
            password: sipConfig.password,
            register: true,
        });

        ua.on('connected', () => {
            setStatus(prev => ({
                ...prev,
                isConnected: true,
                callStatus: 'Conectado ao servidor SIP'
            }));
        });

        ua.on('registered', () => {
            setStatus(prev => ({
                ...prev,
                isRegistered: true,
                extension: sipConfig.extension,
                callStatus: 'Registrado'
            }));
        });

        ua.on('disconnected', () => {
            setStatus(prev => ({
                ...prev,
                isConnected: false,
                isRegistered: false,
                inCall: false,
                callStatus: 'Desconectado'
            }));
        });

        ua.on('registrationFailed', (e: any) => {
            setStatus(prev => ({
                ...prev,
                isRegistered: false,
                callStatus: 'Falha no registro: ' + e.cause
            }));
        });

        // Recebendo chamada
        ua.on('newRTCSession', (data: any) => {
            const session = data.session;

            if (data.originator === 'remote') {
                setStatus(prev => ({
                    ...prev,
                    inCall: true,
                    callStatus: 'Chamada recebida'
                }));

                session.answer({
                    mediaConstraints: { audio: false, video: false },
                });

                sessionRef.current = session;
                attachRemoteAudio(session);

                session.on('ended', () => {
                    setStatus(prev => ({
                        ...prev,
                        inCall: false,
                        callStatus: 'Chamada encerrada'
                    }));
                });

                session.on('failed', () => {
                    setStatus(prev => ({
                        ...prev,
                        inCall: false,
                        callStatus: 'Chamada falhou'
                    }));
                });
            }
        });

        ua.start();
        uaRef.current = ua;
    };

    // Inicializar UA quando configuração for definida
    useEffect(() => {
        if (!config) return;

        startUA(config);

        return () => {
            if (uaRef.current) {
                uaRef.current.stop();
                uaRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config]);

    const makeCall = (destination: string) => {
        if (!status.isRegistered) {
            console.error('UA não está registrada');
            return;
        }

        setStatus(prev => ({
            ...prev,
            inCall: true,
            callStatus: 'Chamando...'
        }));

        const session = uaRef.current.call(destination, {
            mediaConstraints: { audio: false, video: false },
            rtcOfferConstraints: {
                offerToReceiveAudio: true,
            },
        });

        sessionRef.current = session;
        attachRemoteAudio(session);

        session.on('confirmed', () => {
            setStatus(prev => ({ ...prev, callStatus: 'Em chamada' }));
        });

        session.on('ended', () => {
            setStatus(prev => ({
                ...prev,
                inCall: false,
                callStatus: 'Chamada encerrada'
            }));
        });

        session.on('failed', (e: any) => {
            setStatus(prev => ({
                ...prev,
                inCall: false,
                callStatus: 'Chamada falhou: ' + e.cause
            }));
        });
    };

    const hangup = () => {
        if (sessionRef.current) {
            sessionRef.current.terminate();
            sessionRef.current = null;
        }
        setStatus(prev => ({
            ...prev,
            inCall: false,
            callStatus: 'Desligado'
        }));
    };

    return {
        status,
        remoteAudioRef,
        connect: setConfig,
        makeCall,
        hangup
    };
};
