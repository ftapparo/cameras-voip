import React from 'react';
import { Box, Typography } from '@mui/material';
import { useCameras } from '../hooks/useCameras';
import { CameraPlayer } from '../components/CameraPlayer/CameraPlayer';

const TestAllCameras: React.FC = () => {
    const { cameras, loading } = useCameras();

    if (loading) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography color="white">Carregando câmeras...</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ 
            background: '#000', 
            color: 'white', 
            minHeight: '100vh',
            p: 2
        }}>
            <Typography variant="h4" sx={{ mb: 3 }}>
                Teste de Todas as Câmeras ({cameras.length})
            </Typography>
            
            {cameras.map((camera, index) => (
                <Box key={camera.id} sx={{ 
                    mb: 4,
                    border: '1px solid #333',
                    p: 2
                }}>
                    <Typography variant="h6" sx={{ mb: 1 }}>
                        {index + 1}. {camera.name} ({camera.id})
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2, color: '#ccc' }}>
                        URL: {camera.url}
                    </Typography>
                    <Box sx={{ 
                        width: 320, 
                        height: 240,
                        border: '1px solid #555'
                    }}>
                        <CameraPlayer 
                            cameraUrl={camera.url} 
                            lazy={false}
                            style={{ 
                                width: '100%', 
                                height: '100%',
                                objectFit: 'fill'
                            }} 
                        />
                    </Box>
                </Box>
            ))}
        </Box>
    );
};

export default TestAllCameras;