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
};
