import type {VisitEvent} from '../hooks/useWebSocket';

const FAKE_DATA: VisitEvent[] = [
    // Exemple de données factices
    {
        id: 'a1b2c3',
        date: new Date().toLocaleString('fr-FR'),
        status: 'Manquée',
        message: 'Bonjour',
        teacherNames: ["De Smet, Dubruille"]
    },
    {
        id: 'd4e5f6',
        date: new Date().toLocaleString('fr-FR'),
        status: 'Présent',
        message: '',
        teacherNames: ["De Smet, VDS"]
    }
];

export const api = {
    getEvents: (): Promise<VisitEvent[]> =>
        new Promise(resolve => {
            setTimeout(() => resolve(FAKE_DATA), 500);
        }),

    markAnswered: (id: string): Promise<void> =>
        new Promise(resolve => {
            const idx = FAKE_DATA.findIndex(v => v.id === id);
            if (idx !== -1) FAKE_DATA[idx].status = 'Présent';
            setTimeout(() => resolve(), 200);
        }),

    deleteVisit: (id: string): Promise<void> =>
        new Promise(resolve => {
            const idx = FAKE_DATA.findIndex(v => v.id === id);
            if (idx !== -1) FAKE_DATA.splice(idx, 1);
            setTimeout(() => resolve(), 200);
        }),

    getIntegrations: (): Promise<{ google: boolean; outlook: boolean; teams: boolean }> =>
        new Promise(resolve => {
            setTimeout(() => resolve({ google: true, outlook: false, teams: false }), 200);
        }),

    updateIntegrations: (data: { google?: boolean; outlook?: boolean; teams?: boolean }): Promise<any> =>
        new Promise(resolve => {
            setTimeout(() => resolve({ ...data }), 200);
        }),
    getCalendarEvents: (email: string) => new Promise(resolve => {
        setTimeout(() => {
            resolve([
                {
                    id: 'ev1',
                    title: 'TDS',
                    start: '2025-11-04 08:30',
                    end: '2025-11-04 10:00',
                    provider: email.includes('gmail') ? 'Google' : 'Outlook',
                },
                {
                    id: 'ev8',
                    title: 'Admin',
                    start: '2025-11-04 09:15',
                    end: '2025-11-04 11:00',
                    provider: email.includes('gmail') ? 'Google' : 'Outlook',
                },
                {
                    id: 'ev2',
                    title: 'Électronique Digitale',
                    start: '2025-11-05 09:00',
                    end: '2025-11-05 10:30',
                    provider: email.includes('gmail') ? 'Google' : 'Outlook',
                },
                {
                    id: 'ev3',
                    title: 'Anglais',
                    start: '2025-11-06 14:00',
                    end: '2025-11-06 15:00',
                    provider: email.includes('gmail') ? 'Google' : 'Outlook',
                },
                {
                    id: 'ev4',
                    title: 'Dev 2',
                    start: '2025-11-07 11:30',
                    end: '2025-11-07 12:30',
                    provider: email.includes('gmail') ? 'Google' : 'Outlook',
                },
                {
                    id: 'ev5',
                    title: 'Réseaux',
                    start: '2025-11-08 15:00',
                    end: '2025-11-08 16:00',
                    provider: email.includes('gmail') ? 'Google' : 'Outlook',
                }
            ]);
        }, 800);
    }),
};
