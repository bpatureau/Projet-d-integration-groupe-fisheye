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
import { useWebSocket, type VisitEvent } from '../hooks/useWebSocket';
import { api } from '../lib/api';

export function Dashboard() {
    const { events: wsEvents } = useWebSocket('/ws');
    const [visits, setVisits] = useState<VisitEvent[]>([]);
    const [filter, setFilter] = useState<'all' | 'answered' | 'missed'>('all');
    const [search, setSearch] = useState('');
    const [stats, setStats] = useState({ total: 0, missed: 0, today: 0 });

    useEffect(() => {
        api.getEvents().then(data => {
            setVisits(data);
            computeStats(data);
        });
    }, []);

    useEffect(() => computeStats(visits), [visits]);

    useEffect(() => {
        if (wsEvents.length) {
            setVisits(prev => [wsEvents[0], ...prev]);
        }
    }, [wsEvents]);

    const computeStats = (data: VisitEvent[]) => {
        const todayStr = new Date().toLocaleDateString('fr-FR');
        setStats({
            total: data.length,
            missed: data.filter(v => v.status === 'missed').length,
            today: data.filter(v => v.date.startsWith(todayStr)).length
        });
    };

    const refresh = () => api.getEvents().then(setVisits);
    const handleMark = (id: string) => api.markAnswered(id).then(refresh);
    const handleDelete = (id: string) => api.deleteVisit(id).then(refresh);

    const displayed = visits.filter(v =>
        (filter === 'all' || v.status === filter) &&
        v.id.includes(search)
    );

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
                    { label: "Aujourd'hui", value: stats.today }
                ].map((s, i) => (
                    <Box key={i} sx={{ flex: 1 }}>
                        <Card>
                            <CardHeader title={s.label} subheader={s.value} />
                        </Card>
                    </Box>
                ))}
            </Stack>

            {/* Filtres */}
            <Stack direction="row" spacing={2} mb={3} alignItems="center">
                <TextField
                    label="Rechercher par ID"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <Select
                    value={filter}
                    onChange={e => setFilter(e.target.value as any)}
                >
                    <MenuItem value="all">Tous</MenuItem>
                    <MenuItem value="answered">Décroché</MenuItem>
                    <MenuItem value="missed">Manqué</MenuItem>
                </Select>
                <Button variant="outlined" onClick={refresh}>
                    Actualiser
                </Button>
            </Stack>

            {/* Liste des visites */}
            <Stack spacing={2}>
                {displayed.map(v => (
                    <Card variant="outlined" key={v.id}>
                        <CardHeader
                            title={`Visite #${v.id}`}
                            subheader={`Profs: ${v.teacherCount}`}
                            action={
                                <Box>
                                    <Button onClick={() => handleMark(v.id)}>✓ Décroché</Button>
                                    <Button color="error" onClick={() => handleDelete(v.id)}>
                                        🗑 Supprimer
                                    </Button>
                                </Box>
                            }
                        />
                        <CardContent>
                            <Typography>Date : {v.date}</Typography>
                            <Typography>Statut : {v.status}</Typography>
                            {v.message && <Typography>Message : {v.message}</Typography>}
                        </CardContent>
                    </Card>
                ))}
            </Stack>
        </Container>
    );
}
