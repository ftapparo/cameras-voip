import React from 'react';
import axios from 'axios';
import { CameraPlayer } from '../../components/CameraPlayer/CameraPlayer';
import { VoipCamera } from '../../components/VoipCamera/VoipCamera';
import { IncomingCall } from '../../components/IncomingCall/IncomingCall';
import { SipStatusBar } from '../../components/SipStatusBar/SipStatusBar';
import { useSip } from '../../hooks/useSip';
import { Box, Typography } from '@mui/material';

interface Camera {
    name: string;
    description: string;
    extension: string;
}

const Home: React.FC = () => {
    // Hook SIP
    const { status, remoteAudioRef, connect, answerCall, hangup, makeCall } = useSip();

    // Estado para armazenar as câmeras carregadas da API
    const [cameras, setCameras] = React.useState<Camera[]>([]);
    const [loading, setLoading] = React.useState(true);

    // Carregar câmeras da API (máximo de 12)
    React.useEffect(() => {
        const fetchCameras = async () => {
            try {
                const response = await axios.get('https://rtsp.condominionovaresidence.com/api/v1/camera/list');
                // Limita para as 12 primeiras câmeras
                setCameras(response.data.cameras.slice(0, 12));
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

    // Estado para controlar chamada ativa (de ramal sem câmera)
    const [activeCallExtension, setActiveCallExtension] = React.useState<string | undefined>(undefined);

    // Estado para controlar chamada sainte (outgoing call)
    const [isOutgoingCall, setIsOutgoingCall] = React.useState(false);

    // Refs para os sons
    const phoneRingRef = React.useRef<HTMLAudioElement | null>(null);
    const phoneCallRef = React.useRef<HTMLAudioElement | null>(null);

    React.useEffect(() => {
        if (visibleCount < cameras.length) {
            const timer = setTimeout(() => {
                setVisibleCount(visibleCount + 1);
            }, 250); // Aumentado para 800ms para dar mais tempo entre câmeras
            return () => clearTimeout(timer);
        }
    }, [visibleCount, cameras.length]);

    const getCameraUrl = (cameraName: string, highDef = false) => {
        // highDef = true usa tipo 0 (alta definição), false usa tipo 1 (baixa)
        const type = highDef ? '0' : '1';
        return `wss://rtsp.condominionovaresidence.com/stream/${cameraName}/${type}`;
    };

    // Função para lidar com o clique em uma câmera pequena
    const handleCameraClick = (cameraName: string) => {
        // Bloqueia troca de câmera durante chamadas
        if (status.incomingCall || status.inCall || isOutgoingCall) {
            console.log('Troca de câmera bloqueada durante chamada');
            return;
        }

        const highDefUrl = getCameraUrl(cameraName, true);

        console.log(`Câmera ${cameraName} clicada. URL HD: ${highDefUrl}`);

        // Distribui entre as 4 áreas VoIP de forma rotativa ou lógica desejada
        // Por enquanto, vou colocar sempre na área A
        setVoipUrl(highDefUrl);
        setVoipKey(prev => prev + 1); // Incrementa key para forçar remontagem
    };

    // Função para iniciar chamada sainte (outgoing call)
    const handleOutgoingCall = () => {
        // Encontra a câmera correspondente ao voipUrl atual
        const currentCamera = cameras.find(cam => getCameraUrl(cam.name, true) === voipUrl);

        if (currentCamera?.extension) {
            console.log(`Iniciando chamada para extension: ${currentCamera.extension}`);
            setIsOutgoingCall(true);
            makeCall(currentCamera.extension);
        } else {
            console.warn('Nenhuma câmera selecionada ou extension não disponível');
        }
    };

    // Detectar chamadas recebidas e carregar câmera automaticamente se disponível
    React.useEffect(() => {
        if (status.incomingCall) {
            const callerExtension = status.incomingCall.callerExtension;

            // Verifica se o ramal corresponde a uma câmera
            const camera = cameras.find(cam => cam.extension === callerExtension);

            if (camera) {
                // Carrega a câmera em alta definição
                const highDefUrl = getCameraUrl(camera.name, true);

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

    // Tocar som quando fazer chamada sainte (phone-call.mp3)
    // Toca quando isOutgoingCall está ativo e para quando a chamada é atendida (status.inCall)
    React.useEffect(() => {
        if (isOutgoingCall && !status.inCall && phoneCallRef.current) {
            phoneCallRef.current.loop = true;
            phoneCallRef.current.play().catch(err => console.error('Erro ao tocar phone-call:', err));
        } else if (phoneCallRef.current) {
            phoneCallRef.current.pause();
            phoneCallRef.current.currentTime = 0;
        }

        // Para a chamada sainte quando atende
        if (status.inCall && isOutgoingCall) {
            setIsOutgoingCall(false);
        }
    }, [isOutgoingCall, status.inCall]);

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
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gridTemplateRows: 'repeat(4, minmax(0, 1fr))',
                gap: 0,
                m: 0,
                p: 0,
                overflow: 'hidden',
            }}>
                {/* Área VoIP A - único bloco grande 2x2 */}
                <Box
                    sx={{
                        gridColumn: '1 / 3',
                        gridRow: '1 / 3',
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
                            onHangup={hangup}
                        />
                    ) : activeCallExtension ? (
                        // Chamada ativa de ramal sem câmera
                        <IncomingCall
                            callerExtension={activeCallExtension}
                            description={cameras.find(c => c.extension === activeCallExtension)?.description}
                            onAnswer={answerCall}
                            isInCall={true}
                            onHangup={hangup}
                        />
                    ) : isOutgoingCall && voipUrl ? (
                        // Chamada sainte em progresso (outgoing call)
                        <VoipCamera
                            key={voipKey}
                            wsUrl={voipUrl}
                            isOutgoingCall={true}
                            onHangup={hangup}
                        />
                    ) : voipUrl ? (
                        // Câmera selecionada manualmente (sem chamada)
                        <VoipCamera
                            key={voipKey}
                            wsUrl={voipUrl}
                            onClick={handleOutgoingCall}
                        />
                    ) : (
                        // Nenhuma atividade
                        <Typography variant="h6" color="white" sx={{ m: 'auto' }}>
                            Clique em uma câmera para ativar o interfone
                        </Typography>
                    )}
                </Box>

                {/* Câmeras 1-12 distribuídas corretamente */}
                {cameras.slice(0, Math.min(visibleCount, 12)).map((cam, index) => {
                    // Câmeras 1-2 (primeira linha, lado direito)
                    if (index < 2) {
                        return (
                            <Box
                                key={cam.name}
                                onClick={() => handleCameraClick(cam.name)}
                                sx={{
                                    gridColumn: `${3 + index} / ${4 + index}`,
                                    gridRow: '1 / 2',
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
                                    overflow: 'hidden'
                                }}
                            >
                                <CameraPlayer wsUrl={getCameraUrl(cam.name)} style={{ width: '100%', height: '100%', objectFit: 'fill', background: '#000' }} />
                            </Box>
                        );
                    }
                    // Câmeras 3-4 (segunda linha, lado direito)
                    else if (index < 4) {
                        return (
                            <Box
                                key={cam.name}
                                onClick={() => handleCameraClick(cam.name)}
                                sx={{
                                    gridColumn: `${3 + (index - 2)} / ${4 + (index - 2)}`,
                                    gridRow: '2 / 3',
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
                                    overflow: 'hidden'
                                }}
                            >
                                <CameraPlayer wsUrl={getCameraUrl(cam.name)} style={{ width: '100%', height: '100%', objectFit: 'fill', background: '#000' }} />
                            </Box>
                        );
                    }
                    // Câmeras 5-12 (terceira e quarta linha, todas as colunas)
                    else {
                        const adjustedIndex = index - 4; // 0-7 para câmeras 5-12
                        return (
                            <Box
                                key={cam.name}
                                onClick={() => handleCameraClick(cam.name)}
                                sx={{
                                    gridColumn: `${(adjustedIndex % 4) + 1} / ${(adjustedIndex % 4) + 2}`,
                                    gridRow: `${Math.floor(adjustedIndex / 4) + 3} / ${Math.floor(adjustedIndex / 4) + 4}`,
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
                                    overflow: 'hidden'
                                }}
                            >
                                <CameraPlayer wsUrl={getCameraUrl(cam.name)} style={{ width: '100%', height: '100%', objectFit: 'fill', background: '#000' }} />
                            </Box>
                        );
                    }
                })}
            </Box>

            {/* Áudio remoto SIP */}
            <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />

            {/* Sons de chamada */}
            <audio ref={phoneRingRef} src="/phone-ring.mp3" style={{ display: 'none' }} />
            <audio ref={phoneCallRef} src="/phone-call.mp3" style={{ display: 'none' }} />

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
