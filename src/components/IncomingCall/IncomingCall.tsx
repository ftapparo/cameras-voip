import React from 'react';
import { Box, Typography } from '@mui/material';
import './IncomingCall.css';

interface IncomingCallProps {
    callerExtension: string;
    description?: string;
    onAnswer: () => void;
    isInCall?: boolean;
    onHangup?: () => void;
}

export const IncomingCall: React.FC<IncomingCallProps> = ({
    callerExtension,
    description,
    onAnswer,
    isInCall = false,
    onHangup
}) => {
    return (
        <Box
            onClick={isInCall ? onHangup : onAnswer}
            className={isInCall ? "active-call-container" : "incoming-call-container"}
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
                {isInCall ? 'Em chamada' : 'Chamada recebida'}
            </Typography>
            <Typography variant="h2" color="white" fontWeight="bold">
                {callerExtension}
            </Typography>
            {description && (
                <Typography variant="h6" color="white" sx={{ mt: 2, opacity: 0.8 }}>
                    {description}
                </Typography>
            )}
            <Typography
                variant="body1"
                color={isInCall ? "#f44336" : "#4caf50"}
                sx={{ mt: 4, animation: 'pulse 1s infinite' }}
            >
                {isInCall ? 'Clique para desligar' : 'Clique para atender'}
            </Typography>
        </Box>
    );
};
