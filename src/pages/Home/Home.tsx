/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { CameraPlayer } from '../../components/CameraPlayer/CameraPlayer';
import { Box } from '@mui/material';

const Home: React.FC = () => {

    // Exemplo de 12 câmeras
    const cameras = Array.from({ length: 12 }, (_, i) => ({
        name: String(i + 1),
        description: `Câmera ${i + 1}`,
    }));

    // Estado para controlar quantas câmeras estão visíveis
    const [visibleCount, setVisibleCount] = React.useState(1);

    React.useEffect(() => {
        if (visibleCount < cameras.length) {
            const timer = setTimeout(() => {
                setVisibleCount(visibleCount + 1);
            }, 250);
            return () => clearTimeout(timer);
        }
    }, [visibleCount, cameras.length]);

    // Não há mais câmera principal, apenas o mosaico

    const getCameraUrl = (cameraName: string) => {
        // Todas em resolução baixa (tipo 1)
        return `wss://rtsp.condominionovaresidence.com/stream/${cameraName}/1`;
    };

    // Nenhuma ação ao clicar

    return (
        <Box sx={{ width: '100vw', height: '100vh', background: '#000', m: 0, p: 0, overflow: 'hidden', position: 'fixed', top: 0, left: 0, display: 'flex', alignItems: 'stretch', justifyContent: 'stretch' }}>
            <Box sx={{
                width: '100%',
                height: '100%',
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gridTemplateRows: 'repeat(3, minmax(0, 1fr))',
                gap: 0,
                m: 0,
                p: 0,
                overflow: 'hidden',
            }}>
                {cameras.slice(0, visibleCount).map(cam => (
                    <Box
                        key={cam.name}
                        sx={{
                            width: '100%',
                            height: '100%',
                            background: '#000',
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
                        <CameraPlayer key={cam.name + '-mini'} wsUrl={getCameraUrl(cam.name)} style={{ width: '100%', height: '100%', objectFit: 'fill', background: '#000' }} />
                    </Box>
                ))}
            </Box>
        </Box>
    );
};

export default Home;
