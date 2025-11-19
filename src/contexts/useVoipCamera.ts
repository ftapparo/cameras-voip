import { useContext } from 'react';
import { VoipCameraContext } from './VoipCameraContextDef';

export const useVoipCamera = () => {
    const context = useContext(VoipCameraContext);
    if (!context) {
        throw new Error('useVoipCamera deve ser usado dentro de VoipCameraProvider');
    }
    return context;
};
