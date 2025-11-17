/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { CameraPlayer } from '../../components/CameraPlayer/CameraPlayer';
import { VoipCamera } from '../../components/VoipCamera/VoipCamera';
import { Box } from '@mui/material';

const Home: React.FC = () => {

    // 11 câmeras (conforme layout)
    const cameras = Array.from({ length: 12 }, (_, i) => ({
        name: String(i + 1),
        description: `Câmera ${i + 1}`,
    }));

    // Estado para controlar quantas câmeras estão visíveis
    const [visibleCount, setVisibleCount] = React.useState(1);

    // Estado para a área VoIP
    const [voipUrl, setVoipUrl] = React.useState<string | undefined>(undefined);
    const [voipKey, setVoipKey] = React.useState(0);

    React.useEffect(() => {
        if (visibleCount < cameras.length) {
            const timer = setTimeout(() => {
                setVisibleCount(visibleCount + 1);
            }, 100);
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
        const highDefUrl = getCameraUrl(cameraName, true);

        console.log(`Câmera ${cameraName} clicada. URL HD: ${highDefUrl}`);

        // Distribui entre as 4 áreas VoIP de forma rotativa ou lógica desejada
        // Por enquanto, vou colocar sempre na área A
        setVoipUrl(highDefUrl);
        setVoipKey(prev => prev + 1); // Incrementa key para forçar remontagem
    };

    return (
        <Box sx={{ width: '100vw', height: '100vh', background: '#000', m: 0, p: 0, overflow: 'hidden', position: 'fixed', top: 0, left: 0, display: 'flex', alignItems: 'stretch', justifyContent: 'stretch' }}>
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
                        display: 'flex',
                        alignItems: 'stretch',
                        justifyContent: 'stretch',
                        minWidth: 0,
                        minHeight: 0,
                        overflow: 'hidden'
                    }}
                >
                    <VoipCamera key={voipKey} wsUrl={voipUrl || ''} />
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
        </Box>
    );
};

export default Home;
