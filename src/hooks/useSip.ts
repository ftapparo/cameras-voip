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
    callConfirmed?: boolean;
    incomingCall?: {
        callerExtension: string;
        session: any;
    };
}

export const useSip = () => {
    const [status, setStatus] = useState<SipStatus>({
        isConnected: false,
        isRegistered: false,
        inCall: false,
        callStatus: 'Parado',
        callConfirmed: false
    });

    const uaRef = useRef<any>(null);
    const sessionRef = useRef<any>(null);
    const remoteAudioRef = useRef<HTMLAudioElement>(null);
    const [config, setConfig] = useState<SipConfig | null>(null);
    const registrationTimeoutRef = useRef<number | null>(null);
    const [hasMicrophone, setHasMicrophone] = useState<boolean>(false);

    // Verifica se há microfone disponível e pede permissão
    useEffect(() => {
        const checkMicrophone = async () => {
            try {
                // Verifica se há dispositivos de áudio disponíveis
                const devices = await navigator.mediaDevices.enumerateDevices();
                const audioInputs = devices.filter(device => device.kind === 'audioinput');

                if (audioInputs.length > 0) {
                    console.log(`[Microfone] ${audioInputs.length} microfone(s) detectado(s)`);

                    // Pede permissão para usar o microfone
                    try {
                        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        console.log('[Microfone] Permissão concedida');
                        setHasMicrophone(true);
                        // Para o stream imediatamente, só queríamos verificar a permissão
                        stream.getTracks().forEach(track => track.stop());
                    } catch (permissionError) {
                        console.warn('[Microfone] Permissão negada ou erro:', permissionError);
                        setHasMicrophone(false);
                    }
                } else {
                    console.log('[Microfone] Nenhum microfone detectado');
                    setHasMicrophone(false);
                }
            } catch (error) {
                console.error('[Microfone] Erro ao verificar dispositivos:', error);
                setHasMicrophone(false);
            }
        };

        checkMicrophone();
    }, []);

    const attachRemoteAudio = (session: any) => {
        session.connection.addEventListener('track', (event: any) => {
            const [stream] = event.streams;
            console.log('[Audio] Track recebido:', event.track.kind);
            if (remoteAudioRef.current) {
                remoteAudioRef.current.srcObject = stream;
                remoteAudioRef.current.volume = 1; // Volume máximo
                remoteAudioRef.current.play().catch((err) => {
                    console.error('[Audio] Erro ao reproduzir:', err);
                });
                console.log('[Audio] Stream configurado e iniciando reprodução');
            } else {
                console.warn('[Audio] remoteAudioRef não está disponível');
            }
        });
    };

    const startUA = (sipConfig: SipConfig) => {
        // Limpa UA anterior se existir
        if (uaRef.current) {
            uaRef.current.stop();
            uaRef.current = null;
        }

        // Limpa timeout anterior se existir
        if (registrationTimeoutRef.current) {
            clearTimeout(registrationTimeoutRef.current);
            registrationTimeoutRef.current = null;
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

            // Define timeout de 10 segundos para registro
            registrationTimeoutRef.current = window.setTimeout(() => {
                if (!uaRef.current?.isRegistered()) {
                    setStatus(prev => ({
                        ...prev,
                        isConnected: false,
                        isRegistered: false,
                        callStatus: 'Erro: Tempo de registro expirado. Verifique as credenciais.'
                    }));
                    if (uaRef.current) {
                        uaRef.current.stop();
                    }
                }
            }, 10000);
        });

        ua.on('registered', () => {
            // Limpa o timeout se registrado com sucesso
            if (registrationTimeoutRef.current) {
                clearTimeout(registrationTimeoutRef.current);
                registrationTimeoutRef.current = null;
            }

            setStatus(prev => ({
                ...prev,
                isRegistered: true,
                extension: sipConfig.extension,
                callStatus: 'Registrado'
            }));
        });

        ua.on('disconnected', () => {
            if (registrationTimeoutRef.current) {
                clearTimeout(registrationTimeoutRef.current);
                registrationTimeoutRef.current = null;
            }

            setStatus(prev => ({
                ...prev,
                isConnected: false,
                isRegistered: false,
                inCall: false,
                callStatus: 'Desconectado'
            }));
        });

        ua.on('registrationFailed', (e: any) => {
            if (registrationTimeoutRef.current) {
                clearTimeout(registrationTimeoutRef.current);
                registrationTimeoutRef.current = null;
            }

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
                // Extrai o ramal do chamador
                const remoteIdentity = session.remote_identity.uri.user;

                setStatus(prev => ({
                    ...prev,
                    callStatus: 'Chamada recebida',
                    incomingCall: {
                        callerExtension: remoteIdentity,
                        session: session
                    }
                }));

                // NÃO atende automaticamente - aguarda o usuário clicar
                sessionRef.current = session;

                session.on('ended', () => {
                    setStatus(prev => ({
                        ...prev,
                        inCall: false,
                        callStatus: 'Chamada encerrada',
                        incomingCall: undefined
                    }));
                });

                session.on('failed', () => {
                    setStatus(prev => ({
                        ...prev,
                        inCall: false,
                        callStatus: 'Chamada falhou',
                        incomingCall: undefined
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
    }, [config]);

    const makeCall = (destination: string) => {
        if (!status.isRegistered) {
            console.error('UA não está registrada');
            return;
        }

        setStatus(prev => ({
            ...prev,
            inCall: true,
            callStatus: 'Chamando...',
            callConfirmed: false
        }));

        const session = uaRef.current.call(destination, {
            mediaConstraints: { audio: hasMicrophone, video: false },
            rtcOfferConstraints: {
                offerToReceiveAudio: true,
            },
        });

        sessionRef.current = session;
        attachRemoteAudio(session);

        session.on('confirmed', () => {
            setStatus(prev => ({ ...prev, callStatus: 'Em chamada', callConfirmed: true }));
        });

        session.on('ended', () => {
            setStatus(prev => ({
                ...prev,
                inCall: false,
                callStatus: 'Chamada encerrada',
                callConfirmed: false
            }));
        });

        session.on('failed', (e: any) => {
            setStatus(prev => ({
                ...prev,
                inCall: false,
                callStatus: 'Chamada falhou: ' + e.cause,
                callConfirmed: false
            }));
        });
    };

    const hangup = () => {
        console.log('[SIP] Hangup chamado - encerrando chamada');

        if (sessionRef.current) {
            try {
                console.log('[SIP] Terminando sessão...');
                sessionRef.current.terminate();
            } catch (error) {
                console.error('[SIP] Erro ao terminar sessão:', error);
            } finally {
                sessionRef.current = null;
            }
        } else {
            console.warn('[SIP] Nenhuma sessão ativa para encerrar');
        }

        setStatus(prev => ({
            ...prev,
            inCall: false,
            callStatus: 'Desligado',
            callConfirmed: false,
            incomingCall: undefined
        }));
    };

    const answerCall = () => {
        if (status.incomingCall?.session) {
            const session = status.incomingCall.session;

            session.answer({
                mediaConstraints: { audio: hasMicrophone, video: false },
            });

            attachRemoteAudio(session);

            setStatus(prev => ({
                ...prev,
                inCall: true,
                callStatus: 'Em chamada',
                incomingCall: undefined
            }));
        }
    };

    return {
        status,
        remoteAudioRef,
        connect: setConfig,
        makeCall,
        hangup,
        answerCall
    };
};
