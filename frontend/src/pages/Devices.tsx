import { useEffect, useState } from 'react';
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
import TabletIcon from '@mui/icons-material/Tablet';
import AddLocationIcon from '@mui/icons-material/AddLocation';
import PlaceIcon from '@mui/icons-material/Place';
import { api, type Panel, type Location, type Doorbell } from '../lib/api';

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
        fetchPanels();
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

    const handleRefresh = () => {
        fetchDoorbells();
        fetchPanels();
    };

    // Gestion des panels

    const [panels, setPanels] = useState<Panel[]>([]);
    const [openPanelDialog, setOpenPanelDialog] = useState(false);
    const [panelFormData, setPanelFormData] = useState({
        deviceId: '',
        mqttClientId: '',
        locationId: ''
    });
    // Récupération des panels
    const fetchPanels = async () => {
        try {
            const data = await api.getPanels();
            setPanels(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Erreur fetchPanels:', err);
            setMessage('Erreur lors du chargement des panels');
            setPanels([]);
        }
    };

    // Ouverture du dialogue de création de panel
    const handleOpenPanelDialog = () => {
        setPanelFormData({
            deviceId: '',
            mqttClientId: '',
            locationId: locations.length > 0 ? locations[0].id : ''
        });
        setOpenPanelDialog(true);
    };

    // Fermeture du dialogue
    const handleClosePanelDialog = () => {
        setOpenPanelDialog(false);
        setMessage('');
    };

    // Création d'un nouveau panel
    const handleCreatePanel = async () => {
        if (!panelFormData.deviceId || !panelFormData.mqttClientId || !panelFormData.locationId) {
            setMessage('Veuillez remplir tous les champs obligatoires');
            return;
        }

        try {
            await api.createPanel(panelFormData);
            setMessage('Panel créé avec succès');
            handleClosePanelDialog();
            fetchPanels();
        } catch (err) {
            console.error('Erreur createPanel:', err);
            setMessage('Erreur lors de la création du panel');
        }
    };

    // Suppression d'un panel
    const handleDeletePanel = async (panel: Panel) => {
        if (!window.confirm(`Êtes-vous sûr de vouloir supprimer le panel "${panel.deviceId}" ?`)) {
            return;
        }

        try {
            await api.deletePanel(panel.id);
            setMessage(`Panel "${panel.deviceId}" supprimé avec succès`);
            fetchPanels();
        } catch (err) {
            console.error('Erreur deletePanel:', err);
            setMessage('Erreur lors de la suppression du panel');
        }
    };

    // Activation/Désactivation d'un panel
    const togglePanel = async (panel: Panel) => {
        const newStatus = !panel.isOnline;

        setPanels(prev =>
            prev.map(p =>
                p.id === panel.id
                    ? { ...p, isOnline: newStatus }
                    : p
            )
        );
    };

    //gestion emplacement

    const [openLocationDialog, setOpenLocationDialog] = useState(false);
    const [locationFormData, setLocationFormData] = useState({
        name: '',
        description: '',
        calendarId: '',
        teamsWebhookUrl: ''
    });

    // Ouverture du dialogue de création d'emplacement
    const handleOpenLocationDialog = () => {
        setLocationFormData({
            name: '',
            description: '',
            calendarId: '',
            teamsWebhookUrl: ''
        });
        setOpenLocationDialog(true);
    };

    // Fermeture du dialogue
    const handleCloseLocationDialog = () => {
        setOpenLocationDialog(false);
    };

    // Création d'un nouvel emplacement
    const handleCreateLocation = async () => {
        if (!locationFormData.name) {  // Retirer la vérification de calendarId
            setMessage('Veuillez remplir le nom de l\'emplacement');
            return;
        }

        try {
            const newLocation = await api.createLocation({
                name: locationFormData.name,
                description: locationFormData.description,
                calendarId: locationFormData.calendarId || undefined,  // Envoyer null si vide
                teamsWebhookUrl: locationFormData.teamsWebhookUrl || undefined
            });
            setMessage(`Emplacement "${newLocation.name}" créé avec succès`);
            handleCloseLocationDialog();
            await fetchLocations();
            
            // Sélectionner automatiquement le nouvel emplacement dans le formulaire actif
            if (openDialog) {
                setFormData({ ...formData, locationId: newLocation.id });
            }
            if (openPanelDialog) {
                setPanelFormData({ ...panelFormData, locationId: newLocation.id });
            }
        } catch (err) {
            console.error('Erreur createLocation:', err);
            setMessage('Erreur lors de la création de l\'emplacement');
        }
    };

    // Suppression d'un emplacement
    const handleDeleteLocation = async (location: Location) => {
        // Vérifier si l'emplacement est utilisé par des sonnettes ou panels
        const usedByDoorbells = doorbells.some(d => d.locationId === location.id);
        const usedByPanels = panels.some(p => p.locationId === location.id);
        
        if (usedByDoorbells || usedByPanels) {
            setMessage('Impossible de supprimer : cet emplacement est utilisé par des sonnettes ou des panels');
            return;
        }

        if (!window.confirm(`Êtes-vous sûr de vouloir supprimer l'emplacement "${location.name}" ?`)) {
            return;
        }

        try {
            await api.deleteLocation(location.id);
            setMessage(`Emplacement "${location.name}" supprimé avec succès`);
            fetchLocations();
        } catch (err) {
            console.error('Erreur deleteLocation:', err);
            setMessage('Erreur lors de la suppression de l\'emplacement');
        }
    };
    // Ouverture du dialogue de création d'emplacement (standalone)
    const handleOpenLocationDialogStandalone = () => {
        setLocationFormData({
            name: '',
            description: '',
            calendarId: '',
            teamsWebhookUrl: ''
        });
        setOpenLocationDialog(true);
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
                        onClick={handleRefresh}
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
                            <MenuItem 
                                value="" 
                                sx={{ 
                                    fontWeight: 'bold', 
                                    backgroundColor: 'action.hover',
                                    '&:hover': { backgroundColor: 'action.selected' }
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenLocationDialog();
                                }}
                            >
                                <Box display="flex" alignItems="center" gap={1}>
                                    <AddLocationIcon />
                                    <Typography>Créer un nouvel emplacement</Typography>
                                </Box>
                            </MenuItem>
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

            <Paper sx={{ p: 4, mt: 4 }}>
                <Box display="flex" alignItems="center" gap={2} mb={3}>
                    <TabletIcon sx={{ fontSize: 40, color: 'secondary.main' }} />
                    <Typography variant="h4">
                        Panels d'Affichage
                    </Typography>
                </Box>

                <Stack direction="row" spacing={2} mb={3}>
                    <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={fetchPanels}
                        disabled={loading}
                    >
                        Actualiser
                    </Button>
                    <Button
                        variant="contained"
                        color="secondary"
                        startIcon={<AddIcon />}
                        onClick={handleOpenPanelDialog}
                    >
                        Ajouter un panel
                    </Button>
                </Stack>

                {panels.length === 0 ? (
                    <Typography color="text.secondary" textAlign="center" py={4}>
                        Aucun panel configuré
                    </Typography>
                ) : (
                    <Stack spacing={2}>
                        {panels.map(panel => (
                            <Box
                                key={panel.id}
                                sx={{
                                    p: 2,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    backgroundColor: panel.isOnline
                                        ? 'secondary.light'
                                        : 'grey.100',
                                }}
                            >
                                <Box flex={1}>
                                    <Typography variant="h6">
                                        {panel.deviceId}
                                    </Typography>

                                    <Box display="flex" alignItems="center" gap={0.5} mt={0.5}>
                                        <LocationOnIcon fontSize="small" color="action" />
                                        <Typography fontSize={14} color="text.secondary">
                                            {panel.location?.name ?? '—'}
                                        </Typography>
                                    </Box>

                                    {panel.location?.description && (
                                        <Typography fontSize={12} color="text.secondary" sx={{ mt: 0.5 }}>
                                            {panel.location.description}
                                        </Typography>
                                    )}

                                    {panel.selectedTeacher && (
                                        <Typography fontSize={12} color="info.main" sx={{ mt: 0.5 }}>
                                            Prof sélectionné: {panel.selectedTeacher.name}
                                        </Typography>
                                    )}

                                    <Stack direction="row" spacing={1} mt={1.5}>
                                        <Chip
                                            label={panel.isOnline ? 'En ligne' : 'Hors ligne'}
                                            color={panel.isOnline ? 'secondary' : 'default'}
                                            size="small"
                                        />

                                        <Chip
                                            label={formatLastSeen(panel.lastSeen)}
                                            size="small"
                                            variant="outlined"
                                        />
                                    </Stack>
                                </Box>

                                <Stack direction="row" spacing={1}>
                                    <Button
                                        variant="contained"
                                        color={panel.isOnline ? 'error' : 'secondary'}
                                        onClick={() => togglePanel(panel)}
                                    >
                                        {panel.isOnline ? 'Désactiver' : 'Activer'}
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        color="error"
                                        startIcon={<DeleteIcon />}
                                        onClick={() => handleDeletePanel(panel)}
                                    >
                                        Supprimer
                                    </Button>
                                </Stack>
                            </Box>
                        ))}
                    </Stack>
                )}
            </Paper>

            {/* Dialog pour créer un panel */}
            <Dialog open={openPanelDialog} onClose={handleClosePanelDialog} maxWidth="sm" fullWidth>
                <DialogTitle>Ajouter un nouveau panel</DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 2 }}>
                        <TextField
                            label="ID de l'appareil"
                            value={panelFormData.deviceId}
                            onChange={e => setPanelFormData({ ...panelFormData, deviceId: e.target.value })}
                            fullWidth
                            required
                            helperText="Identifiant unique du panel"
                        />

                        <TextField
                            label="ID du client MQTT"
                            value={panelFormData.mqttClientId}
                            onChange={e => setPanelFormData({ ...panelFormData, mqttClientId: e.target.value })}
                            fullWidth
                            required
                            helperText="Identifiant pour la connexion MQTT"
                        />

                        <TextField
                            select
                            label="Emplacement"
                            value={panelFormData.locationId}
                            onChange={e => setPanelFormData({ ...panelFormData, locationId: e.target.value })}
                            fullWidth
                            required
                        >
                            <MenuItem 
                                value="" 
                                sx={{ 
                                    fontWeight: 'bold', 
                                    backgroundColor: 'action.hover',
                                    '&:hover': { backgroundColor: 'action.selected' }
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenLocationDialog();
                                }}
                            >
                                <Box display="flex" alignItems="center" gap={1}>
                                    <AddLocationIcon />
                                    <Typography>Créer un nouvel emplacement</Typography>
                                </Box>
                            </MenuItem>
                            {locations.map(location => (
                                <MenuItem key={location.id} value={location.id}>
                                    {location.name}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClosePanelDialog}>
                        Annuler
                    </Button>
                    <Button 
                        onClick={handleCreatePanel} 
                        variant="contained"
                        color="secondary"
                        disabled={!panelFormData.deviceId || !panelFormData.mqttClientId || !panelFormData.locationId}
                    >
                        Créer
                    </Button>
                </DialogActions>
            </Dialog>
            {/* Dialog pour créer un emplacement */}
            <Dialog open={openLocationDialog} onClose={handleCloseLocationDialog} maxWidth="sm" fullWidth>
                <DialogTitle>Créer un nouvel emplacement</DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 2 }}>
                        <TextField
                            label="Nom de l'emplacement"
                            value={locationFormData.name}
                            onChange={e => setLocationFormData({ ...locationFormData, name: e.target.value })}
                            fullWidth
                            required
                            helperText="Ex: Bureau des professeurs, Salle 101..."
                        />

                        <TextField
                            label="Description"
                            value={locationFormData.description}
                            onChange={e => setLocationFormData({ ...locationFormData, description: e.target.value })}
                            fullWidth
                            multiline
                            rows={2}
                            helperText="Description optionnelle de l'emplacement"
                        />
                        <TextField
                            label="ID du calendrier Google (optionnel)"
                            value={locationFormData.calendarId}
                            onChange={e => setLocationFormData({ ...locationFormData, calendarId: e.target.value })}
                            fullWidth
                            helperText="L'identifiant du calendrier Google associé (facultatif)"
                        />

                        <TextField
                            label="URL du webhook Teams (optionnel)"
                            value={locationFormData.teamsWebhookUrl}
                            onChange={e => setLocationFormData({ ...locationFormData, teamsWebhookUrl: e.target.value })}
                            fullWidth
                            helperText="URL du webhook Microsoft Teams pour les notifications"
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseLocationDialog}>
                        Annuler
                    </Button>
                    <Button 
                        onClick={handleCreateLocation} 
                        variant="contained"
                        disabled={!locationFormData.name}  // Seul le nom est requis maintenant
                    >
                        Créer
                    </Button>
                </DialogActions>
            </Dialog>
            {/* Section Emplacements */}
            <Paper sx={{ p: 4, mt: 4 }}>
                <Box display="flex" alignItems="center" gap={2} mb={3}>
                    <PlaceIcon sx={{ fontSize: 40, color: 'info.main' }} />
                    <Typography variant="h4">
                        Emplacements
                    </Typography>
                </Box>

                <Stack direction="row" spacing={2} mb={3}>
                    <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={fetchLocations}
                        disabled={loading}
                    >
                        Actualiser
                    </Button>
                    <Button
                        variant="contained"
                        color="info"
                        startIcon={<AddIcon />}
                        onClick={handleOpenLocationDialogStandalone}
                    >
                        Ajouter un emplacement
                    </Button>
                </Stack>

                {locations.length === 0 ? (
                    <Typography color="text.secondary" textAlign="center" py={4}>
                        Aucun emplacement configuré
                    </Typography>
                ) : (
                    <Stack spacing={2}>
                        {locations.map(location => {
                            // Compter l'utilisation
                            const doorbellCount = doorbells.filter(d => d.locationId === location.id).length;
                            const panelCount = panels.filter(p => p.locationId === location.id).length;
                            const isInUse = doorbellCount > 0 || panelCount > 0;

                            return (
                                <Box
                                    key={location.id}
                                    sx={{
                                        p: 2,
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        backgroundColor: 'grey.50',
                                    }}
                                >
                                    <Box flex={1}>
                                        <Typography variant="h6">
                                            {location.name}
                                        </Typography>

                                        {location.description && (
                                            <Typography fontSize={14} color="text.secondary" sx={{ mt: 0.5 }}>
                                                {location.description}
                                            </Typography>
                                        )}

                                        <Typography fontSize={12} color="text.secondary" sx={{ mt: 1 }}>
                                            ID Calendrier: {location.calendarId || 'Non configuré'}
                                        </Typography>

                                        {location.teamsWebhookUrl && (
                                            <Typography fontSize={12} color="text.secondary" sx={{ mt: 0.5 }}>
                                                Webhook Teams configuré ✓
                                            </Typography>
                                        )}

                                        <Stack direction="row" spacing={1} mt={1.5}>
                                            {doorbellCount > 0 && (
                                                <Chip
                                                    icon={<DoorFrontIcon />}
                                                    label={`${doorbellCount} sonnette${doorbellCount > 1 ? 's' : ''}`}
                                                    color="primary"
                                                    size="small"
                                                    variant="outlined"
                                                />
                                            )}
                                            {panelCount > 0 && (
                                                <Chip
                                                    icon={<TabletIcon />}
                                                    label={`${panelCount} panel${panelCount > 1 ? 's' : ''}`}
                                                    color="secondary"
                                                    size="small"
                                                    variant="outlined"
                                                />
                                            )}
                                            {!isInUse && (
                                                <Chip
                                                    label="Non utilisé"
                                                    size="small"
                                                    variant="outlined"
                                                />
                                            )}
                                        </Stack>
                                    </Box>

                                    <Button
                                        variant="outlined"
                                        color="error"
                                        startIcon={<DeleteIcon />}
                                        onClick={() => handleDeleteLocation(location)}
                                        disabled={isInUse}
                                    >
                                        Supprimer
                                    </Button>
                                </Box>
                            );
                        })}
                    </Stack>
                )}
            </Paper>
        </Container>
    );
}