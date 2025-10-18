import { useEffect, useState } from 'react';

export interface VisitEvent {
    teacherNames: any[];
    id: string;
    date: string;
    status: 'Présent' | 'Manquée';
    message?: string;
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
