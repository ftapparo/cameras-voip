import React from 'react';
import styles from './VoipControls.module.css';

interface VoipControlsProps {
    onAnswer?: () => void;
    onEnd?: () => void;
    onMute?: () => void;
    onCall?: () => void;
    isMuted?: boolean;
    isInCall?: boolean;
}

const VoipControls: React.FC<VoipControlsProps> = ({
    onAnswer,
    onEnd,
    onMute,
    onCall,
    isMuted = false,
    isInCall = false,
}) => {
    return (
        <div className={styles.container}>
            <button className={styles.button} onClick={onAnswer} disabled={isInCall}>
                Atender
            </button>
            <button className={styles.button} onClick={onEnd} disabled={!isInCall}>
                Encerrar
            </button>
            <button className={styles.button} onClick={onMute} disabled={!isInCall}>
                {isMuted ? 'Desmutar' : 'Mutar'}
            </button>
            <button className={styles.button} onClick={onCall} disabled={isInCall}>
                Chamar
            </button>
        </div>
    );
};

export default VoipControls;
