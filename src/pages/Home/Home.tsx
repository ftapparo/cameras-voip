import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { CameraPlayer } from '../../components/CameraPlayer/CameraPlayer';
import { VoipCamera } from '../../components/VoipCamera/VoipCamera';
import { IncomingCall } from '../../components/IncomingCall/IncomingCall';
import { SipStatusBar } from '../../components/SipStatusBar/SipStatusBar';
import { useSip } from '../../hooks/useSip';
import { Box, Typography } from '@mui/material';
import { useVoipCamera } from '../../contexts/VoipCameraContext';

interface Camera {
    name: string;
    confName: string;
    extension?: string;
    description?: string;
}

const Home: React.FC = () => {
    // Refs para elementos de áudio
    const phoneRingRef = useRef<HTMLAudioElement>(null);
    const phoneCallRef = useRef<HTMLAudioElement>(null);
    const phoneEndRef = useRef<HTMLAudioElement>(null);

    // Função para tocar áudio de encerramento (definida primeiro para o callback)
    const playEndCallSound = useCallback(() => {
        if (phoneEndRef.current) {
            try {
                phoneEndRef.current.play().catch((error) => {
                    console.warn('[Audio] Erro ao reproduzir som de encerramento:', error);
                });
            } catch (error) {
                console.warn('[Audio] Erro ao tentar reproduzir som de encerramento:', error);
            }
        }
    }, []);

    // Hook SIP
    const { status, remoteAudioRef, connect, answerCall, hangup, makeCall } = useSip({
        onCallEnded: playEndCallSound
    });
    const { setVoipCameraLoading } = useVoipCamera();
    const [cameras, setCameras] = useState<Camera[]>([]);
    const [, setLoading] = useState(true);
 
    // Estado para a área VoIP
    const [voipUrl, setVoipUrl] = useState<string | undefined>(undefined);
    const [voipKey, setVoipKey] = useState(0);
    const [voipCameraId, setVoipCameraId] = useState<string | undefined>(undefined);

    // Estado para controlar chamada ativa (de ramal sem câmera)
    const [activeCallExtension, setActiveCallExtension] = useState<string | undefined>(undefined);

    // Estado para controlar chamada sainte (outgoing call)
    const [isOutgoingCall, setIsOutgoingCall] = useState(false);

    // Ref para prevenir múltiplos hangups simultâneos
    const isHangingUpRef = useRef(false);

    // Debug: log quando o ref é criado
    useEffect(() => {
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
    }, [remoteAudioRef]);     
    
    // Carregar câmeras da API
    useEffect(() => {
        const fetchCameras = async () => {
            try {
                const response = await axios.get('http://192.168.0.250:9997/v3/paths/list');
                
                // Processa as câmeras para extrair o ramal do nome
                const processedCameras = response.data.items.map((item: unknown) => {
                    const camera = item as Camera;
                    const nameParts = camera.name.split('_');
                    const extension = nameParts.length > 1 && nameParts[1] !== '0' ? nameParts[1] : undefined;
                    
                    return {
                        ...camera,
                        extension: extension,
                        description: (extension ? `Ramal ${extension}` : 'Sem interfone')
                    };
                });
                
                // Ordena as câmeras por nome (cam1, cam2, cam3, ...)
                const sortedCameras = processedCameras.sort((a: Camera, b: Camera) => {
                    // Extrai o número da câmera do nome (cam1 -> 1, cam10 -> 10)
                    const getNumber = (name: string) => {
                        const match = name.match(/cam(\d+)/);
                        return match ? parseInt(match[1], 10) : 0;
                    };
                    
                    return getNumber(a.name) - getNumber(b.name);
                });
                
                setCameras(sortedCameras);
                setLoading(false);
                setVoipCameraLoading(false);
          
            } catch (error) {
                console.error('Erro ao carregar câmeras:', error);
                setLoading(false);
                setVoipCameraLoading(false);
            }
        };

        fetchCameras();
    }, [setVoipCameraLoading]);
   
    // Monta a URL HLS da câmera
    const getCameraUrl = (cameraName: string) => {
        return `http://192.168.0.250:8888/${cameraName}/index.m3u8`;
    };

    // Callback para quando o VoipCamera termina de carregar
    const handleVoipCameraLoadingComplete = useCallback(() => {
        console.log('[Home] VoipCamera carregamento completo');
        setVoipCameraLoading(false);
    }, [setVoipCameraLoading]);

    // Função para rejeitar chamada com áudio
    const handleRejectCall = useCallback(() => {
        console.log('[Reject] Rejeitando chamada');
        
        hangup();
    }, [hangup]);

    // Wrapper seguro para hangup
    const handleSafeHangup = useCallback(() => {
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

    // Função para lidar com o clique em uma câmera pequena
    const handleCameraClick = (cameraName: string) => {
        // Bloqueia troca de câmera durante chamadas
        if (status.incomingCall || status.inCall || isOutgoingCall) {
            console.log('Troca de câmera bloqueada durante chamada');
            return;
        }

        const hlsUrl = getCameraUrl(cameraName);
        console.log(`Câmera ${cameraName} clicada. URL HLS: ${hlsUrl}`);

        setVoipUrl(hlsUrl);
        setVoipCameraId(cameraName); // Armazena o nome da câmera atual
        setVoipKey(prev => prev + 1); // Incrementa key para forçar remontagem
    };

    // Função para iniciar chamada sainte (outgoing call)
    const handleOutgoingCall = () => {

        console.log('Iniciando chamada sainte para câmera:', voipCameraId);

        // Encontra a câmera correspondente ao voipCameraId atual
        const currentCamera = cameras.find(cam => cam.name === voipCameraId);

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
    useEffect(() => {
        if (status.incomingCall) {
            const callerExtension = status.incomingCall.callerExtension;

            // Verifica se o ramal corresponde a uma câmera
            const camera = cameras.find(cam => cam.extension === callerExtension);

            if (camera) {
                // Carrega a câmera
                const hlsUrl = getCameraUrl(camera.name);

                // Só atualiza se for uma câmera diferente
                if (voipUrl !== hlsUrl) {
                    // Usar setTimeout para agendar setState fora do effect
                    setTimeout(() => {
                        setVoipUrl(hlsUrl);
                        setVoipKey(prev => prev + 1);
                        setVoipCameraId(camera.name); // Atualiza o ID da câmera ativa para o ramal que está chamando
                    }, 100);
                }
                setTimeout(() => setActiveCallExtension(undefined), 100); // Limpa chamada sem câmera se houver
            } else {
                // Marca que há uma chamada de ramal sem câmera
                setTimeout(() => {
                    setActiveCallExtension(callerExtension);
                    setVoipUrl(undefined);
                }, 100);
            }

            // Limpa chamada sainte se houver
            setTimeout(() => setIsOutgoingCall(false), 0);
        } else if (status.inCall && activeCallExtension) {
            // Mantém activeCallExtension durante a chamada
            // Não faz nada aqui, apenas mantém o estado
        } else if (!status.inCall && !status.incomingCall) {
            // Limpa tudo quando não há chamada
            setTimeout(() => {
                setActiveCallExtension(undefined);
                setIsOutgoingCall(false);
            }, 100);
        }
    }, [status.incomingCall, status.inCall, cameras, activeCallExtension, voipUrl]);

    // Tocar som quando receber chamada entrante (phone-ring.mp3)
    useEffect(() => {
        if (status.incomingCall && phoneRingRef.current) {
            phoneRingRef.current.loop = true;
            phoneRingRef.current.play().catch(err => console.error('Erro ao tocar phone-ring:', err));
        } else if (phoneRingRef.current) {
            phoneRingRef.current.pause();
            phoneRingRef.current.currentTime = 0;
        }
    }, [status.incomingCall]);

    // Parar som quando a chamada é confirmada/atendida ou cancelada (phone-call.mp3)
    useEffect(() => {
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
                setTimeout(() => setIsOutgoingCall(false), 0);
            }
        }
    }, [status.callConfirmed, isOutgoingCall, status.inCall]);

    // Limpa estados quando a chamada é encerrada (proteção adicional)
    useEffect(() => {
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
                setTimeout(() => setIsOutgoingCall(false), 0);
            }
        }
    }, [status.inCall, status.incomingCall, isOutgoingCall]);

    return (
        <Box sx={{ width: '100vw', height: '100vh', background: '#000', m: 0, p: 0, overflow: 'hidden', position: 'fixed', top: 0, left: 0, display: 'flex', alignItems: 'stretch', justifyContent: 'stretch', paddingBottom: '50px' }}>
            <Box sx={{
                width: '100%',
                height: '100%',
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', // 4 colunas fixas
                gridTemplateRows: `repeat(${Math.max(5, Math.ceil((cameras.length + 6) / 4))}, minmax(0, 1fr))`, // Linhas dinâmicas
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
                                hlsUrl={voipUrl}
                                onClick={answerCall}
                                isIncomingCall={true}
                                callConfirmed={status.callConfirmed}
                                onReject={handleRejectCall}
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
                            hlsUrl={voipUrl}
                            isInCall={true}
                            callConfirmed={status.callConfirmed}
                            onHangup={handleSafeHangup}
                            onLoadingComplete={handleVoipCameraLoadingComplete}
                        />
                    ) : activeCallExtension ? (
                        // Chamada ativa de ramal sem câmera
                        <IncomingCall
                            callerExtension={activeCallExtension}
                            description={cameras.find(c => c.extension === activeCallExtension)?.description}
                            onAnswer={answerCall}
                            isInCall={true}
                            onHangup={handleSafeHangup}
                        />
                    ) : isOutgoingCall && voipUrl ? (
                        // Chamada sainte em progresso (outgoing call)
                        <VoipCamera
                            key={voipKey}
                            hlsUrl={voipUrl}
                            isOutgoingCall={true}
                            callConfirmed={status.callConfirmed}
                            onHangup={handleSafeHangup}
                            onLoadingComplete={handleVoipCameraLoadingComplete}
                        />
                    ) : voipUrl ? (
                        // Câmera selecionada manualmente (sem chamada)
                        <VoipCamera
                            key={voipKey}
                            hlsUrl={voipUrl}
                            onClick={cameras.find(c => c.name === voipCameraId)?.extension ? handleOutgoingCall : undefined}
                            hasVoip={!!cameras.find(c => c.name === voipCameraId)?.extension}
                            onLoadingComplete={handleVoipCameraLoadingComplete}
                        />
                    ) : (
                        // Nenhuma atividade
                        <Typography variant="h6" color="white" sx={{ m: 'auto' }}>
                            Clique em uma câmera para ativar o interfone
                        </Typography>
                    )}
                </Box>

                {/* Câmeras distribuídas dinamicamente */}
                {cameras.map((cam, index) => {
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
                    // Câmeras restantes (a partir da linha 4)
                    else {
                        const adjustedIndex = index - 6; // Remove as 6 primeiras câmeras
                        const row = Math.floor(adjustedIndex / 4) + 4; // Começa na linha 4
                        const col = (adjustedIndex % 4); // Coluna 0-3
                        gridColumn = `${col + 1} / ${col + 2}`;
                        gridRow = `${row} / ${row + 1}`;
                    }

                    return (
                        <Box
                            key={cam.name}
                            onClick={() => handleCameraClick(cam.name)}
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
                                cursor: 'pointer',
                                transition: 'opacity 0.3s ease, cursor 0.3s ease'
                            }}
                            title={cam.description || cam.name}
                        >
                            <CameraPlayer hlsUrl={getCameraUrl(cam.name)} style={{ width: '100%', height: '100%', objectFit: 'fill', background: '#000' }} />
                        </Box>
                    );
                })}
            </Box>

            {/* Áudio remoto SIP */}
            <audio ref={remoteAudioRef} autoPlay playsInline muted={false} style={{ display: 'none' }} />

            {/* Sons de chamada */}
            <audio ref={phoneRingRef} src="phone-ring.mp3" style={{ display: 'none' }} />
            <audio ref={phoneCallRef} src="phone-call.mp3" style={{ display: 'none' }} />
            <audio ref={phoneEndRef} src="phone-end.mp3" style={{ display: 'none' }} />

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
