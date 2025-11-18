import React from 'react';
import { Box, Typography } from '@mui/material';
import './IncomingCall.css';

interface IncomingCallProps {
    callerExtension: string;
    description?: string;
    onAnswer: () => void;
}

export const IncomingCall: React.FC<IncomingCallProps> = ({ callerExtension, description, onAnswer }) => {
    return (
        <Box
            onClick={onAnswer}
            className="incoming-call-container"
            sx={{
                width: '100%',
                height: '100%',
                background: '#000',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                position: 'relative',
                '&:hover': {
                    background: '#111'
                }
            }}
        >
            <Typography variant="h6" color="white" sx={{ mb: 2, opacity: 0.7 }}>
                Chamada recebida
            </Typography>
            <Typography variant="h2" color="white" fontWeight="bold">
                {callerExtension}
            </Typography>
            {description && (
                <Typography variant="h6" color="white" sx={{ mt: 2, opacity: 0.8 }}>
                    {description}
                </Typography>
            )}
            <Typography variant="body1" color="#4caf50" sx={{ mt: 4, animation: 'pulse 1s infinite' }}>
                Clique para atender
            </Typography>
        </Box>
    );
};
