const API_URL = import.meta.env.VITE_API_URL || 'https://fisheye-doorbell.up.railway.app';

interface Teacher {
    id: string;
    username: string;
    email: string;
    name: string;
}

interface LoginResponse {
    token: string;
    teacher: Teacher;
}

export type VisitStatus = 'pending' | 'answered' | 'missed';

export interface VisitEvent {
    id: string;
    date: string;
    status: VisitStatus;
    message?: string;
    teacherNames: string[];
}

export const api = {
    // ===== AUTH =====
    login: async (username: string, password: string): Promise<LoginResponse> => {
        const res = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.message || 'Erreur de connexion');
        }

        return res.json();
    },

    // ===== DASHBOARD =====
    getEvents: async (): Promise<VisitEvent[]> => {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`${API_URL}/api/visits`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`HTTP ${res.status}: ${errorText}`);
        }

        const response = await res.json();

        // Gérer différents formats de réponse backend
        let visits = [];
        if (Array.isArray(response)) {
            visits = response;
        } else if (response.data && Array.isArray(response.data)) {
            visits = response.data;
        } else if (response.visits && Array.isArray(response.visits)) {
            visits = response.visits;
        } else {
            console.error('Format réponse inattendu:', response);
            throw new Error('Format de réponse invalide');
        }

        return visits.map((v: any) => ({
            id: v.id,
            date: new Date(v.createdAt).toLocaleString('fr-FR'),
            status: v.status as VisitStatus,
            message: v.message || undefined,
            teacherNames: v.location ? [v.location.name] : [],
        }));

    },

    deleteVisit: async (id: string): Promise<void> => {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`${API_URL}/api/visits/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error('Erreur lors de la suppression');
    },

    // ===== INTEGRATIONS =====
    getCalendarEvents: async (email: string): Promise<any[]> => {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`${API_URL}/api/integrations/events?email=${email}`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error('Erreur lors de la récupération du calendrier');
        return res.json();
    },
};
