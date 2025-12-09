// frontend/src/hooks/useWebSocket.ts
import { useEffect, useState } from 'react';
import type { VisitEvent, VisitStatus } from '../lib/api';

export function useWebSocket(path: string) {
    const [events, setEvents] = useState<VisitEvent[]>([]);

    useEffect(() => {
        const API_URL = import.meta.env.VITE_API_URL || 'https://fisheye-doorbell.up.railway.app';
        const wsUrl = API_URL.replace('https://', 'wss://') + path;

        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log('WebSocket connecté:', wsUrl);
        };

        socket.onmessage = (message) => {
            try {
                const raw = JSON.parse(message.data);

                const textMessage =
                    Array.isArray(raw.messages) && raw.messages.length > 0
                        ? raw.messages[0].text
                        : undefined;

                const event: VisitEvent = {
                    id: raw.id,
                    date: new Date(raw.createdAt).toLocaleString('fr-FR'),
                    status: raw.status as VisitStatus,
                    message: textMessage,
                    teacherNames: raw.location ? [raw.location.name] : [],
                    targetTeacherName: raw.targetTeacher ? raw.targetTeacher.name : undefined,
                };
                setEvents(prev => [event, ...prev]);
            } catch (error) {
                console.error('Erreur parsing WebSocket:', error);
            }
        };

        socket.onerror = (error) => {
            console.error('WebSocket error:', wsUrl, error);
        };

        socket.onclose = (event) => {
            console.log('WebSocket fermé:', event.code, event.reason);
        };

        return () => {
            socket.close();
        };
    }, [path]);

    return { events };
}
