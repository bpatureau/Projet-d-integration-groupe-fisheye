import type {VisitEvent} from '../hooks/useWebSocket';

const FAKE_DATA: VisitEvent[] = [
    // Exemple de données factices
    {
        id: 'a1b2c3',
        date: new Date().toLocaleString('fr-FR'),
        status: 'missed',
        message: 'Bonjour',
        teacherCount: 2
    },
    {
        id: 'd4e5f6',
        date: new Date().toLocaleString('fr-FR'),
        status: 'answered',
        message: '',
        teacherCount: 1
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
            if (idx !== -1) FAKE_DATA[idx].status = 'answered';
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

    syncCalendars: (): Promise<void> =>
        new Promise(resolve => setTimeout(() => resolve(), 500))
};
