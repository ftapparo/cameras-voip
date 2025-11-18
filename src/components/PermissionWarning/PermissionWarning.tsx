import React from 'react';
import { Box, Alert, AlertTitle, Button, IconButton } from '@mui/material';
import { Close as CloseIcon, Lock as LockIcon } from '@mui/icons-material';

interface PermissionWarningProps {
    hasMicrophone: boolean;
    onDismiss?: () => void;
}

export const PermissionWarning: React.FC<PermissionWarningProps> = ({ hasMicrophone, onDismiss }) => {
    const [dismissed, setDismissed] = React.useState(false);

    if (hasMicrophone || dismissed) {
        return null;
    }

    const handleClose = () => {
        setDismissed(true);
        onDismiss?.();
    };

    const handleRetry = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: { echoCancellation: true, noiseSuppression: true }
            });
            stream.getTracks().forEach(track => track.stop());
            setDismissed(false);
        } catch (error) {
            console.error('Erro ao solicitar permissões:', error);
        }
    };

    return (
        <Alert
            severity="error"
            sx={{
                mb: 2,
                backgroundColor: '#ffebee',
                borderLeft: '4px solid #f44336'
            }}
            action={
                <IconButton
                    aria-label="close"
                    color="inherit"
                    size="small"
                    onClick={handleClose}
                >
                    <CloseIcon fontSize="inherit" />
                </IconButton>
            }
        >
            <AlertTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LockIcon fontSize="small" />
                Permissões Necessárias
            </AlertTitle>
            <Box sx={{ mt: 1 }}>
                <p style={{ margin: '8px 0' }}>
                    <strong>⚠️ Este aplicativo precisa de:</strong>
                </p>
                <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                    <li>📷 <strong>Câmera</strong> - Para ver o vídeo da portaria</li>
                    <li>🎤 <strong>Microfone</strong> - Para comunicação de voz</li>
                    <li>🔊 <strong>Som</strong> - Para ouvir quem está chamando</li>
                </ul>
                <p style={{ margin: '8px 0', color: '#d32f2f' }}>
                    ❌ <strong>Permissões bloqueadas!</strong> Verifique:
                </p>
                <ol style={{ margin: '8px 0', paddingLeft: '20px' }}>
                    <li>Clique no <strong>ícone de cadeado</strong> na barra de endereço</li>
                    <li>Procure por <strong>"Câmera"</strong> e <strong>"Microfone"</strong></li>
                    <li>Altere para <strong>"Permitir"</strong></li>
                    <li>Clique no botão abaixo ou recarregue a página (F5)</li>
                </ol>
                <Button
                    variant="contained"
                    color="error"
                    onClick={handleRetry}
                    sx={{ mt: 2 }}
                >
                    🔄 Tentar Novamente
                </Button>
            </Box>
        </Alert>
    );
};
