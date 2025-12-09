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
    Stack
} from '@mui/material';
import { useWebSocket } from '../hooks/useWebSocket';
import { api, type VisitEvent, type VisitStatus, type Message } from '../lib/api';

export function Dashboard() {
    const { events: wsEvents } = useWebSocket('/ws');
    const [visits, setVisits] = useState<VisitEvent[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [filter, setFilter] = useState<'all' | 'missed'>('all');
    const [search, setSearch] = useState('');
    const [stats, setStats] = useState({ total: 0, missed: 0, today: 0 });

    useEffect(() => {
        Promise.all([api.getEvents(), api.getMessages()])
            .then(([visitsData, messagesData]) => {
                const sortedVisits = sortByDateDesc(visitsData);
                setVisits(sortedVisits);
                setMessages(messagesData);
                computeStats(sortedVisits);
            })
            .catch(error => {
                console.error('Erreur chargement visites/messages:', error);
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
                setMessages(messagesData);
            })
            .catch(err => console.error('Erreur refresh visites/messages:', err));
    };

    const handleDelete = (id: string) =>
        api.deleteVisit(id).then(refresh).catch(err => console.error('Erreur suppression:', err));

    const displayed = visits.filter(v =>
        (filter === 'all' || v.status === 'missed') &&
        v.date.includes(search)
    );

    const formatStatus = (status: VisitStatus): string => {
        switch (status) {
            case 'pending':
                return '⏳ En attente';
            case 'answered':
                return '✓ Décroché';
            case 'missed':
                return '❌ Manquée';
            default:
                return status;
        }
    };

    const findMessageForVisit = (visitId: string): string | undefined => {
        const msg = messages.find(m => m.visitId === visitId);
        return msg?.text;
    };

    return (
        <Container maxWidth="lg" sx={{ mt: 4 }}>
            <Typography variant="h4" gutterBottom>
                Tableau de bord
            </Typography>

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

            <Stack direction="row" spacing={2} mb={3} alignItems="center">
                <TextField
                    label="Rechercher par date/heure"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <Select
                    value={filter}
                    onChange={e => setFilter(e.target.value as 'all' | 'missed')}
                >
                    <MenuItem value="all">Tous</MenuItem>
                    <MenuItem value="missed">Manquée</MenuItem>
                </Select>
                <Button variant="outlined" onClick={refresh}>
                    Actualiser
                </Button>
            </Stack>

            <Stack spacing={2}>
                {displayed.map(v => {
                    const text = findMessageForVisit(v.id) ?? v.message;

                    return (
                        <Card variant="outlined" key={v.id}>
                            <CardHeader
                                title={v.date}
                                subheader={
                                    <Box>
                                        <Typography component="span" sx={{ fontWeight: 'bold' }}>
                                            Local :
                                        </Typography>{' '}
                                        {v.teacherNames.length > 0 ? v.teacherNames.join(', ') : 'Inconnu'}
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
                                    <Stack direction="row" spacing={1}>
                                        <Button color="error" onClick={() => handleDelete(v.id)}>
                                            🗑 Supprimer
                                        </Button>
                                    </Stack>
                                }
                            />
                            <CardContent>
                                <Typography>Statut : {formatStatus(v.status)}</Typography>
                            </CardContent>
                        </Card>
                    );
                })}
            </Stack>
        </Container>
    );
}
