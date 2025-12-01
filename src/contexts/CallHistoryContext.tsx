/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback } from 'react';

export interface CallRecord {
    id: string;
    extension: string;
    type: 'incoming' | 'outgoing';
    status: 'answered' | 'missed' | 'rejected';
    timestamp: Date;
    duration?: number; // em segundos, só para chamadas atendidas
    isRead?: boolean; // indica se a chamada perdida foi visualizada
}

interface CallHistoryContextType {
    callHistory: CallRecord[];
    missedCallsCount: number;
    addCall: (call: Omit<CallRecord, 'id'>) => string; // Retorna o ID da chamada
    markCallAnswered: (callId: string, duration?: number) => void;
    markMissedCallsAsRead: () => void; // Nova função para marcar como lidas
    clearMissedCount: () => void;
}

const CallHistoryContext = createContext<CallHistoryContextType | undefined>(undefined);

export const useCallHistory = () => {
    const context = useContext(CallHistoryContext);
    if (!context) {
        throw new Error('useCallHistory deve ser usado dentro de CallHistoryProvider');
    }
    return context;
};

export const CallHistoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Carrega histórico do localStorage
    const loadCallHistory = (): CallRecord[] => {
        try {
            const saved = localStorage.getItem('call_history');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Converte timestamps de volta para Date objects
                return parsed.map((call: CallRecord) => ({
                    ...call,
                    timestamp: new Date(call.timestamp)
                }));
            }
        } catch (error) {
            console.error('Erro ao carregar histórico de chamadas:', error);
        }
        return [];
    };

    const [callHistory, setCallHistory] = useState<CallRecord[]>(loadCallHistory());
    const [missedCallsCount, setMissedCallsCount] = useState(() => {
        // Carrega contador de perdidas baseado apenas nas chamadas NÃO LIDAS
        const saved = loadCallHistory();
        return saved.filter(call => 
            call.type === 'incoming' && 
            (call.status === 'missed' || call.status === 'rejected') &&
            !call.isRead // apenas as não lidas
        ).length;
    });

    const addCall = useCallback((call: Omit<CallRecord, 'id'>) => {
        const newCall: CallRecord = {
            ...call,
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
        };

        setCallHistory(prev => {
            // Mantém apenas as últimas 50 chamadas
            const updated = [newCall, ...prev].slice(0, 50);
            
            // Salva no localStorage
            try {
                localStorage.setItem('call_history', JSON.stringify(updated));
            } catch (error) {
                console.error('Erro ao salvar histórico de chamadas:', error);
            }
            
            return updated;
        });

        // Incrementa contador de perdidas apenas se for chamada entrante e perdida/rejeitada
        if (call.type === 'incoming' && (call.status === 'missed' || call.status === 'rejected')) {
            setMissedCallsCount(prev => prev + 1);
        }

        console.log('[CallHistory] Nova chamada adicionada:', newCall);
        return newCall.id; // Retorna o ID da chamada
    }, []);

    const markCallAnswered = useCallback((callId: string, duration?: number) => {
        console.log('[CallHistory] Tentando marcar como atendida:', callId);
        setCallHistory(prev => {
            const updated = prev.map(call => {
                if (call.id === callId) {
                    console.log('[CallHistory] Chamada encontrada e atualizada:', call.id);
                    return { ...call, status: 'answered' as const, duration };
                }
                return call;
            });
            
            // Salva no localStorage
            try {
                localStorage.setItem('call_history', JSON.stringify(updated));
            } catch (error) {
                console.error('Erro ao salvar histórico de chamadas:', error);
            }
            
            console.log('[CallHistory] Histórico atualizado:', updated.length, 'chamadas');
            return updated;
        });
        console.log('[CallHistory] Chamada marcada como atendida:', callId, 'duração:', duration);
    }, []);

    const markMissedCallsAsRead = useCallback(() => {
        setCallHistory(prev => {
            const updated = prev.map(call => {
                // Marca como lidas apenas as chamadas entrantes perdidas/rejeitadas que ainda não foram lidas
                if (call.type === 'incoming' && (call.status === 'missed' || call.status === 'rejected') && !call.isRead) {
                    return { ...call, isRead: true };
                }
                return call;
            });
            
            // Salva no localStorage
            try {
                localStorage.setItem('call_history', JSON.stringify(updated));
            } catch (error) {
                console.error('Erro ao salvar histórico de chamadas:', error);
            }
            
            return updated;
        });
        
        // Zera o contador após marcar como lidas
        setMissedCallsCount(0);
        console.log('[CallHistory] Chamadas perdidas marcadas como lidas');
    }, []);

    const clearMissedCount = useCallback(() => {
        // Agora delega para markMissedCallsAsRead para manter consistência
        markMissedCallsAsRead();
    }, [markMissedCallsAsRead]);

    return (
        <CallHistoryContext.Provider value={{
            callHistory,
            missedCallsCount,
            addCall,
            markCallAnswered,
            markMissedCallsAsRead,
            clearMissedCount
        }}>
            {children}
        </CallHistoryContext.Provider>
    );
};