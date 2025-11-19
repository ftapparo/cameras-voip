import { createContext } from 'react';

export interface VoipCameraContextType {
    isVoipCameraLoading: boolean;
    setIsVoipCameraLoading: (loading: boolean) => void;
}

export const VoipCameraContext = createContext<VoipCameraContextType | undefined>(undefined);
