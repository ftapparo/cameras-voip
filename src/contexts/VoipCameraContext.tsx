/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react';

interface VoipCameraContextType {
    voipCameraLoading: boolean;
    setVoipCameraLoading: (loading: boolean) => void;
    error: string | null;
    setError: (error: string | null) => void;
}

const VoipCameraContext = createContext<VoipCameraContextType | undefined>(undefined);

export const VoipCameraProvider: React.FC<{ children: any }> = ({ children }) => {
    const [voipCameraLoading, setVoipCameraLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        console.error('VoipCamera status: ', voipCameraLoading);
    }, [voipCameraLoading]);

    return (
        <VoipCameraContext.Provider value={{ voipCameraLoading, setVoipCameraLoading, error, setError }}>
            {children}
        </VoipCameraContext.Provider>
    );
};

export const useVoipCamera = () => {
    const context = useContext(VoipCameraContext);
    if (!context) {
        throw new Error('useVoipCamera deve ser usado dentro de VoipCameraProvider');
    }
    return context;
};