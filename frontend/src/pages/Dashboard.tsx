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
import { api, type VisitEvent, type VisitStatus } from '../lib/api';

export function Dashboard() {
    const { events: wsEvents } = useWebSocket('/ws');
    const [visits, setVisits] = useState<VisitEvent[]>([]);
    const [filter, setFilter] = useState<'all' | 'missed'>('all');
    const [search, setSearch] = useState('');
    const [stats, setStats] = useState({ total: 0, missed: 0, today: 0 });

    useEffect(() => {
        api.getEvents()
            .then(data => {
                setVisits(data);
                computeStats(data);
            })
            .catch(error => {
                console.error('Erreur chargement visites:', error);
                // Optionnel : afficher un toast d'erreur
            });
    }, []);

    useEffect(() => computeStats(visits), [visits]);

    useEffect(() => {
        if (wsEvents.length) {
            const ev = wsEvents[0];
            setVisits(prev => [ev, ...prev]);
        }
    }, [wsEvents]);

    const computeStats = (data: VisitEvent[]) => {
        const todayStr = new Date().toLocaleDateString('fr-FR');
        setStats({
            total: data.length,
            missed: data.filter(v => v.status === 'missed').length,
            today: data.filter(v => v.date.startsWith(todayStr)).length,
        });
    };

    const refresh = () => {
        api.getEvents().then(data => setVisits(data));
    };

    const handleDelete = (id: string) => api.deleteVisit(id).then(refresh);

    const displayed = visits.filter(v =>
        (filter === 'all' || v.status === 'missed') &&
        v.id.includes(search)
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
                    label="Rechercher par ID"
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
                {displayed.map(v => (
                    <Card variant="outlined" key={v.id}>
                        <CardHeader
                            title={`Visite #${v.id}`}
                            subheader={
                                <Box>
                                    <Typography component="span" sx={{ fontWeight: 'bold' }}>
                                        Profs :
                                    </Typography>{' '}
                                    {v.teacherNames.length > 0 ? v.teacherNames.join(', ') : 'Aucun'}
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
                            <Typography>Date : {v.date}</Typography>
                            <Typography>Statut : {formatStatus(v.status)}</Typography>
                            {v.message && <Typography>Message : {v.message}</Typography>}
                        </CardContent>
                    </Card>
                ))}
            </Stack>
        </Container>
    );
}