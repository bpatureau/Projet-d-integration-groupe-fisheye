import { useEffect, useState } from 'react';

export type VisitStatus = 'pending' | 'answered' | 'missed';

export interface VisitEvent {
    teacherNames: string[];
    id: string;
    date: string;
    status: VisitStatus;
    message?: string;
}

export function useWebSocket(path: string) {
    const [events, setEvents] = useState<VisitEvent[]>([]);

    useEffect(() => {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';

        // Extraire le host du backend depuis VITE_API_URL
        const backendHost = new URL(API_URL).host;
        const wsUrl = `${protocol}://${backendHost}${path}`;

        const socket = new WebSocket(wsUrl);

        socket.onmessage = (message) => {
            try {
                const event = JSON.parse(message.data) as VisitEvent;
                setEvents(prev => [event, ...prev]);
            } catch (error) {
                console.error('Erreur parsing WebSocket:', error);
            }
        };

        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        return () => {
            socket.close();
        };
    }, [path]);

    return { events };
}
