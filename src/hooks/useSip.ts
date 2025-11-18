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
        const requestPermissions = async () => {
            try {
                console.log('%c🔐 SOLICITANDO PERMISSÕES DE SEGURANÇA 🔐', 'background: #ff9800; color: white; font-size: 14px; font-weight: bold; padding: 10px;');

                // Tenta solicitar câmera + áudio primeiro
                try {
                    console.log('[Permissões] Solicitando Câmera + Áudio + Microfone...');
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true
                        }
                    });
                    console.log('%c✅ PERMISSÕES CONCEDIDAS: Câmera + Áudio + Microfone', 'color: #4CAF50; font-weight: bold; font-size: 12px;');
                    setHasMicrophone(true);
                    stream.getTracks().forEach(track => track.stop());
                    return;
                } catch (cameraError: any) {
                    console.warn(`[Permissões] Câmera falhou (${cameraError.name}), tentando apenas áudio...`);

                    // Se câmera falhar, tenta apenas áudio
                    try {
                        console.log('[Permissões] Solicitando Áudio + Microfone...');
                        const audioStream = await navigator.mediaDevices.getUserMedia({
                            audio: {
                                echoCancellation: true,
                                noiseSuppression: true,
                                autoGainControl: true
                            }
                        });
                        console.log('%c✅ PERMISSÕES CONCEDIDAS: Áudio + Microfone', 'color: #4CAF50; font-weight: bold; font-size: 12px;');
                        setHasMicrophone(true);
                        audioStream.getTracks().forEach(track => track.stop());
                        return;
                    } catch (audioError: any) {
                        console.error('%c❌ PERMISSÕES NEGADAS', 'background: #f44336; color: white; font-weight: bold; font-size: 12px; padding: 5px;');
                        console.error(`Erro: ${audioError.name} - ${audioError.message}`);

                        // Mostra instruções detalhadas
                        console.log('%c📋 COMO RESOLVER ESTE PROBLEMA:', 'background: #2196F3; color: white; font-weight: bold; font-size: 12px; padding: 5px;');
                        console.log('%c1. Clique no ícone de cadeado na barra de endereço', 'color: #2196F3; font-size: 11px;');
                        console.log('%c2. Procure por "Câmera" e "Microfone"', 'color: #2196F3; font-size: 11px;');
                        console.log('%c3. Altere para "Permitir" em ambas', 'color: #2196F3; font-size: 11px;');
                        console.log('%c4. Recarregue a página (F5)', 'color: #2196F3; font-size: 11px;');
                        console.log('%c\n⚠️  SE AINDA NÃO FUNCIONAR:', 'background: #ff9800; color: white; font-weight: bold; font-size: 11px; padding: 3px;');
                        console.log('%c• Use HTTPS (https://192.168.0.250:5173)', 'color: #ff9800; font-size: 10px;');
                        console.log('%c• Não use HTTP localhost', 'color: #ff9800; font-size: 10px;');
                        console.log('%c• Algumas permissões requerem conexão segura', 'color: #ff9800; font-size: 10px;');

                        setHasMicrophone(false);
                    }
                }
            } catch (error) {
                console.error('[Permissões] Erro geral:', error);
                setHasMicrophone(false);
            }
        };

        // Executa imediatamente
        requestPermissions();
    }, []);

    const attachRemoteAudio = (session: any) => {
        let retries = 0;
        const maxRetries = 50; // 5 segundos com polling de 100ms

        const tryAttachAudio = () => {
            if (remoteAudioRef.current) {
                console.log('[Audio] Ref encontrado após retentativas:', retries);
                session.connection.addEventListener('track', (event: any) => {
                    const [stream] = event.streams;
                    console.log('[Audio] Track recebido:', event.track.kind);
                    if (remoteAudioRef.current) {
                        remoteAudioRef.current.srcObject = stream;
                        remoteAudioRef.current.volume = 1;
                        remoteAudioRef.current.play().catch((err) => {
                            console.error('[Audio] Erro ao reproduzir:', err);
                        });
                        console.log('[Audio] Stream configurado e iniciando reprodução');
                    }
                });
                return;
            }

            if (retries < maxRetries) {
                retries++;
                setTimeout(tryAttachAudio, 100);
            } else {
                console.error('[Audio] remoteAudioRef não encontrado após múltiplas tentativas');
            }
        };

        tryAttachAudio();
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
