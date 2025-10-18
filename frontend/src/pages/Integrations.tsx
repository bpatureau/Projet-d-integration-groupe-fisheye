import { useEffect, useState } from 'react';
import {
    Container,
    Paper,
    Typography,
    Button,
    Box,
    Divider,
    List,
    ListItem,
    ListItemText,
    CircularProgress,
    Stack
} from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';

interface CalendarEvent {
    id: string;
    title: string;
    start: string;
    end: string;
    provider: 'google' | 'outlook' | 'teams';
}

export function Integrations() {
    const [params] = useSearchParams();
    const status = params.get('status');
    const [message, setMessage] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [settings, setSettings] = useState({
        google: false,
        outlook: false,
        teams: false
    });
    const [events, setEvents] = useState<CalendarEvent[]>([]);

    useEffect(() => {
        api.getIntegrations().then(data => setSettings(data));
    }, []);

    useEffect(() => {
        if (status === 'success') setMessage('Connexion réussie');
        else if (status === 'error') setMessage('Échec de la connexion');
    }, [status]);

    const connect = (provider: keyof typeof settings) => {
        window.location.href = `/api/oauth/${provider}`;
    };

    const disconnect = async (provider: keyof typeof settings) => {
        setLoading(true);
        await api.updateIntegrations({ [provider]: false });
        setSettings(prev => ({ ...prev, [provider]: false }));
        setMessage(`${provider.charAt(0).toUpperCase() + provider.slice(1)} déconnecté`);
        setLoading(false);
    };

    const fetchEvents = async (provider: keyof typeof settings) => {
        setLoading(true);
        const data = await api.getCalendarEvents(provider);
        setEvents(data);
        setLoading(false);
    };

    return (
        <Container maxWidth="md" sx={{ mt: 4 }}>
            <Paper sx={{ p: 4 }}>
                <Typography variant="h4" gutterBottom>
                    Intégrations
                </Typography>

                {message && (
                    <Typography
                        color={status === 'success' ? 'success.main' : 'error.main'}
                        sx={{ mb: 2 }}
                    >
                        {message}
                    </Typography>
                )}

                {/* Services */}
                <Box
                    sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 2,
                        mb: 4
                    }}
                >
                    {(['google', 'outlook', 'teams'] as Array<keyof typeof settings>).map(provider => (
                        <Box
                            key={provider}
                            sx={{
                                flex: '1 1 calc(33.333% - 16px)',
                                minWidth: 200,
                                p: 2,
                                border: '1px solid',
                                borderColor: 'divider',
                                borderRadius: 1
                            }}
                        >
                            <Stack spacing={1} alignItems="center">
                                <Typography variant="subtitle1" textTransform="capitalize">
                                    {provider}
                                </Typography>
                                {settings[provider] ? (
                                    <>
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            fullWidth
                                            onClick={() => disconnect(provider)}
                                            disabled={loading}
                                        >
                                            Déconnecter
                                        </Button>
                                        <Button
                                            variant="contained"
                                            size="small"
                                            fullWidth
                                            onClick={() => fetchEvents(provider)}
                                            disabled={loading}
                                        >
                                            Voir événements
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        variant="contained"
                                        size="small"
                                        fullWidth
                                        onClick={() => connect(provider)}
                                    >
                                        Se connecter
                                    </Button>
                                )}
                            </Stack>
                        </Box>
                    ))}
                </Box>

                <Divider />

                {/* Événements */}
                <Box sx={{ mt: 4 }}>
                    <Typography variant="h6" gutterBottom>
                        Événements du calendrier
                    </Typography>
                    {loading && <CircularProgress />}
                    {!loading && events.length === 0 && (
                        <Typography color="text.secondary">
                            Aucun événement chargé.
                        </Typography>
                    )}
                    {!loading && events.length > 0 && (
                        <List>
                            {events.map(ev => (
                                <ListItem key={ev.id}>
                                    <ListItemText
                                        primary={`${ev.title} (${ev.provider})`}
                                        secondary={`${ev.start} — ${ev.end}`}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    )}
                </Box>
            </Paper>
        </Container>
    );
}
