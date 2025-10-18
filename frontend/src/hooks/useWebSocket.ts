import { useEffect, useState } from 'react';

export interface VisitEvent {
    id: string;
    date: string;
    status: 'answered' | 'missed';
    message?: string;
    teacherCount: number;
}

export function useWebSocket(path: string) {
    const [events, setEvents] = useState<VisitEvent[]>([]);

    useEffect(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const socket = new WebSocket(`${protocol}://${window.location.host}${path}`);

        socket.onmessage = (message) => {
            const event = JSON.parse(message.data) as VisitEvent;
            setEvents(prev => [event, ...prev]);
        };

        return () => {
            socket.close();
        };
    }, [path]);

    return { events };
}
