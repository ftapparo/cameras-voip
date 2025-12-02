/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import JsSIP from 'jssip';
import { useCallHistory } from '../contexts/CallHistoryContext';

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

export interface UseSipProps {
    onCallEnded?: () => void;
}

export const useSip = (props?: UseSipProps) => {
    const onCallEndedCallback = props?.onCallEnded;
    const { addCall, markCallAnswered } = useCallHistory();
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
    
    // Ref para controlar chamadas ativas (para rejeição automática)
    const callStateRef = useRef<{ inCall: boolean; incomingCall: boolean }>({ inCall: false, incomingCall: false });

    // Detecção e limpeza de estados órfãos na inicialização
    useEffect(() => {
        console.log('[SIP] Inicializando hook - verificando estados órfãos');
        
        // Verifica se há indícios de estados inconsistentes após reload
        // Não usamos status aqui pois queremos verificar apenas na inicialização
        const hasInconsistentState = (
            sessionRef.current || 
            sessionStateRef.current
        );
        
        if (hasInconsistentState) {
            console.log('[SIP] Estado inconsistente detectado na inicialização - limpando');
            
            // Força limpeza de todos os estados
            if (sessionStateRef.current) {
                sessionStateRef.current = null;
            }
            if (sessionRef.current) {
                sessionRef.current = null;
            }
            
            callStateRef.current = { inCall: false, incomingCall: false };
            
            setStatus({
                isConnected: false,
                isRegistered: false,
                inCall: false,
                callStatus: 'Estado limpo após reload da página',
                callConfirmed: false
            });
            
            console.log('[SIP] Estados órfãos limpos');
        }
    }, []); // Executa apenas na inicialização

    // Atualiza callStateRef quando status muda
    useEffect(() => {
        callStateRef.current = {
            inCall: status.inCall,
            incomingCall: !!status.incomingCall
        };
    }, [status.inCall, status.incomingCall]);

    // IMPORTANTE: Mantém referência ao objeto de session para evitar garbage collection
    // Isso é crítico em Electron onde o GC pode ser mais agressivo
    const sessionStateRef = useRef<{
        session: any;
        listeners: Map<string, any>;
        keepAliveTimer?: number;
        diagnosticTimeout?: number;
    } | null>(null);

    // Verifica se há microfone disponível e pede permissão
    useEffect(() => {
        const checkMicrophone = async () => {
            try {
                console.log('[Microfone] Iniciando verificação de dispositivos...');
                
                // Verifica se há dispositivos de áudio disponíveis
                const devices = await navigator.mediaDevices.enumerateDevices();
                const audioInputs = devices.filter(device => device.kind === 'audioinput');
                
                console.log(`[Microfone] Total de dispositivos encontrados: ${devices.length}`);
                console.log(`[Microfone] Dispositivos de entrada de áudio: ${audioInputs.length}`);
                
                // Lista os dispositivos para debug
                audioInputs.forEach((device, index) => {
                    console.log(`[Microfone] Dispositivo ${index + 1}: ${device.label || 'Dispositivo sem nome'} (${device.deviceId})`);
                });

                if (audioInputs.length > 0) {
                    console.log(`[Microfone] ${audioInputs.length} microfone(s) detectado(s)`);

                    // Pede permissão para usar o microfone
                    try {
                        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        console.log('[Microfone] ✅ Permissão concedida - microfone funcionando');
                        setHasMicrophone(true);
                        // Para o stream imediatamente, só queríamos verificar a permissão
                        stream.getTracks().forEach(track => track.stop());
                    } catch (permissionError) {
                        console.warn('[Microfone] ❌ Permissão negada ou erro:', permissionError);
                        setHasMicrophone(false);
                    }
                } else {
                    console.log('[Microfone] ❌ Nenhum microfone detectado');
                    setHasMicrophone(false);
                }
            } catch (error) {
                console.error('[Microfone] ❌ Erro ao verificar dispositivos:', error);
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

    // Inicializar UA quando configuração for definida
    useEffect(() => {
        if (!config) return;

        console.log('[SIP] useEffect: iniciando UA com config');
        
        // LIMPEZA PREVENTIVA ANTES DE INICIALIZAR NOVA CONEXÃO
        console.log('[SIP] Realizando limpeza preventiva antes de nova conexão');
        
        // 1. Reset completo do estado
        setStatus({
            isConnected: false,
            isRegistered: false,
            inCall: false,
            callConfirmed: false,
            callStatus: 'Conectando...',
            incomingCall: undefined
        });
        
        // 2. Limpa referências de sessão órfãs
        if (sessionStateRef.current) {
            console.log('[SIP] Limpando sessionStateRef órfã');
            sessionStateRef.current = null;
        }
        
        // 3. Limpa sessão anterior se existir
        if (sessionRef.current) {
            try {
                console.log('[SIP] Forçando encerramento de sessão anterior');
                sessionRef.current.terminate();
            } catch (e) {
                console.warn('[SIP] Erro ao encerrar sessão anterior:', e);
            }
            sessionRef.current = null;
        }
        
        // 4. Limpa UA anterior se existir
        if (uaRef.current) {
            try {
                console.log('[SIP] Parando UA anterior');
                uaRef.current.stop();
            } catch (e) {
                console.warn('[SIP] Erro ao parar UA anterior:', e);
            }
            uaRef.current = null;
        }

        // 5. Limpa timeout anterior se existir
        if (registrationTimeoutRef.current) {
            clearTimeout(registrationTimeoutRef.current);
            registrationTimeoutRef.current = null;
        }
        
        // 6. Reset callStateRef
        callStateRef.current = { inCall: false, incomingCall: false };
        
        console.log('[SIP] Limpeza preventiva concluída');

        const socket = new JsSIP.WebSocketInterface(config.websocket);

        const ua = new JsSIP.UA({
            sockets: [socket],
            uri: config.uri,
            password: config.password,
            register: true,
            session_timers: false,
            use_preloaded_route: true,
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

            // LIMPEZA COMPLETA DE ESTADOS ÓRFÃOS APÓS ATUALIZAÇÃO DA PÁGINA
            console.log('[SIP] Ramal registrado - realizando limpeza completa de estados órfãos');
            
            // 1. Limpa qualquer referência de sessão antiga
            if (sessionStateRef.current) {
                console.log('[SIP] Limpando referência de sessão órfã');
                sessionStateRef.current = null;
            }
            
            if (sessionRef.current) {
                console.log('[SIP] Limpando sessionRef órfã');
                sessionRef.current = null;
            }
            
            // 2. Força encerramento de qualquer sessão ativa no UA - COM ENVIO DIRETO AO SERVIDOR
            try {
                if (uaRef.current) {
                    const sessions = (uaRef.current as any)._sessions;
                    if (sessions && Object.keys(sessions).length > 0) {
                        console.log('[SIP] Encontradas sessões ativas no servidor, forçando encerramento:', Object.keys(sessions).length);
                        Object.values(sessions).forEach((session: any) => {
                            try {
                                console.log('[SIP] Terminando sessão órfã no servidor:', session.id);
                                // Força terminação imediata sem aguardar resposta
                                session.terminate();
                                
                                // Se a sessão ainda existir, tenta método mais direto
                                setTimeout(() => {
                                    if (session && session.status !== 'terminated') {
                                        console.log('[SIP] Sessão ainda ativa, enviando BYE direto ao servidor');
                                        try {
                                            // Envia BYE diretamente para o servidor
                                            session.sendRequest('BYE', {
                                                eventHandlers: {
                                                    onSuccessResponse: () => console.log('[SIP] BYE aceito pelo servidor'),
                                                    onErrorResponse: () => console.log('[SIP] Erro no BYE, mas continuando'),
                                                    onTransportError: () => console.log('[SIP] Erro de transporte no BYE'),
                                                    onRequestTimeout: () => console.log('[SIP] Timeout no BYE'),
                                                }
                                            });
                                        } catch (byeError) {
                                            console.warn('[SIP] Erro ao enviar BYE direto:', byeError);
                                        }
                                    }
                                }, 100);
                                
                            } catch (e) {
                                console.warn('[SIP] Erro ao terminar sessão órfã:', e);
                            }
                        });
                        
                        // Força limpeza do objeto sessions do UA
                        try {
                            Object.keys(sessions).forEach(sessionId => {
                                delete sessions[sessionId];
                            });
                            console.log('[SIP] Sessions object limpo localmente');
                        } catch (cleanupError) {
                            console.warn('[SIP] Erro ao limpar sessions object:', cleanupError);
                        }
                        
                    } else {
                        console.log('[SIP] Nenhuma sessão ativa encontrada');
                    }
                }
            } catch (e) {
                console.warn('[SIP] Erro ao verificar sessões ativas:', e);
            }
            
            // 3. Limpa áudios órfãos
            if (remoteAudioRef.current) {
                try {
                    remoteAudioRef.current.pause();
                    remoteAudioRef.current.srcObject = null;
                    console.log('[SIP] Áudio remoto limpo');
                } catch (e) {
                    console.warn('[SIP] Erro ao limpar áudio remoto:', e);
                }
            }
            
            // 4. Reset completo do estado
            setStatus(prev => ({
                ...prev,
                isRegistered: true,
                extension: config.extension,
                callStatus: `Registrado como ${config.extension}`,
                inCall: false,
                callConfirmed: false,
                incomingCall: undefined
            }));
            
            // 5. Reset do callStateRef
            callStateRef.current = { inCall: false, incomingCall: false };
            
            console.log('[SIP] Limpeza completa finalizada - estado resetado');
        });

        ua.on('unregistered', () => {
            setStatus(prev => ({
                ...prev,
                isRegistered: false,
                inCall: false,
                callStatus: 'Desconectado do servidor SIP'
            }));
        });

        ua.on('registrationFailed', (data: any) => {
            // Limpa o timeout se o registro falhou
            if (registrationTimeoutRef.current) {
                clearTimeout(registrationTimeoutRef.current);
                registrationTimeoutRef.current = null;
            }

            setStatus(prev => ({
                ...prev,
                isConnected: false,
                isRegistered: false,
                callStatus: `Falha no registro: ${data.cause}`
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

                // Verifica se já há uma chamada ativa
                if (callStateRef.current.inCall || callStateRef.current.incomingCall) {
                    console.log('[SIP] Rejeitando chamada automaticamente - já há chamada ativa');
                    
                    // Registra como chamada rejeitada no histórico
                    addCall({
                        extension: remoteIdentity,
                        type: 'incoming',
                        status: 'rejected',
                        timestamp: new Date()
                    });
                    
                    // Rejeita automaticamente
                    session.terminate();
                    return;
                }

                // Registra a chamada recebida no histórico
                const callRecord = {
                    extension: remoteIdentity,
                    type: 'incoming' as const,
                    status: 'missed' as const, // Inicialmente como perdida, será atualizada se atender
                    timestamp: new Date()
                };
                
                const callId = addCall(callRecord);
                
                // Armazena o ID da chamada para posterior atualização
                (session as any)._callHistoryId = callId;

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
                    
                    // Chama o callback de encerramento se fornecido
                    if (onCallEndedCallback) {
                        onCallEndedCallback();
                    }
                });

                session.on('failed', (data_failed: any) => {
                    console.log('[SIP - newRTCSession] Evento: failed', data_failed);
                    setStatus(prev => ({
                        ...prev,
                        inCall: false,
                        callStatus: 'Chamada falhou: ' + data_failed.cause,
                        incomingCall: undefined
                    }));
                    
                    // Chama o callback de encerramento se fornecido
                    if (onCallEndedCallback) {
                        onCallEndedCallback();
                    }
                });

                session.on('rejected', (data_rejected: any) => {
                    console.log('[SIP - newRTCSession] Evento: rejected', data_rejected);
                });
            }
        });

        ua.start();
        uaRef.current = ua;

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
    }, [config, addCall, markCallAnswered]); // Dependências corretas

    // Monitoramento contínuo para detectar estados inconsistentes (chamadas órfãs)
    useEffect(() => {
        if (!uaRef.current?.isRegistered()) return;

        const checkOrphanedSessions = () => {
            try {
                // Verifica se há sessões no UA mas o estado local está inconsistente
                const sessions = (uaRef.current as any)?._sessions;
                const hasActiveSessions = sessions && Object.keys(sessions).length > 0;
                
                // CONDIÇÃO MAIS ESPECÍFICA: só age se realmente há sessões ativas E estado inconsistente
                if (hasActiveSessions && !status.inCall && !status.incomingCall && Object.keys(sessions).length > 0) {
                    console.warn('[SIP] DETECTADA CHAMADA ÓRFÃ: UA tem', Object.keys(sessions).length, 'sessões ativas mas estado local indica sem chamada');
                    
                    // Verifica se as sessões estão realmente ativas (não terminated)
                    const activeSessions = Object.values(sessions).filter((session: any) => 
                        session.status !== 'terminated' && session.status !== 'ended'
                    );
                    
                    if (activeSessions.length === 0) {
                        console.log('[SIP] Todas as sessões já estão terminadas, limpando referências');
                        // Apenas limpa as referências do objeto sessions
                        Object.keys(sessions).forEach(sessionId => {
                            delete sessions[sessionId];
                        });
                        return;
                    }
                    
                    console.log('[SIP] Terminando', activeSessions.length, 'sessões ativas órfãs');
                    
                    // Força limpeza apenas das sessões realmente ativas
                    activeSessions.forEach((session: any) => {
                        try {
                            console.log('[SIP] Terminando sessão órfã detectada:', session.id, 'status:', session.status);
                            session.terminate();
                        } catch (e) {
                            console.warn('[SIP] Erro ao terminar sessão órfã:', e);
                        }
                    });
                    
                    // Reset do estado apenas se necessário
                    setStatus(prev => ({
                        ...prev,
                        inCall: false,
                        callConfirmed: false,
                        incomingCall: undefined,
                        callStatus: 'Sessões órfãs detectadas e encerradas'
                    }));
                    
                    callStateRef.current = { inCall: false, incomingCall: false };
                    
                    if (sessionStateRef.current) {
                        sessionStateRef.current = null;
                    }
                    if (sessionRef.current) {
                        sessionRef.current = null;
                    }
                    
                    console.log('[SIP] Limpeza de sessões órfãs concluída');
                }
            } catch (e) {
                console.warn('[SIP] Erro no monitoramento de sessões órfãs:', e);
            }
        };

        // Aumenta intervalo para 5 segundos para evitar verificações excessivas
        const orphanCheckInterval = setInterval(checkOrphanedSessions, 5000);
        
        return () => {
            clearInterval(orphanCheckInterval);
        };
    }, [status.inCall, status.incomingCall]);

    const makeCall = (destination: string) => {
        if (!status.isRegistered) {
            console.error('UA não está registrada');
            return;
        }

        console.log('[SIP] Iniciando makeCall para:', destination);
        console.log('[SIP] Microfone disponível:', hasMicrophone);
        
        if (!hasMicrophone) {
            console.warn('[SIP] ⚠️  ATENÇÃO: Microfone não disponível - áudio será apenas de recepção!');
            console.warn('[SIP] Para áudio bidirecional, verifique permissões de microfone');
        } else {
            console.log('[SIP] ✅ Microfone disponível - áudio bidirecional habilitado');
        }
        
        // Registra chamada sainte no histórico
        const callRecord = {
            extension: destination,
            type: 'outgoing' as const,
            status: 'missed' as const, // Inicialmente como perdida, será atualizada se atender
            timestamp: new Date()
        };
        
        const callId = addCall(callRecord);
        
        console.log('[SIP] Iniciando chamada sem pausar vídeos de monitoramento');

        setStatus(prev => ({
            ...prev,
            inCall: true,
            callStatus: 'Chamando...',
            callConfirmed: false
        }));

        // Constraints simples - Issabel/Asterisk pode rejeitar constraints complexas
        // Usa microfone quando disponível para chamadas originadas
        const mediaConstraints = {
            audio: hasMicrophone, // ✅ CORRIGIDO: Usa microfone quando disponível
            video: false
        };

        console.log('[SIP] Media constraints:', mediaConstraints);
        console.log('[SIP] Microfone será usado:', hasMicrophone);

        // Configurações para comunicação bidirecional
        const session = uaRef.current.call(destination, {
            mediaConstraints: mediaConstraints,
            // Configurações para áudio bidirecional
            rtcOfferConstraints: {
                offerToReceiveAudio: true, // QUER receber áudio
                offerToReceiveVideo: false  // Não quer vídeo
            }
        });

        console.log('[SIP] Sessão criada, ID:', session?.id);

        // Timeout de diagnóstico - se em 10 segundos não houve progresso, algo está errado
        const diagnosticTimeout = setTimeout(() => {
            console.error('[SIP] DIAGNÓSTICO: Chamada sem progresso após 10 segundos');
            console.error('[SIP] Estado da sessão:', session.status);
            console.error('[SIP] Remote tag:', session.remote_tag);
            console.error('[SIP] Local tag:', session.local_tag);
            console.error('[SIP] Direction:', session.direction);
            console.error('[SIP] Start time:', session.start_time);
            
            // Tenta terminar a chamada se estiver travada
            if (session.status !== 'confirmed' && session.status !== 'ended') {
                console.error('[SIP] Forçando término da chamada travada');
                session.terminate();
            }
        }, 10000);

        // Armazena o ID da chamada para posterior atualização
        (session as any)._callHistoryId = callId;

        sessionRef.current = session;
        // IMPORTANTE: Mantém referência forte para evitar garbage collection
        sessionStateRef.current = {
            session: session,
            listeners: new Map(),
            diagnosticTimeout: diagnosticTimeout
        };

        attachRemoteAudio(session);

        // Log detalhado de eventos
        const onConfirmed = () => {
            console.log('[SIP] Evento: confirmed - Chamada confirmada');
            // Limpa timeout de diagnóstico
            if (sessionStateRef.current?.diagnosticTimeout) {
                clearTimeout(sessionStateRef.current.diagnosticTimeout);
                sessionStateRef.current.diagnosticTimeout = undefined;
            }
            
            // Marca chamada como atendida no histórico
            const callHistoryId = (session as any)._callHistoryId;
            if (callHistoryId) {
                markCallAnswered(callHistoryId);
            }
            
            setStatus(prev => ({ ...prev, callStatus: 'Em chamada', callConfirmed: true }));
        };

        const onEnded = (data: any) => {
            console.log('[SIP] Evento: ended - Chamada encerrada', data);
            // Limpa timeout de diagnóstico
            if (sessionStateRef.current?.diagnosticTimeout) {
                clearTimeout(sessionStateRef.current.diagnosticTimeout);
            }
            
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
            // Limpa timeout de diagnóstico
            if (sessionStateRef.current?.diagnosticTimeout) {
                clearTimeout(sessionStateRef.current.diagnosticTimeout);
            }
            
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
            // Limpa timeout de diagnóstico
            if (sessionStateRef.current?.diagnosticTimeout) {
                clearTimeout(sessionStateRef.current.diagnosticTimeout);
                sessionStateRef.current.diagnosticTimeout = undefined;
            }
        };

        const onProgress = (data: any) => {
            console.log('[SIP] Evento: progress - Progresso da chamada:', data);
            // Limpa timeout de diagnóstico no primeiro sinal de progresso
            if (sessionStateRef.current?.diagnosticTimeout) {
                clearTimeout(sessionStateRef.current.diagnosticTimeout);
                sessionStateRef.current.diagnosticTimeout = undefined;
            }
        };

        const onPeerConnection = (data: any) => {
            console.log('[SIP] Evento: peerconnection - Conexão P2P estabelecida');
            if (data.peerconnection) {
                const pc = data.peerconnection;
                console.log('[SIP] PeerConnection state:', pc.connectionState);
                console.log('[SIP] PeerConnection iceConnectionState:', pc.iceConnectionState);
                console.log('[SIP] PeerConnection signalingState:', pc.signalingState);

                // Log do SDP local se disponível
                if (pc.localDescription) {
                    console.log('[SIP] SDP Local (tipo:', pc.localDescription.type, ')');
                    console.log('[SIP] SDP:', pc.localDescription.sdp?.substring(0, 500));
                }

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

        // Chama o callback de encerramento se fornecido
        if (onCallEndedCallback) {
            onCallEndedCallback();
        }
    };

    const answerCall = () => {
        if (status.incomingCall?.session) {
            const session = status.incomingCall.session;

            console.log('[SIP] Respondendo chamada, session ID:', session?.id);
            console.log('[SIP] Microfone disponível:', hasMicrophone);

            if (!hasMicrophone) {
                console.warn('[SIP] ⚠️  ATENÇÃO: Microfone não disponível - apenas áudio de recepção!');
            } else {
                console.log('[SIP] ✅ Microfone disponível - áudio bidirecional habilitado');
            }

            // Constraints simples - Issabel/Asterisk pode rejeitar constraints complexas
            const mediaConstraints = {
                audio: hasMicrophone,
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
                
                // Marca chamada como atendida no histórico
                const callHistoryId = (session as any)._callHistoryId;
                if (callHistoryId) {
                    markCallAnswered(callHistoryId);
                }
                
                setStatus(prev => ({
                    ...prev,
                    inCall: true,
                    callStatus: 'Em chamada',
                    callConfirmed: true,
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

    // Método manual para forçar limpeza de chamadas presas no servidor
    const forceCleanupServer = () => {
        console.log('[SIP] LIMPEZA MANUAL: Forçando limpeza completa do servidor');
        
        if (!uaRef.current) {
            console.log('[SIP] UA não disponível para limpeza');
            return;
        }
        
        // Flag para evitar loops
        const isManualCleanup = true;
        
        // 1. Termina todas as sessões ativas
        try {
            const sessions = (uaRef.current as any)._sessions;
            if (sessions && Object.keys(sessions).length > 0) {
                console.log('[SIP] MANUAL: Terminando', Object.keys(sessions).length, 'sessões ativas');
                
                const activeSessions = Object.values(sessions).filter((session: any) => 
                    session.status !== 'terminated' && session.status !== 'ended'
                );
                
                if (activeSessions.length === 0) {
                    console.log('[SIP] MANUAL: Todas as sessões já estão terminadas');
                    // Apenas limpa as referências
                    Object.keys(sessions).forEach(sessionId => {
                        delete sessions[sessionId];
                    });
                } else {
                    activeSessions.forEach((session: any, index: number) => {
                        setTimeout(() => {
                            try {
                                console.log(`[SIP] MANUAL: Terminando sessão ${index + 1}:`, session.id);
                                session.terminate();
                                
                                // Força BYE direto apenas se necessário
                                setTimeout(() => {
                                    if (session && session.status !== 'terminated' && session.status !== 'ended') {
                                        console.log('[SIP] MANUAL: Enviando BYE direto para sessão:', session.id);
                                        session.sendRequest('BYE', {});
                                    }
                                }, 500);
                            } catch (e) {
                                console.warn('[SIP] MANUAL: Erro ao terminar sessão:', e);
                            }
                        }, index * 200); // Escalone as terminações
                    });
                }
            } else {
                console.log('[SIP] MANUAL: Nenhuma sessão ativa encontrada');
            }
        } catch (e) {
            console.warn('[SIP] MANUAL: Erro ao acessar sessões:', e);
        }
        
        // 2. Reset estado local IMEDIATAMENTE
        setStatus(prev => ({
            ...prev,
            inCall: false,
            callConfirmed: false,
            incomingCall: undefined,
            callStatus: 'Limpeza manual executada'
        }));
        
        callStateRef.current = { inCall: false, incomingCall: false };
        sessionStateRef.current = null;
        sessionRef.current = null;
        
        // 3. Opcional: Força desregistro/re-registro apenas se explicitamente necessário
        if (isManualCleanup) {
            setTimeout(() => {
                try {
                    console.log('[SIP] MANUAL: Executando desregistro único');
                    if (uaRef.current && uaRef.current.isRegistered()) {
                        uaRef.current.unregister({ 
                            all: true,
                            eventHandlers: {
                                onSuccessResponse: () => {
                                    console.log('[SIP] MANUAL: Desregistro manual bem-sucedido');
                                    // Re-registra apenas uma vez
                                    setTimeout(() => {
                                        if (uaRef.current && !uaRef.current.isRegistered()) {
                                            console.log('[SIP] MANUAL: Re-registrando uma única vez');
                                            uaRef.current.register();
                                        }
                                    }, 1500);
                                },
                                onErrorResponse: () => {
                                    console.log('[SIP] MANUAL: Erro no desregistro, tentando re-registro');
                                    setTimeout(() => {
                                        if (uaRef.current) {
                                            uaRef.current.register();
                                        }
                                    }, 1500);
                                }
                            }
                        });
                    }
                } catch (e) {
                    console.warn('[SIP] MANUAL: Erro no desregistro manual:', e);
                }
            }, 2000);
        }
    };

    return {
        status,
        remoteAudioRef,
        connect: setConfig,
        makeCall,
        hangup,
        answerCall,
        forceCleanupServer
    };
};
