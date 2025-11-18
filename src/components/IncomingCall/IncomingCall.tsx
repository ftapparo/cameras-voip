import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import CallEndIcon from '@mui/icons-material/CallEnd';
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
            className={isInCall ? "active-call-container" : "incoming-call-container"}
            sx={{
                width: '100%',
                height: '100%',
                background: '#000',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
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

            {/* Botões de controle */}
            {isInCall ? (
                // Em chamada - botão ENCERRAR centralizado
                <Box sx={{
                    position: 'absolute',
                    bottom: 20,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 10
                }}>
                    <Chip
                        icon={<CallEndIcon />}
                        label="ENCERRAR"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onHangup) onHangup();
                        }}
                        sx={{
                            width: '200px',
                            height: '56px',
                            backgroundColor: '#d32f2f',
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '1.2rem',
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                            '&:hover': {
                                backgroundColor: '#b71c1c'
                            },
                            '& .MuiChip-icon': {
                                color: 'white',
                                fontSize: '1.6rem'
                            },
                            '& .MuiChip-label': {
                                fontSize: '1.2rem',
                                fontWeight: 'bold'
                            }
                        }}
                    />
                </Box>
            ) : (
                // Chamada recebida - botões Recusar e Atender
                <Box sx={{
                    position: 'absolute',
                    bottom: 20,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    gap: 3,
                    zIndex: 10
                }}>
                    <Chip
                        icon={<CallEndIcon />}
                        label="RECUSAR"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onHangup) onHangup();
                        }}
                        sx={{
                            width: '180px',
                            height: '56px',
                            backgroundColor: '#d32f2f',
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '1.2rem',
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                            '&:hover': {
                                backgroundColor: '#b71c1c'
                            },
                            '& .MuiChip-icon': {
                                color: 'white',
                                fontSize: '1.6rem'
                            },
                            '& .MuiChip-label': {
                                fontSize: '1.2rem',
                                fontWeight: 'bold'
                            }
                        }}
                    />
                    <Chip
                        icon={<PhoneIcon />}
                        label="ATENDER"
                        onClick={(e) => {
                            e.stopPropagation();
                            onAnswer();
                        }}
                        sx={{
                            width: '180px',
                            height: '56px',
                            backgroundColor: '#43a047',
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '1.2rem',
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                            '&:hover': {
                                backgroundColor: '#2e7d32'
                            },
                            '& .MuiChip-icon': {
                                color: 'white',
                                fontSize: '1.6rem'
                            },
                            '& .MuiChip-label': {
                                fontSize: '1.2rem',
                                fontWeight: 'bold'
                            }
                        }}
                    />
                </Box>
            )}
        </Box>
    );
};
