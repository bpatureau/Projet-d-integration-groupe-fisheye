import { useState, useEffect } from 'react';
import {
    Container,
    Typography,
    FormControlLabel,
    Switch,
    Button,
    Box,
    Paper
} from '@mui/material';
import { api } from '../lib/api';

export function Integrations() {
    const [settings, setSettings] = useState({
        google: false,
        outlook: false,
        teams: false
    });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string>('');

    // Chargement initial
    useEffect(() => {
        api.getIntegrations().then(data => setSettings(data));
    }, []);

    const handleToggle = (key: keyof typeof settings) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.updateIntegrations(settings);
            setMessage('Paramètres enregistrés');
        } catch {
            setMessage('Erreur lors de l’enregistrement');
        } finally {
            setSaving(false);
            setTimeout(() => setMessage(''), 3000);
        }
    };

    const handleSync = async () => {
        setSaving(true);
        try {
            await api.syncCalendars();
            setMessage('Synchronisation réussie');
        } catch {
            setMessage('Erreur de synchronisation');
        } finally {
            setSaving(false);
            setTimeout(() => setMessage(''), 3000);
        }
    };

    return (
        <Container maxWidth="sm" sx={{ mt: 4 }}>
            <Paper sx={{ p: 4 }}>
                <Typography variant="h4" gutterBottom>
                    Intégrations
                </Typography>
                <Box display="flex" flexDirection="column" gap={2} mb={3}>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={settings.google}
                                onChange={() => handleToggle('google')}
                            />
                        }
                        label="Google Calendar"
                    />
                    <FormControlLabel
                        control={
                            <Switch
                                checked={settings.outlook}
                                onChange={() => handleToggle('outlook')}
                            />
                        }
                        label="Outlook Calendar"
                    />
                    <FormControlLabel
                        control={
                            <Switch
                                checked={settings.teams}
                                onChange={() => handleToggle('teams')}
                            />
                        }
                        label="Microsoft Teams"
                    />
                </Box>
                {message && (
                    <Typography color="primary" sx={{ mb: 2 }}>
                        {message}
                    </Typography>
                )}
                <Box display="flex" gap={2}>
                    <Button
                        variant="contained"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        Enregistrer
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={handleSync}
                        disabled={saving}
                    >
                        Synchroniser maintenant
                    </Button>
                </Box>
            </Paper>
        </Container>
    );
}
