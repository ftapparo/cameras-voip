import React, { useState } from 'react';
import { VoipCameraContext } from './VoipCameraContextDef';

export const VoipCameraProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isVoipCameraLoading, setIsVoipCameraLoading] = useState(false);

    return (
        <VoipCameraContext.Provider value={{ isVoipCameraLoading, setIsVoipCameraLoading }}>
            {children}
        </VoipCameraContext.Provider>
    );
};
