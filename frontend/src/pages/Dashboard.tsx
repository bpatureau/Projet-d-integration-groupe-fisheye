// frontend/src/pages/Dashboard.tsx
import { useState, useEffect } from 'react';
import {
    Container,
    Typography,
    Card,
    CardHeader,
    CardContent,
    Button,
    TextField,
    Select,
    MenuItem,
    Box,
    Stack,
    Chip,
    IconButton,
    Snackbar,
    Alert,
    CircularProgress
} from '@mui/material';
import {
    Delete as DeleteIcon,
    Check as CheckIcon,
    DoneAll as DoneAllIcon
} from '@mui/icons-material';
import { useWebSocket } from '../hooks/useWebSocket';
import { api, type VisitEvent, type VisitStatus, type Message } from '../lib/api';

export function Dashboard() {
    const { events: wsEvents } = useWebSocket('/ws');
    const [visits, setVisits] = useState<VisitEvent[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [filterVisits, setFilterVisits] = useState<'all' | 'missed'>('all');
    const [filterMessages, setFilterMessages] = useState<'all' | 'unread'>('all');
    const [searchVisits, setSearchVisits] = useState('');
    const [searchMessages, setSearchMessages] = useState('');
    const [stats, setStats] = useState({ total: 0, missed: 0, today: 0 });
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
        open: false,
        message: '',
        severity: 'success'
    });
    const [loadingActions, setLoadingActions] = useState<{ [key: string]: boolean }>({});

    useEffect(() => {
        Promise.all([api.getEvents(), api.getMessages()])
            .then(([visitsData, messagesData]) => {
                const sortedVisits = sortByDateDesc(visitsData);
                setVisits(sortedVisits);
                setMessages(sortMessagesByDateDesc(messagesData));
                computeStats(sortedVisits);
            })
            .catch(error => {
                console.error('Erreur chargement visites/messages:', error);
                setSnackbar({
                    open: true,
                    message: 'Erreur de chargement',
                    severity: 'error'
                });
            });
    }, []);

    useEffect(() => computeStats(visits), [visits]);

    useEffect(() => {
        if (wsEvents.length) {
            const ev = wsEvents[0];
            setVisits(prev => sortByDateDesc([ev, ...prev]));
        }
    }, [wsEvents]);

    const sortByDateDesc = (data: VisitEvent[]): VisitEvent[] =>
        [...data].sort((a, b) => {
            const da = new Date(a.date).getTime();
            const db = new Date(b.date).getTime();
            return db - da;
        });

    const sortMessagesByDateDesc = (data: Message[]): Message[] =>
        [...data].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const computeStats = (data: VisitEvent[]) => {
        const todayStr = new Date().toLocaleDateString('fr-FR');
        setStats({
            total: data.length,
            missed: data.filter(v => v.status === 'missed').length,
            today: data.filter(v => v.date.startsWith(todayStr)).length,
        });
    };

    const refresh = () => {
        Promise.all([api.getEvents(), api.getMessages()])
            .then(([visitsData, messagesData]) => {
                setVisits(sortByDateDesc(visitsData));
                setMessages(sortMessagesByDateDesc(messagesData));
            })
            .catch(err => {
                console.error('Erreur refresh:', err);
                setSnackbar({
                    open: true,
                    message: 'Erreur actualisation',
                    severity: 'error'
                });
            });
    };

    const handleDeleteVisit = (id: string) =>
        api.deleteVisit(id).then(refresh).catch(err => {
            console.error('Erreur suppression visite:', err);
            setSnackbar({
                open: true,
                message: 'Erreur suppression visite',
                severity: 'error'
            });
        });

    const setLoading = (messageId: string, loading: boolean) => {
        setLoadingActions(prev => ({ ...prev, [messageId]: loading }));
    };

    const handleMarkAsRead = async (messageId: string) => {
        setLoading(messageId, true);
        try {
            await api.markMessageAsRead(messageId);
            setMessages(prev =>
                prev.map(m =>
                    m.id === messageId ? { ...m, isRead: true, readAt: new Date().toISOString() } : m
                )
            );
            setSnackbar({
                open: true,
                message: 'Message marqué comme lu ✅',
                severity: 'success'
            });
        } catch (error) {
            console.error('Erreur marquage lu:', error);
            setSnackbar({
                open: true,
                message: 'Erreur marquage lu',
                severity: 'error'
            });
        } finally {
            setLoading(messageId, false);
        }
    };

    const handleMarkAllAsRead = async () => {
        const unreadMessages = messages.filter(m => !m.isRead);
        if (unreadMessages.length === 0) return;

        setLoadingActions(prev => ({ ...prev, 'all': true }));
        try {
            await api.markAllAsRead();
            setMessages(prev =>
                prev.map(m => !m.isRead ? { ...m, isRead: true, readAt: new Date().toISOString() } : m)
            );
            setSnackbar({
                open: true,
                message: `${unreadMessages.length} messages marqués lus ✅`,
                severity: 'success'
            });
        } catch (error) {
            console.error('Erreur marquage tous lus:', error);
            setSnackbar({
                open: true,
                message: 'Erreur marquage tous lus',
                severity: 'error'
            });
        } finally {
            setLoadingActions(prev => {
                const newState = { ...prev };
                delete newState['all'];
                return newState;
            });
        }
    };

    const displayedVisits = visits.filter(v =>
        (filterVisits === 'all' || v.status === 'missed') &&
        v.date.includes(searchVisits)
    );

    const displayedMessages = messages.filter(m =>
        (filterMessages === 'all' || (!m.isRead && filterMessages === 'unread')) &&
        (m.text.toLowerCase().includes(searchMessages.toLowerCase()) ||
            m.senderInfo.toLowerCase().includes(searchMessages.toLowerCase()))
    );

    const formatStatus = (status: VisitStatus): string => {
        switch (status) {
            case 'pending': return '⏳ En attente';
            case 'answered': return '✓ Décroché';
            case 'missed': return '❌ Manquée';
            default: return status;
        }
    };

    const findMessageForVisit = (visitId: string): string | undefined => {
        const msg = messages.find(m => m.visitId === visitId);
        return msg?.text;
    };

    const formatMessageDate = (date: string) => new Date(date).toLocaleString('fr-FR');

    const isLoading = (messageId: string) => loadingActions[messageId] || loadingActions['all'];

    return (
        <Container maxWidth="lg" sx={{ mt: 4 }}>
            <Typography variant="h4" gutterBottom>
                Tableau de bord
            </Typography>

            {/* Statistiques */}
            <Stack direction="row" spacing={2} mb={3}>
                {[
                    { label: 'Total visites', value: stats.total },
                    { label: 'Manquées', value: stats.missed },
                    { label: "Aujourd'hui", value: stats.today },
                ].map((s, i) => (
                    <Box key={i} sx={{ flex: 1 }}>
                        <Card>
                            <CardHeader title={s.label} subheader={s.value} />
                        </Card>
                    </Box>
                ))}
            </Stack>

            {/* SECTION VISITES */}
            <Card sx={{ mb: 4 }}>
                <CardHeader
                    title="📋 Historique des visites"
                    action={
                        <Stack direction="row" spacing={2} alignItems="center">
                            <TextField
                                size="small"
                                label="Rechercher par date"
                                value={searchVisits}
                                onChange={e => setSearchVisits(e.target.value)}
                                sx={{ width: 200 }}
                            />
                            <Select
                                size="small"
                                value={filterVisits}
                                onChange={e => setFilterVisits(e.target.value as 'all' | 'missed')}
                            >
                                <MenuItem value="all">Tous</MenuItem>
                                <MenuItem value="missed">Manquées</MenuItem>
                            </Select>
                            <Button variant="outlined" size="small" onClick={refresh}>
                                Actualiser
                            </Button>
                        </Stack>
                    }
                />
                <CardContent>
                    <Stack spacing={2}>
                        {displayedVisits.map(v => {
                            const text = findMessageForVisit(v.id) ?? v.message;
                            return (
                                <Card variant="outlined" key={v.id}>
                                    <CardHeader
                                        title={v.date}
                                        subheader={
                                            <Box>
                                                <Typography sx={{ fontWeight: 'bold' }}>
                                                    Local : {v.teacherNames.join(', ') || 'Inconnu'}
                                                </Typography>
                                                {text && (
                                                    <Typography sx={{ mt: 1 }}>
                                                        Message : {text}
                                                    </Typography>
                                                )}
                                                <Typography sx={{ mt: 1 }}>
                                                    Prof concerné : {v.targetTeacherName ?? 'Non spécifié'}
                                                </Typography>
                                            </Box>
                                        }
                                        action={
                                            <IconButton color="error" onClick={() => handleDeleteVisit(v.id)}>
                                                <DeleteIcon />
                                            </IconButton>
                                        }
                                    />
                                    <CardContent>
                                        <Typography>Statut : {formatStatus(v.status)}</Typography>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </Stack>
                </CardContent>
            </Card>

            {/* SECTION MESSAGES - SANS "NON LU" */}
            <Card>
                <CardHeader
                    title="💬 Messages reçus"
                    subheader={`${displayedMessages.length} message(s) | ${messages.filter(m => !m.isRead).length} non lu(s)`}
                    action={
                        <Stack direction="row" spacing={2} alignItems="center">
                            <Button
                                variant="contained"
                                size="small"
                                startIcon={<DoneAllIcon />}
                                onClick={handleMarkAllAsRead}
                                disabled={loadingActions['all'] || messages.filter(m => !m.isRead).length === 0}
                            >
                                Tout marquer lu
                            </Button>
                            <TextField
                                size="small"
                                label="Rechercher message/émetteur"
                                value={searchMessages}
                                onChange={e => setSearchMessages(e.target.value)}
                                sx={{ width: 250 }}
                            />
                            <Select
                                size="small"
                                value={filterMessages}
                                onChange={e => setFilterMessages(e.target.value as 'all' | 'unread')}
                            >
                                <MenuItem value="all">Tous</MenuItem>
                                <MenuItem value="unread">Non lus</MenuItem>
                            </Select>
                        </Stack>
                    }
                />
                <CardContent>
                    <Stack spacing={2}>
                        {displayedMessages.map(m => (
                            <Card variant="outlined" key={m.id}>
                                <CardHeader
                                    title={
                                        <Box>
                                            <Typography variant="h6">{m.text}</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {m.senderInfo}
                                            </Typography>
                                            <Chip
                                                label={m.targetTeacher?.name ?? m.targetLocation?.name ?? 'Général'}
                                                size="small"
                                                sx={{ mt: 1 }}
                                            />
                                        </Box>
                                    }
                                    subheader={`Envoyé le ${formatMessageDate(m.createdAt)}`}
                                    action={
                                        <Stack direction="column" spacing={1} alignItems="flex-end">
                                            {!m.isRead && (
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    startIcon={<CheckIcon />}
                                                    onClick={() => handleMarkAsRead(m.id)}
                                                    disabled={isLoading(m.id)}
                                                >
                                                    {isLoading(m.id) ? (
                                                        <CircularProgress size={16} />
                                                    ) : (
                                                        'Marquer lu'
                                                    )}
                                                </Button>
                                            )}
                                            {m.isRead && (
                                                <Chip label="Lu" size="small" color="success" />
                                            )}
                                        </Stack>
                                    }
                                />
                            </Card>
                        ))}
                        {displayedMessages.length === 0 && (
                            <Typography variant="body2" color="text.secondary" align="center">
                                Aucun message correspondant aux filtres
                            </Typography>
                        )}
                    </Stack>
                </CardContent>
            </Card>

            {/* Snackbar notifications */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Container>
    );
}
