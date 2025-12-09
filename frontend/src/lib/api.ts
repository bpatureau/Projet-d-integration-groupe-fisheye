// frontend/src/lib/api.ts
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
    targetTeacherName?: string;
}

export interface Location {
    id: string;
    name: string;
    description: string;
    calendarId: string | undefined;
    teamsWebhookUrl: string | undefined;
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

export interface Panel {
    id: string;
    deviceId: string;
    mqttClientId: string;
    locationId: string;
    selectedTeacherId: string | null;
    isOnline: boolean;
    lastSeen: string;
    createdAt: string;
    updatedAt: string;
    location: Location;
    selectedTeacher: Teacher | null;
}

export interface Message {
    id: string;
    text: string;
    senderInfo: string;
    visitId: string | null;
    targetTeacherId: string | null;
    targetLocationId: string | null;
    isRead: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface Schedule {
    id: string;
    calendarId: string;
    eventId: string;
    locationId: string;
    teacherEmail: string;
    summary: string;
    description: string;
    startTime: string;
    endTime: string;
    allDay: boolean;
    lastSync: string;
    createdAt: string;
    updatedAt: string;
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
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`HTTP ${res.status}: ${errorText}`);
        }

        const response = await res.json();

        let visits: any[] = [];
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

        return visits.map((v: any) => {
            const textMessage =
                Array.isArray(v.messages) && v.messages.length > 0
                    ? v.messages[0].text
                    : undefined;

            return {
                id: v.id,
                date: new Date(v.createdAt).toLocaleString('fr-FR'),
                status: v.status as VisitStatus,
                message: textMessage,
                teacherNames: v.location ? [v.location.name] : [],
                targetTeacherName: v.targetTeacher ? v.targetTeacher.name : undefined,
            } as VisitEvent;
        });
    },

    getMessages: async (): Promise<Message[]> => {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`${API_URL}/api/messages`, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`HTTP ${res.status}: ${errorText}`);
        }

        const response = await res.json();
        if (Array.isArray(response.messages)) {
            return response.messages;
        }
        if (Array.isArray(response)) {
            return response;
        }
        console.error('Format messages inattendu:', response);
        return [];
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
        console.log(data.doorbells);
        return data.doorbells;
    },

    getLocations: async (): Promise<Location[]> => {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_URL}/api/locations`, {
            headers: { Authorization: `Bearer ${token}` },
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
        const response = await fetch(`${API_URL}/api/doorbells`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(data),
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
    },

    createLocation: async (data: {
        name: string;
        description: string;
        calendarId?: string | undefined;
        teamsWebhookUrl?: string | undefined;
    }): Promise<Location> => {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_URL}/api/locations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Erreur création emplacement');
        const result = await response.json();
        return result.location || result;
    },

    getPanels: async (): Promise<Panel[]> => {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`${API_URL}/api/panels`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
            throw new Error('Erreur lors de la récupération des panels');
        }
        const data = await res.json();
        console.log(data.panels);
        return data.panels;
    },

    createPanel: async (data: {
        deviceId: string;
        mqttClientId: string;
        locationId: string;
    }): Promise<Panel> => {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_URL}/api/panels`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Erreur création panel');
        return response.json();
    },

    deletePanel: async (id: string): Promise<void> => {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`${API_URL}/api/panels/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error('Erreur lors de la suppression du panel');
    },

    deleteLocation: async (id: string): Promise<void> => {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`${API_URL}/api/locations/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Erreur lors de la suppression de l'emplacement");
    },
    getLocationSchedules: async (locationId: string): Promise<Schedule[]> => {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`${API_URL}/api/schedules/location/${locationId}`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`HTTP ${res.status}: ${errorText}`);
        }

        const data = await res.json();
        if (Array.isArray(data.schedules)) {
            return data.schedules;
        }
        if (Array.isArray(data)) {
            return data;
        }
        console.error('Format schedules inattendu:', data);
        return [];
    }
};
