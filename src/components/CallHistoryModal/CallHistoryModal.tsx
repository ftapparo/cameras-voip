import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    List,
    ListItem,
    ListItemIcon,
    Box,
    Chip,
    IconButton,
    Divider
} from '@mui/material';
import {
    PhoneMissed,
    Close,
    AccessTime
} from '@mui/icons-material';
import PhoneCallbackIcon from '@mui/icons-material/PhoneCallback';
import CallIcon from '@mui/icons-material/Call';
import { useCallHistory, type CallRecord } from '../../contexts/CallHistoryContext';

interface CallHistoryModalProps {
    open: boolean;
    onClose: () => void;
}

const getCallIcon = (type: CallRecord['type'], status: CallRecord['status']) => {
    if (type === 'incoming') {
        if (status === 'answered') {
            // Chamada recebida com sucesso - verde
            return <PhoneCallbackIcon sx={{ color: '#4caf50' }} />;
        } else {
            // Chamada recusada/perdida - vermelho  
            return <PhoneMissed sx={{ color: '#f44336' }} />;
        }
    } else {
        // Chamada feita (outgoing)
        if (status === 'answered') {
            // Chamada feita com sucesso - verde
            return <CallIcon sx={{ color: '#4caf50' }} />;
        } else {
            // Chamada feita com erro - vermelho
            return <CallIcon sx={{ color: '#f44336' }} />;
        }
    }
};

const getStatusColor = (status: CallRecord['status']) => {
    switch (status) {
        case 'answered': return '#4caf50';
        case 'missed': return '#f44336';
        case 'rejected': return '#ff9800';
        default: return '#757575';
    }
};

const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatTime = (date: Date) => {
    return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};

export const CallHistoryModal: React.FC<CallHistoryModalProps> = ({ open, onClose }) => {
    const { callHistory, markMissedCallsAsRead } = useCallHistory();

    const handleClose = () => {
        markMissedCallsAsRead(); // Marca chamadas perdidas como lidas quando abre o modal
        onClose();
    };

    return (
        <Dialog 
            open={open} 
            onClose={handleClose}
            maxWidth="md"
            fullWidth
            disableRestoreFocus={true}
            disableEnforceFocus={true}
            keepMounted={false}
            PaperProps={{
                sx: {
                    backgroundColor: '#ffffff',
                    color: '#000000',
                    height: '600px',
                    maxHeight: '600px',
                    display: 'flex',
                    flexDirection: 'column'
                }
            }}
            slotProps={{
                backdrop: {
                    sx: {
                        backgroundColor: 'rgba(0, 0, 0, 0.5)'
                    }
                }
            }}
        >
            <DialogTitle sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                backgroundColor: '#f5f5f5',
                color: '#000000',
                borderBottom: '1px solid #e0e0e0'
            }}>
                Histórico de Chamadas
                <IconButton 
                    onClick={handleClose} 
                    sx={{ color: '#000000' }}
                    tabIndex={-1}
                    onFocus={(e) => e.target.blur()}
                >
                    <Close />
                </IconButton>
            </DialogTitle>
            
            <DialogContent sx={{ 
                p: 0, 
                backgroundColor: '#ffffff',
                flex: 1,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {callHistory.length === 0 ? (
                    <Box sx={{ 
                        p: 3, 
                        textAlign: 'center',
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <span style={{ color: '#666666' }}>
                            Nenhuma chamada registrada
                        </span>
                    </Box>
                ) : (
                    <Box sx={{ 
                        overflow: 'auto',
                        flex: 1,
                        '&::-webkit-scrollbar': {
                            width: '8px',
                        },
                        '&::-webkit-scrollbar-track': {
                            background: '#f1f1f1',
                        },
                        '&::-webkit-scrollbar-thumb': {
                            background: '#c1c1c1',
                            borderRadius: '4px',
                        },
                        '&::-webkit-scrollbar-thumb:hover': {
                            background: '#a1a1a1',
                        },
                    }}>
                        <List>
                            {callHistory.map((call, index) => (
                                <React.Fragment key={call.id}>
                                    <ListItem sx={{ 
                                        py: 2,
                                        backgroundColor: (call.type === 'incoming' && (call.status === 'missed' || call.status === 'rejected') && !call.isRead) 
                                            ? 'rgba(255, 193, 7, 0.1)' // Fundo amarelo claro para chamadas não lidas
                                            : 'transparent',
                                        borderLeft: (call.type === 'incoming' && (call.status === 'missed' || call.status === 'rejected') && !call.isRead)
                                            ? '4px solid #ffc107' // Borda amarela para destacar não lidas
                                            : 'none',
                                        '&:hover': { backgroundColor: 'rgba(0,0,0,0.04)' }
                                    }}>
                                        <ListItemIcon>
                                            {getCallIcon(call.type, call.status)}
                                        </ListItemIcon>
                                        
                                        <Box sx={{ flex: 1 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <span style={{ 
                                                    fontWeight: (call.type === 'incoming' && (call.status === 'missed' || call.status === 'rejected') && !call.isRead) ? 'bold' : 'normal',
                                                    color: '#000000' 
                                                }}>
                                                    Ramal {call.extension}
                                                </span>
                                                <Chip 
                                                    label={call.type === 'incoming' ? 'Entrante' : 'Sainte'}
                                                    size="small"
                                                    sx={{ 
                                                        backgroundColor: call.type === 'incoming' ? '#4caf50' : '#2196f3',
                                                        color: 'white',
                                                        fontSize: '0.7rem'
                                                    }}
                                                />
                                                <Chip 
                                                    label={
                                                        call.status === 'answered' ? 'Atendida' :
                                                        call.status === 'missed' ? 'Perdida' : 'Recusada'
                                                    }
                                                    size="small"
                                                    sx={{ 
                                                        backgroundColor: getStatusColor(call.status),
                                                        color: 'white',
                                                        fontSize: '0.7rem'
                                                    }}
                                                />
                                                {/* Chip "NOVA" para chamadas perdidas não lidas */}
                                                {call.type === 'incoming' && (call.status === 'missed' || call.status === 'rejected') && !call.isRead && (
                                                    <Chip 
                                                        label="NOVA"
                                                        size="small"
                                                        sx={{ 
                                                            backgroundColor: '#ffc107',
                                                            color: '#000000',
                                                            fontSize: '0.6rem',
                                                            fontWeight: 'bold'
                                                        }}
                                                    />
                                                )}
                                            </Box>
                                            <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center' }}>
                                                <AccessTime sx={{ fontSize: '14px', mr: 0.5, color: '#666666' }} />
                                                <span style={{ color: '#666666', fontSize: '14px' }}>
                                                    {formatTime(call.timestamp)}
                                                    {call.duration && (
                                                        <> • Duração: {formatDuration(call.duration)}</>
                                                    )}
                                                </span>
                                            </Box>
                                        </Box>
                                    </ListItem>
                                    {index < callHistory.length - 1 && (
                                        <Divider sx={{ backgroundColor: '#e0e0e0' }} />
                                    )}
                                </React.Fragment>
                            ))}
                        </List>
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
};