import React, { useEffect, useState } from 'react';
import {
    Container,
    Paper,
    Typography,
    Box,
    Button,
    CircularProgress,
    Stack,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControlLabel,
    Switch,
    MenuItem
} from '@mui/material';
import DoorFrontIcon from '@mui/icons-material/DoorFront';
import SensorsIcon from '@mui/icons-material/Sensors';
import RefreshIcon from '@mui/icons-material/Refresh';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
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

interface NewDoorbellForm {
    deviceId: string;
    mqttClientId: string;
    locationId: string;
    hasDoorSensor: boolean;
}

export function Devices() {
    const [doorbells, setDoorbells] = useState<Doorbell[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [openDialog, setOpenDialog] = useState(false);
    const [formData, setFormData] = useState<NewDoorbellForm>({
        deviceId: '',
        mqttClientId: '',
        locationId: '',
        hasDoorSensor: false
    });

    // Récupération depuis l'API
    const fetchDoorbells = async () => {
        setLoading(true);
        setMessage('');
        try {
            const data = await api.getDoorbells();
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

    // Récupération des emplacements
    const fetchLocations = async () => {
        try {
            const data = await api.getLocations();
            setLocations(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Erreur fetchLocations:', err);
        }
    };

    useEffect(() => {
        fetchDoorbells();
        fetchLocations();
    }, []);

    // Ouverture du dialogue
    const handleOpenDialog = () => {
        setFormData({
            deviceId: '',
            mqttClientId: '',
            locationId: locations.length > 0 ? locations[0].id : '',
            hasDoorSensor: false
        });
        setOpenDialog(true);
    };

    // Fermeture du dialogue
    const handleCloseDialog = () => {
        setOpenDialog(false);
        setMessage('');
    };

    // Création d'une nouvelle sonnette
    const handleCreateDoorbell = async () => {
        if (!formData.deviceId || !formData.mqttClientId || !formData.locationId) {
            setMessage('Veuillez remplir tous les champs obligatoires');
            return;
        }

        try {
            await api.createDoorbell(formData);
            setMessage('Sonnette créée avec succès');
            handleCloseDialog();
            fetchDoorbells();
        } catch (err) {
            console.error('Erreur createDoorbell:', err);
            setMessage('Erreur lors de la création de la sonnette');
        }
    };

    // Activation/Désactivation d'une sonnette
    const toggleDoorbell = async (doorbell: Doorbell) => {
        const newStatus = !doorbell.isOnline;

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
    
    // Suppression d'une sonnette
    const handleDeleteDoorbell = async (doorbell: Doorbell) => {
        if (!window.confirm(`Êtes-vous sûr de vouloir supprimer la sonnette "${doorbell.deviceId}" ?`)) {
            return;
        }

        try {
            await api.deleteDoorbell(doorbell.id);
            setMessage(`Sonnette "${doorbell.deviceId}" supprimée avec succès`);
            fetchDoorbells();
        } catch (err) {
            console.error('Erreur deleteDoorbell:', err);
            setMessage('Erreur lors de la suppression de la sonnette');
        }
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
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleOpenDialog}
                    >
                        Ajouter une sonnette
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

                            <Stack direction="row" spacing={1}>
                                <Button
                                    variant="contained"
                                    color={doorbell.isOnline ? 'error' : 'success'}
                                    onClick={() => toggleDoorbell(doorbell)}
                                >
                                    {doorbell.isOnline ? 'Désactiver' : 'Activer'}
                                </Button>
                                <Button
                                    variant="outlined"
                                    color="error"
                                    startIcon={<DeleteIcon />}
                                    onClick={() => handleDeleteDoorbell(doorbell)}
                                >
                                    Supprimer
                                </Button>
                            </Stack>
                            </Box>
                        ))}
                    </Stack>
                )}
            </Paper>

            {/* Dialog pour créer une sonnette */}
            <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <DialogTitle>Ajouter une nouvelle sonnette</DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 2 }}>
                        <TextField
                            label="ID de l'appareil"
                            value={formData.deviceId}
                            onChange={e => setFormData({ ...formData, deviceId: e.target.value })}
                            fullWidth
                            required
                            helperText="Identifiant unique de la sonnette"
                        />

                        <TextField
                            label="ID du client MQTT"
                            value={formData.mqttClientId}
                            onChange={e => setFormData({ ...formData, mqttClientId: e.target.value })}
                            fullWidth
                            required
                            helperText="Identifiant pour la connexion MQTT"
                        />

                        <TextField
                            select
                            label="Emplacement"
                            value={formData.locationId}
                            onChange={e => setFormData({ ...formData, locationId: e.target.value })}
                            fullWidth
                            required
                        >
                            {locations.map(location => (
                                <MenuItem key={location.id} value={location.id}>
                                    {location.name}
                                </MenuItem>
                            ))}
                        </TextField>

                        <FormControlLabel
                            control={
                                <Switch
                                    checked={formData.hasDoorSensor}
                                    onChange={e => setFormData({ ...formData, hasDoorSensor: e.target.checked })}
                                />
                            }
                            label="Capteur de porte intégré"
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>
                        Annuler
                    </Button>
                    <Button 
                        onClick={handleCreateDoorbell} 
                        variant="contained"
                        disabled={!formData.deviceId || !formData.mqttClientId || !formData.locationId}
                    >
                        Créer
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
}