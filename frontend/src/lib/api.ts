const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

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

export interface Location {
    id: string;
    name: string;
    description: string;
    calendarId: string;
    teamsWebhookUrl: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface Doorbell {
    id: string;
    deviceId: string;
    mqttClientId: string;
    locationId: string;
    hasDoorSensor: boolean;
    isOnline: boolean;
    lastSeen: string;
    createdAt: string;
    updatedAt: string;
    location: Location;
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
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error('Erreur lors de la récupération des visites');
        return res.json();
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

    // ===== Devices ======
    getDoorbells: async (): Promise<Doorbell[]> => {
    const token = localStorage.getItem('auth_token');

    const res = await fetch(`${API_URL}/api/doorbells`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
        throw new Error('Erreur lors de la récupération des sonnettes');
    }

    const data = await res.json();
    console.log(data.doorbells)
    return data.doorbells;
    },

    getLocations: async (): Promise<Location[]> => {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_URL}/api/locations`, {  // Ajout de /api/
            headers: { Authorization: `Bearer ${token}` },  // Ajout du token
        });
        if (!response.ok) throw new Error('Erreur récupération emplacements');
        const data = await response.json();
        console.log('Locations reçues:', data);
        return data.locations || [];
    },

    createDoorbell: async (data: {
        deviceId: string;
        mqttClientId: string;
        locationId: string;
        hasDoorSensor: boolean;
    }): Promise<Doorbell> => {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_URL}/api/doorbells`, {  // Ajout de /api/
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`  // Ajout du token
            },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Erreur création sonnette');
        return response.json();
    },
    
    deleteDoorbell: async (id: string): Promise<void> => {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`${API_URL}/api/doorbells/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error('Erreur lors de la suppression de la sonnette');
    }

};
