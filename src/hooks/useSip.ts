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

    // IMPORTANTE: Mantém referência ao objeto de session para evitar garbage collection
    // Isso é crítico em Electron onde o GC pode ser mais agressivo
    const sessionStateRef = useRef<{
        session: any;
        listeners: Map<string, any>;
        keepAliveTimer?: number;
    } | null>(null);

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
        console.log('[Audio] Iniciando attachRemoteAudio, remoteAudioRef.current:', remoteAudioRef.current);

        // Configura listener para receber o áudio ANTES de qualquer coisa
        // Isso garante que o stream será capturado assim que disponível
        const handleTrack = (event: any) => {
            console.log('[Audio] Track recebido:', event.track.kind);
            const [stream] = event.streams;

            if (stream) {
                console.log('[Audio] Stream disponível, tentando atribuir...');

                // Tenta usar remoteAudioRef se disponível
                if (remoteAudioRef.current) {
                    remoteAudioRef.current.srcObject = stream;
                    remoteAudioRef.current.volume = 1;
                    remoteAudioRef.current.play().catch((err) => {
                        console.error('[Audio] Erro ao reproduzir:', err);
                    });
                    console.log('[Audio] Stream configurado e reprodução iniciada via ref');
                } else {
                    // Fallback: cria um elemento audio se o ref não existir
                    console.warn('[Audio] remoteAudioRef.current não encontrado, criando audio element de fallback');
                    const audioElement = document.createElement('audio');
                    audioElement.autoplay = true;
                    audioElement.srcObject = stream;
                    audioElement.volume = 1;
                    audioElement.style.display = 'none';
                    document.body.appendChild(audioElement);
                    console.log('[Audio] Audio element criado e adicionado ao DOM');
                }
            }
        };

        // Tenta anexar listener ao connection se disponível
        if (session.connection) {
            console.log('[Audio] session.connection disponível, adicionando listener de track');
            session.connection.addEventListener('track', handleTrack);
        } else {
            console.warn('[Audio] session.connection não está disponível ainda');

            // Aguarda um pouco e tenta novamente (race condition comum)
            let retries = 0;
            const tryConnect = () => {
                if (session.connection) {
                    console.log('[Audio] session.connection agora disponível (retry #', retries, ')');
                    session.connection.addEventListener('track', handleTrack);
                } else if (retries < 10) {
                    retries++;
                    setTimeout(tryConnect, 100);
                } else {
                    console.error('[Audio] session.connection nunca ficou disponível após retries');
                }
            };
            setTimeout(tryConnect, 50);
        }
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

            console.log('[SIP] Evento newRTCSession:', {
                originator: data.originator,
                sessionId: session?.id,
                remoteUser: data.originator === 'remote' ? session?.remote_identity?.uri?.user : 'N/A'
            });

            if (data.originator === 'remote') {
                // Extrai o ramal do chamador
                const remoteIdentity = session.remote_identity.uri.user;

                console.log('[SIP] Chamada recebida do ramal:', remoteIdentity);

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

                session.on('ended', (data_ended: any) => {
                    console.log('[SIP - newRTCSession] Evento: ended', data_ended);
                    setStatus(prev => ({
                        ...prev,
                        inCall: false,
                        callStatus: 'Chamada encerrada',
                        incomingCall: undefined
                    }));
                });

                session.on('failed', (data_failed: any) => {
                    console.log('[SIP - newRTCSession] Evento: failed', data_failed);
                    setStatus(prev => ({
                        ...prev,
                        inCall: false,
                        callStatus: 'Chamada falhou: ' + data_failed.cause,
                        incomingCall: undefined
                    }));
                });

                session.on('rejected', (data_rejected: any) => {
                    console.log('[SIP - newRTCSession] Evento: rejected', data_rejected);
                });
            }
        });

        ua.start();
        uaRef.current = ua;
    };

    // Inicializar UA quando configuração for definida
    useEffect(() => {
        if (!config) return;

        console.log('[SIP] useEffect: iniciando UA com config');
        startUA(config);

        return () => {
            console.log('[SIP] useEffect cleanup: parando UA');

            // Limpa listeners e referências
            if (sessionStateRef.current) {
                console.log('[SIP] Limpando sessionStateRef');
                sessionStateRef.current.listeners.clear();
                sessionStateRef.current = null;
            }

            if (sessionRef.current) {
                try {
                    sessionRef.current.terminate();
                } catch (e) {
                    console.warn('[SIP] Erro ao terminar sessão no cleanup:', e);
                }
                sessionRef.current = null;
            }

            if (uaRef.current) {
                uaRef.current.stop();
                uaRef.current = null;
            }

            if (registrationTimeoutRef.current) {
                clearTimeout(registrationTimeoutRef.current);
                registrationTimeoutRef.current = null;
            }
        };
    }, [config]);

    const makeCall = (destination: string) => {
        if (!status.isRegistered) {
            console.error('UA não está registrada');
            return;
        }

        console.log('[SIP] Iniciando makeCall para:', destination);
        console.log('[SIP] Microfone disponível:', hasMicrophone);

        setStatus(prev => ({
            ...prev,
            inCall: true,
            callStatus: 'Chamando...',
            callConfirmed: false
        }));

        // Constraints mais robustas para Electron
        const mediaConstraints: any = {
            audio: hasMicrophone ? {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            } : false,
            video: false
        };

        console.log('[SIP] Media constraints:', mediaConstraints);

        const session = uaRef.current.call(destination, {
            mediaConstraints: mediaConstraints,
            rtcOfferConstraints: {
                offerToReceiveAudio: true,
                offerToReceiveVideo: false,
            },
        });

        console.log('[SIP] Sessão criada, ID:', session?.id);

        sessionRef.current = session;
        // IMPORTANTE: Mantém referência forte para evitar garbage collection
        sessionStateRef.current = {
            session: session,
            listeners: new Map()
        };

        attachRemoteAudio(session);

        // Log detalhado de eventos
        const onConfirmed = () => {
            console.log('[SIP] Evento: confirmed - Chamada confirmada');
            setStatus(prev => ({ ...prev, callStatus: 'Em chamada', callConfirmed: true }));
        };

        const onEnded = (data: any) => {
            console.log('[SIP] Evento: ended - Chamada encerrada', data);
            sessionStateRef.current = null; // Limpa referência
            setStatus(prev => ({
                ...prev,
                inCall: false,
                callStatus: 'Chamada encerrada',
                callConfirmed: false
            }));
        };

        const onFailed = (e: any) => {
            console.log('[SIP] Evento: failed - Chamada falhou. Causa:', e.cause);
            console.log('[SIP] Dados completos do erro:', e);
            sessionStateRef.current = null; // Limpa referência
            setStatus(prev => ({
                ...prev,
                inCall: false,
                callStatus: 'Chamada falhou: ' + e.cause,
                callConfirmed: false
            }));
        };

        const onAccepted = () => {
            console.log('[SIP] Evento: accepted - Chamada aceita pelo servidor');
        };

        const onProgress = (data: any) => {
            console.log('[SIP] Evento: progress - Progresso da chamada:', data);
        };

        const onPeerConnection = (data: any) => {
            console.log('[SIP] Evento: peerconnection - Conexão P2P estabelecida');
            if (data.peerconnection) {
                const pc = data.peerconnection;
                console.log('[SIP] PeerConnection state:', pc.connectionState);
                console.log('[SIP] PeerConnection iceConnectionState:', pc.iceConnectionState);
                console.log('[SIP] PeerConnection signalingState:', pc.signalingState);

                // Monitora mudanças de estado
                pc.onconnectionstatechange = () => {
                    console.log('[SIP] PeerConnection connectionState:', pc.connectionState);
                };

                pc.oniceconnectionstatechange = () => {
                    console.log('[SIP] PeerConnection iceConnectionState:', pc.iceConnectionState);
                };

                pc.onsignalingstatechange = () => {
                    console.log('[SIP] PeerConnection signalingState:', pc.signalingState);
                };

                // Monitora ICE candidates
                pc.onicecandidate = (event: any) => {
                    if (event.candidate) {
                        console.log('[SIP] ICE candidate adicionado:', event.candidate.candidate?.substring(0, 100));
                    } else {
                        console.log('[SIP] Coleta de ICE candidates completa');
                    }
                };
            }
        };

        // Adiciona listeners para eventos adicionais que podem causar desconexão
        const onHold = () => {
            console.log('[SIP] Evento: hold - Chamada colocada em espera');
        };

        const onUnhold = () => {
            console.log('[SIP] Evento: unhold - Chamada retomada');
        };

        const onMute = (data: any) => {
            console.log('[SIP] Evento: mute', data);
        };

        const onUnmute = (data: any) => {
            console.log('[SIP] Evento: unmute', data);
        };

        // Registra listeners principais
        session.on('confirmed', onConfirmed);
        session.on('ended', onEnded);
        session.on('failed', onFailed);
        session.on('accepted', onAccepted);
        session.on('progress', onProgress);
        session.on('peerconnection', onPeerConnection);
        session.on('hold', onHold);
        session.on('unhold', onUnhold);
        session.on('muted', onMute);
        session.on('unmuted', onUnmute);

        // Armazena listeners no ref para possível cleanup posterior
        if (sessionStateRef.current) {
            sessionStateRef.current.listeners.set('confirmed', onConfirmed);
            sessionStateRef.current.listeners.set('ended', onEnded);
            sessionStateRef.current.listeners.set('failed', onFailed);
            sessionStateRef.current.listeners.set('accepted', onAccepted);
            sessionStateRef.current.listeners.set('progress', onProgress);
            sessionStateRef.current.listeners.set('peerconnection', onPeerConnection);
            sessionStateRef.current.listeners.set('hold', onHold);
            sessionStateRef.current.listeners.set('unhold', onUnhold);
            sessionStateRef.current.listeners.set('muted', onMute);
            sessionStateRef.current.listeners.set('unmuted', onUnmute);
        }

        console.log('[SIP] Listeners configurados para a sessão');
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

        // Limpa referências
        if (sessionStateRef.current) {
            console.log('[SIP] Limpando listeners e referências');
            sessionStateRef.current.listeners.clear();
            sessionStateRef.current = null;
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

            console.log('[SIP] Respondendo chamada, session ID:', session?.id);
            console.log('[SIP] Microfone disponível:', hasMicrophone);

            // Constraints mais robustas para Electron
            const mediaConstraints: any = {
                audio: hasMicrophone ? {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } : false,
                video: false
            };

            console.log('[SIP] Media constraints para resposta:', mediaConstraints);

            session.answer({
                mediaConstraints: mediaConstraints,
            });

            // IMPORTANTE: Mantém referência forte para evitar garbage collection
            sessionStateRef.current = {
                session: session,
                listeners: new Map()
            };

            attachRemoteAudio(session);
            // Adiciona listeners para a sessão de entrada
            const onConfirmed = () => {
                console.log('[SIP - Incoming] Evento: confirmed');
                setStatus(prev => ({
                    ...prev,
                    inCall: true,
                    callStatus: 'Em chamada',
                    incomingCall: undefined
                }));
            };

            const onEnded = (data: any) => {
                console.log('[SIP - Incoming] Evento: ended', data);
                sessionStateRef.current = null; // Limpa referência
                setStatus(prev => ({
                    ...prev,
                    inCall: false,
                    callStatus: 'Chamada encerrada',
                    incomingCall: undefined
                }));
            };

            const onFailed = (e: any) => {
                console.log('[SIP - Incoming] Evento: failed:', e.cause);
                sessionStateRef.current = null; // Limpa referência
                setStatus(prev => ({
                    ...prev,
                    inCall: false,
                    callStatus: 'Chamada falhou: ' + e.cause,
                    incomingCall: undefined
                }));
            };

            const onPeerConnection = (data: any) => {
                console.log('[SIP - Incoming] Evento: peerconnection');
                if (data.peerconnection) {
                    const pc = data.peerconnection;
                    console.log('[SIP - Incoming] PeerConnection state:', pc.connectionState);
                    pc.onconnectionstatechange = () => {
                        console.log('[SIP - Incoming] PeerConnection connectionState:', pc.connectionState);
                    };
                }
            };

            session.on('confirmed', onConfirmed);
            session.on('ended', onEnded);
            session.on('failed', onFailed);
            session.on('peerconnection', onPeerConnection);

            // Armazena listeners
            if (sessionStateRef.current) {
                sessionStateRef.current.listeners.set('confirmed', onConfirmed);
                sessionStateRef.current.listeners.set('ended', onEnded);
                sessionStateRef.current.listeners.set('failed', onFailed);
                sessionStateRef.current.listeners.set('peerconnection', onPeerConnection);
            }

            console.log('[SIP] Listeners de incoming call configurados');
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
