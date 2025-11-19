import React, { useEffect, useState } from 'react';
import {
    Container,
    Paper,
    Typography,
    Box,
    Button,
    CircularProgress,
    Stack,
    Chip
} from '@mui/material';
import DoorFrontIcon from '@mui/icons-material/DoorFront';
import SensorsIcon from '@mui/icons-material/Sensors';
import RefreshIcon from '@mui/icons-material/Refresh';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { api } from '../lib/api';

interface Location {
    id: string;
    name: string;
    description: string;
    calendarId: string;
    teamsWebhookUrl: string | null;
    createdAt: string;
    updatedAt: string;
}

interface Doorbell {
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

export function Devices() {
    const [doorbells, setDoorbells] = useState<Doorbell[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    // 🔄 Récupération depuis l'API
    const fetchDoorbells = async () => {
        setLoading(true);
        setMessage('');
        try {
            const data = await api.getDoorbells();
            // Extraction du tableau depuis l'objet retourné
            const doorbellsArray = Array.isArray(data) ? data : [];
            setDoorbells(doorbellsArray);
            setMessage('Liste des sonnettes mise à jour');
        } catch (err) {
            console.error('Erreur fetchDoorbells:', err);
            setMessage('Erreur lors du chargement des sonnettes');
            setDoorbells([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDoorbells();
    }, []);

    // Activation/Désactivation d'une sonnette
    const toggleDoorbell = async (doorbell: Doorbell) => {
        const newStatus = !doorbell.isOnline;

        // Mise à jour locale immédiate
        setDoorbells(prev =>
            prev.map(d =>
                d.id === doorbell.id
                    ? { ...d, isOnline: newStatus }
                    : d
            )
        );

        /*try {
            await api.updateDoorbell(doorbell.id, { isOnline: newStatus });
            setMessage(`Statut mis à jour pour ${doorbell.deviceId}`);
        } catch (err) {
            console.error('Erreur toggleDoorbell:', err);
            setMessage(`Erreur lors du changement de statut`);
            // Rollback en cas d'erreur
            setDoorbells(prev =>
                prev.map(d =>
                    d.id === doorbell.id
                        ? { ...d, isOnline: doorbell.isOnline }
                        : d
                )
            );
        }*/
    }; 

    // Format de la date de dernière connexion
    const formatLastSeen = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'À l\'instant';
        if (diffMins < 60) return `Il y a ${diffMins} min`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `Il y a ${diffHours}h`;
        const diffDays = Math.floor(diffHours / 24);
        return `Il y a ${diffDays}j`;
    };

    return (
        <Container maxWidth="md" sx={{ mt: 4 }}>
            <Paper sx={{ p: 4 }}>
                <Box display="flex" alignItems="center" gap={2} mb={3}>
                    <DoorFrontIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                    <Typography variant="h4">
                        Sonnettes Connectées
                    </Typography>
                </Box>

                <Stack direction="row" spacing={2} mb={3}>
                    <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={fetchDoorbells}
                        disabled={loading}
                    >
                        Actualiser
                    </Button>
                </Stack>

                {message && (
                    <Typography
                        color={message.includes('Erreur') ? 'error.main' : 'success.main'}
                        sx={{ mb: 2 }}
                    >
                        {message}
                    </Typography>
                )}

                {loading ? (
                    <Box display="flex" justifyContent="center" p={4}>
                        <CircularProgress />
                    </Box>
                ) : doorbells.length === 0 ? (
                    <Typography color="text.secondary" textAlign="center" py={4}>
                        Aucune sonnette configurée
                    </Typography>
                ) : (
                    <Stack spacing={2}>
                        {doorbells.map(doorbell => (
                            <Box
                                key={doorbell.id}
                                sx={{
                                    p: 2,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    backgroundColor: doorbell.isOnline
                                        ? 'success.light'
                                        : 'grey.100',
                                }}
                            >
                                <Box flex={1}>
                                    <Typography variant="h6">
                                        {doorbell.deviceId}
                                    </Typography>

                                    <Box display="flex" alignItems="center" gap={0.5} mt={0.5}>
                                        <LocationOnIcon fontSize="small" color="action" />
                                        <Typography fontSize={14} color="text.secondary">
                                            {doorbell.location?.name ?? '—'}
                                        </Typography>
                                    </Box>

                                    {doorbell.location?.description && (
                                        <Typography fontSize={12} color="text.secondary" sx={{ mt: 0.5 }}>
                                            {doorbell.location.description}
                                        </Typography>
                                    )}

                                    <Stack direction="row" spacing={1} mt={1.5}>
                                        <Chip
                                            label={doorbell.isOnline ? 'En ligne' : 'Hors ligne'}
                                            color={doorbell.isOnline ? 'success' : 'default'}
                                            size="small"
                                        />

                                        {doorbell.hasDoorSensor && (
                                            <Chip
                                                icon={<SensorsIcon />}
                                                label="Capteur de porte"
                                                color="info"
                                                size="small"
                                            />
                                        )}

                                        <Chip
                                            label={formatLastSeen(doorbell.lastSeen)}
                                            size="small"
                                            variant="outlined"
                                        />
                                    </Stack>
                                </Box>

                                <Button
                                    variant="contained"
                                    color={doorbell.isOnline ? 'error' : 'success'}
                                    onClick={() => toggleDoorbell(doorbell)}
                                >
                                    {doorbell.isOnline ? 'Désactiver' : 'Activer'}
                                </Button>
                            </Box>
                        ))}
                    </Stack>
                )}
            </Paper>
        </Container>
    );
}