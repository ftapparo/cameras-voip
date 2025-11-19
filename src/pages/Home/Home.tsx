import React from 'react';
import axios from 'axios';
import { CameraPlayer } from '../../components/CameraPlayer/CameraPlayer';
import { VoipCamera } from '../../components/VoipCamera/VoipCamera';
import { IncomingCall } from '../../components/IncomingCall/IncomingCall';
import { SipStatusBar } from '../../components/SipStatusBar/SipStatusBar';
import { useSip } from '../../hooks/useSip';
import { Box, Typography } from '@mui/material';

interface Camera {
    id: number;
    description: string;
    extension: string;
}

const Home: React.FC = () => {
    // Hook SIP
    const { status, remoteAudioRef, connect, answerCall, hangup, makeCall } = useSip();

    // Debug: log quando o ref é criado
    React.useEffect(() => {
        console.log('[Home] remoteAudioRef:', remoteAudioRef);
        console.log('[Home] remoteAudioRef.current:', remoteAudioRef?.current);

        // Garantir que o elemento audio está no DOM
        const audioElement = remoteAudioRef?.current;
        if (audioElement) {
            if (!audioElement.parentElement) {
                console.warn('[Home] Adicionando elemento audio ao DOM');
                document.body.appendChild(audioElement);
            }

            console.log('[Home] Elemento audio configurado:', {
                autoplay: audioElement.autoplay,
                muted: audioElement.muted,
                parentElement: audioElement.parentElement?.tagName
            });
        }
    }, [remoteAudioRef]);    // Estado para armazenar as câmeras carregadas da API
    const [cameras, setCameras] = React.useState<Camera[]>([]);
    const [loading, setLoading] = React.useState(true);

    // Carregar câmeras da API (máximo de 14)
    React.useEffect(() => {
        const fetchCameras = async () => {
            try {
                const response = await axios.get('https://rtsp.condominionovaresidence.com/api/v1/camera/list');
                // Limita para as 14 primeiras câmeras
                setCameras(response.data.cameras.slice(0, 14));
                setLoading(false);
            } catch (error) {
                console.error('Erro ao carregar câmeras:', error);
                setLoading(false);
            }
        };

        fetchCameras();
    }, []);

    // Estado para controlar quantas câmeras estão visíveis
    const [visibleCount, setVisibleCount] = React.useState(1);

    // Estado para a área VoIP
    const [voipUrl, setVoipUrl] = React.useState<string | undefined>(undefined);
    const [voipKey, setVoipKey] = React.useState(0);
    const [voipCameraId, setVoipCameraId] = React.useState<number | undefined>(undefined);
    const [isVoipCameraLoading, setIsVoipCameraLoading] = React.useState(false);

    // Estado para controlar chamada ativa (de ramal sem câmera)
    const [activeCallExtension, setActiveCallExtension] = React.useState<string | undefined>(undefined);

    // Estado para controlar chamada sainte (outgoing call)
    const [isOutgoingCall, setIsOutgoingCall] = React.useState(false);

    // Refs para os sons
    const phoneRingRef = React.useRef<HTMLAudioElement | null>(null);
    const phoneCallRef = React.useRef<HTMLAudioElement | null>(null);

    // Ref para prevenir múltiplos hangups simultâneos
    const isHangingUpRef = React.useRef(false);

    // Callback para quando o VoipCamera termina de carregar
    const handleVoipCameraLoadingComplete = React.useCallback(() => {
        console.log('[Home] VoipCamera carregamento completo, desbloqueando');
        setIsVoipCameraLoading(false);
    }, []);

    // Timeout de 10 segundos para desbloquear câmeras automaticamente
    React.useEffect(() => {
        if (!isVoipCameraLoading) {
            console.log('[Home] isVoipCameraLoading é FALSE, desactivando timeout');
            return;
        }

        console.log('[Home] 🔒 Iniciando timeout de 10s para desbloquear câmeras');
        console.log('[Home] isVoipCameraLoading:', isVoipCameraLoading);

        const timeoutId = setTimeout(() => {
            console.log('[Home] ⏱️ Timeout de 10s ATINGIDO, desbloqueando câmeras');
            setIsVoipCameraLoading(false);
        }, 10000); // 10 segundos

        return () => {
            clearTimeout(timeoutId);
        };
    }, [isVoipCameraLoading]);

    // Wrapper seguro para hangup
    const safeHangup = React.useCallback(() => {
        if (isHangingUpRef.current) {
            console.log('[Hangup] Já está encerrando, ignorando clique duplicado');
            return;
        }

        isHangingUpRef.current = true;
        console.log('[Hangup] Iniciando encerramento da chamada');

        hangup();

        // Reset do flag após um pequeno delay
        setTimeout(() => {
            isHangingUpRef.current = false;
            console.log('[Hangup] Flag resetado');
        }, 1000);
    }, [hangup]);

    React.useEffect(() => {
        if (visibleCount < cameras.length) {
            const timer = setTimeout(() => {
                setVisibleCount(visibleCount + 1);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [visibleCount, cameras.length]);

    const getCameraUrl = (cameraId: number, highDef = false) => {
        // highDef = true usa tipo 0 (alta definição), false usa tipo 1 (baixa)
        const type = highDef ? '0' : '1';
        return `wss://rtsp.condominionovaresidence.com/stream/${cameraId}/${type}`;
    };

    // Função para lidar com o clique em uma câmera pequena
    const handleCameraClick = (cameraId: number) => {
        console.log('[Home] handleCameraClick chamado para câmera:', cameraId);
        console.log('[Home] Estado atual:', {
            isVoipCameraLoading,
            voipCameraId,
            incomingCall: status.incomingCall,
            inCall: status.inCall,
            isOutgoingCall
        });

        // Bloqueia troca de câmera durante chamadas
        if (status.incomingCall || status.inCall || isOutgoingCall) {
            console.log('[Home] ❌ Troca de câmera bloqueada durante chamada');
            return;
        }

        // Bloqueia cliques rápidos enquanto carrega câmera
        if (isVoipCameraLoading) {
            console.log('[Home] ❌ Clique ignorado: câmera ainda está carregando. ID atual:', voipCameraId);
            return;
        }

        // Se a câmera clicada é a mesma que está carregando, ignora
        if (voipCameraId === cameraId && isVoipCameraLoading) {
            console.log('[Home] ❌ Mesma câmera já está carregando');
            return;
        }

        const highDefUrl = getCameraUrl(cameraId, true);

        console.log(`[Home] ✅ Câmera ${cameraId} clicada. URL HD: ${highDefUrl}`);

        // Marca como carregando ANTES de mudar a URL
        setIsVoipCameraLoading(true);
        console.log('[Home] ✅ isVoipCameraLoading definido como TRUE');
        console.log('[Home] 🔒 Bloqueio ATIVADO - nenhuma câmera pode ser clicada até carregamento completar');

        // Muda a URL (isso vai disparar o carregamento no VoipCamera)
        setVoipUrl(highDefUrl);
        setVoipCameraId(cameraId); // Armazena o ID da câmera atual
    };

    // Função para iniciar chamada sainte (outgoing call)
    const handleOutgoingCall = () => {
        // Encontra a câmera correspondente ao voipCameraId atual
        const currentCamera = cameras.find(cam => cam.id === voipCameraId);

        // Verifica se a câmera tem extension (tem interfone)
        if (!currentCamera) {
            console.warn('Nenhuma câmera selecionada');
            return;
        }

        if (!currentCamera.extension) {
            console.warn('Câmera sem interfone (extension null)');
            return;
        }

        console.log(`Iniciando chamada para extension: ${currentCamera.extension}`);

        // Toca o som ANTES de fazer a chamada
        if (phoneCallRef.current) {
            phoneCallRef.current.loop = true;
            phoneCallRef.current.play().catch(err => console.error('Erro ao tocar phone-call:', err));
        }

        setIsOutgoingCall(true);
        makeCall(currentCamera.extension);
    };

    // Detectar chamadas recebidas e carregar câmera automaticamente se disponível
    React.useEffect(() => {
        if (status.incomingCall) {
            const callerExtension = status.incomingCall.callerExtension;

            // Verifica se o ramal corresponde a uma câmera
            const camera = cameras.find(cam => cam.extension === callerExtension);

            if (camera) {
                // Carrega a câmera em alta definição
                const highDefUrl = getCameraUrl(camera.id, true);

                // Só atualiza se for uma câmera diferente
                if (voipUrl !== highDefUrl) {
                    setVoipUrl(highDefUrl);
                    setVoipKey(prev => prev + 1);
                }
                setActiveCallExtension(undefined); // Limpa chamada sem câmera se houver
            } else {
                // Marca que há uma chamada de ramal sem câmera
                setActiveCallExtension(callerExtension);
                setVoipUrl(undefined);
            }

            // Limpa chamada sainte se houver
            setIsOutgoingCall(false);
        } else if (status.inCall && activeCallExtension) {
            // Mantém activeCallExtension durante a chamada
            // Não faz nada aqui, apenas mantém o estado
        } else if (!status.inCall && !status.incomingCall) {
            // Limpa tudo quando não há chamada
            setActiveCallExtension(undefined);
            setIsOutgoingCall(false);
        }
    }, [status.incomingCall, status.inCall, cameras, activeCallExtension, voipUrl]);

    // Timeout de segurança para desbloquear loading se ninguém chamar o callback
    React.useEffect(() => {
        if (isVoipCameraLoading) {
            console.log('[Home] VoipCamera marcada como carregando, iniciando timer de 15s');
            const timer = setTimeout(() => {
                console.log('[Home] Timeout de carregamento atingido, desbloqueando');
                setIsVoipCameraLoading(false);
            }, 15000); // 15 segundos de timeout

            return () => clearTimeout(timer);
        }
    }, [isVoipCameraLoading]);

    // Tocar som quando receber chamada entrante (phone-ring.mp3)
    React.useEffect(() => {
        if (status.incomingCall && phoneRingRef.current) {
            phoneRingRef.current.loop = true;
            phoneRingRef.current.play().catch(err => console.error('Erro ao tocar phone-ring:', err));
        } else if (phoneRingRef.current) {
            phoneRingRef.current.pause();
            phoneRingRef.current.currentTime = 0;
        }
    }, [status.incomingCall]);

    // Parar som quando a chamada é confirmada/atendida ou cancelada (phone-call.mp3)
    React.useEffect(() => {
        console.log(`[Audio Debug] callConfirmed: ${status.callConfirmed}, isOutgoingCall: ${isOutgoingCall}, inCall: ${status.inCall}`);

        // Para o som quando:
        // 1. A chamada é confirmada (atendida)
        // 2. isOutgoingCall fica false (cancelou antes de atender)
        // 3. inCall fica false (chamada encerrada)
        if ((status.callConfirmed || !isOutgoingCall || !status.inCall) && phoneCallRef.current) {
            const shouldStop = status.callConfirmed || (!isOutgoingCall && phoneCallRef.current.currentTime > 0) || (!status.inCall && phoneCallRef.current.currentTime > 0);

            if (shouldStop) {
                console.log('[Audio] Parando phone-call.mp3');
                phoneCallRef.current.pause();
                phoneCallRef.current.currentTime = 0;
            }

            // Limpa o estado de outgoing call quando necessário
            if (isOutgoingCall && (status.callConfirmed || !status.inCall)) {
                setIsOutgoingCall(false);
            }
        }
    }, [status.callConfirmed, isOutgoingCall, status.inCall]);

    // Limpa estados quando a chamada é encerrada (proteção adicional)
    React.useEffect(() => {
        if (!status.inCall && !status.incomingCall) {
            console.log('[Cleanup] Limpando estados após chamada encerrada');

            // Para qualquer áudio que ainda esteja tocando
            if (phoneCallRef.current && phoneCallRef.current.currentTime > 0) {
                phoneCallRef.current.pause();
                phoneCallRef.current.currentTime = 0;
            }
            if (phoneRingRef.current && phoneRingRef.current.currentTime > 0) {
                phoneRingRef.current.pause();
                phoneRingRef.current.currentTime = 0;
            }

            // Limpa estados
            if (isOutgoingCall) {
                setIsOutgoingCall(false);
            }
        }
    }, [status.inCall, status.incomingCall, isOutgoingCall]);

    if (loading) {
        return (
            <Box sx={{ width: '100vw', height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="h5" color="white">Carregando câmeras...</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ width: '100vw', height: '100vh', background: '#000', m: 0, p: 0, overflow: 'hidden', position: 'fixed', top: 0, left: 0, display: 'flex', alignItems: 'stretch', justifyContent: 'stretch', paddingBottom: '50px' }}>
            <Box sx={{
                width: '100%',
                height: '100%',
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', // 4 colunas
                gridTemplateRows: 'repeat(5, minmax(0, 1fr))',    // 5 linhas
                gap: 0,
                m: 0,
                p: 0,
                overflow: 'hidden',
            }}>
                {/* Área VoIP - bloco 2x3 */}
                <Box
                    sx={{
                        gridColumn: '1 / 3',
                        gridRow: '1 / 4',
                        background: '#000',
                        border: '1px solid #333',
                        outline: status.incomingCall
                            ? 'none'
                            : (status.inCall || activeCallExtension)
                                ? '3px solid #f44336'
                                : 'none',
                        outlineOffset: '-3px',
                        display: 'flex',
                        alignItems: 'stretch',
                        justifyContent: 'stretch',
                        minWidth: 0,
                        minHeight: 0,
                        overflow: 'hidden',
                        animation: status.incomingCall ? 'blink-border 1s infinite' : 'none',
                        '@keyframes blink-border': {
                            '0%': {
                                outline: '3px solid rgba(244, 67, 54, 0.3)',
                                outlineOffset: '-3px'
                            },
                            '50%': {
                                outline: '3px solid rgba(244, 67, 54, 1)',
                                outlineOffset: '-3px'
                            },
                            '100%': {
                                outline: '3px solid rgba(244, 67, 54, 0.3)',
                                outlineOffset: '-3px'
                            }
                        }
                    }}
                >
                    {status.incomingCall ? (
                        // Há uma chamada recebida
                        voipUrl ? (
                            // Câmera identificada - mostra VoipCamera com botões Atender/Recusar
                            <VoipCamera
                                key={voipKey}
                                wsUrl={voipUrl}
                                onClick={answerCall}
                                isIncomingCall={true}
                                onReject={hangup}
                                onLoadingComplete={handleVoipCameraLoadingComplete}
                            />
                        ) : (
                            // Ramal sem câmera - mostra IncomingCall
                            <IncomingCall
                                callerExtension={status.incomingCall.callerExtension}
                                description={cameras.find(c => c.extension === status.incomingCall?.callerExtension)?.description}
                                onAnswer={answerCall}
                                isInCall={false}
                            />
                        )
                    ) : status.inCall && voipUrl ? (
                        // Chamada ativa com câmera - mostra VoipCamera com botão ENCERRAR
                        <VoipCamera
                            key={voipKey}
                            wsUrl={voipUrl}
                            isInCall={true}
                            onHangup={safeHangup}
                            onLoadingComplete={handleVoipCameraLoadingComplete}
                        />
                    ) : activeCallExtension ? (
                        // Chamada ativa de ramal sem câmera
                        <IncomingCall
                            callerExtension={activeCallExtension}
                            description={cameras.find(c => c.extension === activeCallExtension)?.description}
                            onAnswer={answerCall}
                            isInCall={true}
                            onHangup={safeHangup}
                        />
                    ) : isOutgoingCall && voipUrl ? (
                        // Chamada sainte em progresso (outgoing call)
                        <VoipCamera
                            key={voipKey}
                            wsUrl={voipUrl}
                            isOutgoingCall={true}
                            onHangup={safeHangup}
                            onLoadingComplete={handleVoipCameraLoadingComplete}
                        />
                    ) : voipUrl ? (
                        // Câmera selecionada manualmente (sem chamada)
                        <VoipCamera
                            key={voipKey}
                            wsUrl={voipUrl}
                            onClick={cameras.find(c => c.id === voipCameraId)?.extension ? handleOutgoingCall : undefined}
                            hasVoip={!!cameras.find(c => c.id === voipCameraId)?.extension}
                            onLoadingComplete={handleVoipCameraLoadingComplete}
                        />
                    ) : (
                        // Nenhuma atividade
                        <Typography variant="h6" color="white" sx={{ m: 'auto' }}>
                            Clique em uma câmera para ativar o interfone
                        </Typography>
                    )}
                </Box>

                {/* Câmeras 1-14 distribuídas */}
                {cameras.slice(0, Math.min(visibleCount, 14)).map((cam, index) => {
                    let gridColumn, gridRow;

                    // Câmeras 1-2 (linha 1, colunas 3-4)
                    if (index < 2) {
                        gridColumn = `${3 + index} / ${4 + index}`;
                        gridRow = '1 / 2';
                    }
                    // Câmeras 3-4 (linha 2, colunas 3-4)
                    else if (index < 4) {
                        gridColumn = `${3 + (index - 2)} / ${4 + (index - 2)}`;
                        gridRow = '2 / 3';
                    }
                    // Câmeras 5-6 (linha 3, colunas 3-4)
                    else if (index < 6) {
                        gridColumn = `${3 + (index - 4)} / ${4 + (index - 4)}`;
                        gridRow = '3 / 4';
                    }
                    // Câmeras 7-10 (linha 4, colunas 1-4)
                    else if (index < 10) {
                        const col = (index - 6);
                        gridColumn = `${col + 1} / ${col + 2}`;
                        gridRow = '4 / 5';
                    }
                    // Câmeras 11-14 (linha 5, colunas 1-4)
                    else {
                        const col = (index - 10);
                        gridColumn = `${col + 1} / ${col + 2}`;
                        gridRow = '5 / 6';
                    }

                    return (
                        <Box
                            key={cam.id}
                            onClick={() => handleCameraClick(cam.id)}
                            sx={{
                                gridColumn,
                                gridRow,
                                width: '100%',
                                height: '100%',
                                background: '#000',
                                border: '1px solid #333',
                                m: 0,
                                p: 0,
                                display: 'flex',
                                alignItems: 'stretch',
                                justifyContent: 'stretch',
                                minWidth: 0,
                                minHeight: 0,
                                overflow: 'hidden',
                                opacity: isVoipCameraLoading ? 0.5 : 1,
                                cursor: isVoipCameraLoading ? 'not-allowed' : 'pointer',
                                transition: 'opacity 0.3s ease, cursor 0.3s ease'
                            }}
                            title={isVoipCameraLoading ? 'Câmera carregando. Aguarde para selecionar outra.' : cam.description}
                        >
                            <CameraPlayer wsUrl={getCameraUrl(cam.id)} style={{ width: '100%', height: '100%', objectFit: 'fill', background: '#000' }} />
                        </Box>
                    );
                })}
            </Box>

            {/* Áudio remoto SIP */}
            <audio ref={remoteAudioRef} autoPlay playsInline muted={false} style={{ display: 'none' }} />

            {/* Sons de chamada */}
            <audio ref={phoneRingRef} src="phone-ring.mp3" style={{ display: 'none' }} />
            <audio ref={phoneCallRef} src="phone-call.mp3" style={{ display: 'none' }} />

            {/* Barra de Status SIP */}
            <SipStatusBar
                isConnected={status.isConnected}
                isRegistered={status.isRegistered}
                extension={status.extension}
                onConfigSave={connect}
            />
        </Box>
    );
};

export default Home;
