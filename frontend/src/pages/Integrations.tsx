// frontend/src/pages/Integrations.tsx
import React, { useState, useEffect } from 'react';
import {
    Container,
    Paper,
    Typography,
    Button,
    Box,
    CircularProgress,
    Stack
} from '@mui/material';
import { api, type Schedule } from '../lib/api';

function getMondayOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function getWorkWeekDates(monday: Date): string[] {
    const dates: string[] = [];
    for (let i = 0; i < 5; i++) {
        const day = new Date(monday);
        day.setDate(monday.getDate() + i);
        const year = day.getFullYear();
        const month = String(day.getMonth() + 1).padStart(2, '0');
        const dayNum = String(day.getDate()).padStart(2, '0');
        dates.push(`${year}-${month}-${dayNum}`);
    }
    return dates;
}

export function Integrations() {
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [loading, setLoading] = useState(false);
    const [mondayDate, setMondayDate] = useState<Date>(() => getMondayOfWeek(new Date()));
    const [error, setError] = useState<string | null>(null);

    const hourStart = 8;
    const hourEnd = 18;
    const cellHeightPx = 60;
    const locationId = '1f358c01-e709-4b3d-bf6f-49b7de464859'; // statique

    const loadSchedules = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.getLocationSchedules(locationId);
            setSchedules(data);
        } catch (e: any) {
            console.error('Erreur chargement schedules:', e);
            setError(e.message || 'Erreur de chargement des cours');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSchedules();
    }, []);

    const workWeekDates = getWorkWeekDates(mondayDate);

    const previousWeek = () => {
        const prev = new Date(mondayDate);
        prev.setDate(prev.getDate() - 7);
        setMondayDate(prev);
    };

    const nextWeek = () => {
        const next = new Date(mondayDate);
        next.setDate(next.getDate() + 7);
        setMondayDate(next);
    };

    const getEventsForDay = (dateStr: string) => {
        const dayStart = new Date(dateStr + 'T00:00:00');
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        return schedules.filter(s => {
            const start = new Date(s.startTime);
            const end = new Date(s.endTime);
            return start < dayEnd && end > dayStart;
        });
    };

    return (
        <Container maxWidth="lg" sx={{ mt: 4 }}>
            <Paper sx={{ p: 4 }}>
                <Typography variant="h4" gutterBottom>
                    Intégration Calendrier – Vue hebdomadaire
                </Typography>

                <Stack direction="row" spacing={2} mb={2} justifyContent="center">
                    <Button variant="outlined" onClick={previousWeek}>
                        Semaine précédente
                    </Button>
                    <Button variant="outlined" onClick={nextWeek}>
                        Semaine suivante
                    </Button>
                    <Button variant="contained" onClick={loadSchedules} disabled={loading}>
                        Recharger
                    </Button>
                </Stack>

                {error && (
                    <Typography color="error" sx={{ mb: 2 }}>
                        {error}
                    </Typography>
                )}

                {loading && <CircularProgress sx={{ mb: 2 }} />}

                <Box sx={{ overflowX: 'auto' }}>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: `60px repeat(5, 1fr)`,
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                            minWidth: 800
                        }}
                    >
                        {/* En-têtes jours */}
                        <Box sx={{ borderRight: '1px solid', borderColor: 'divider' }}></Box>
                        {workWeekDates.map((dateStr) => {
                            const d = new Date(dateStr + 'T00:00:00');
                            const dayName = d.toLocaleDateString('fr-FR', { weekday: 'long' });
                            const dayNum = d.getDate();
                            const monthName = d.toLocaleDateString('fr-FR', { month: 'short' });
                            return (
                                <Box
                                    key={dateStr}
                                    sx={{
                                        borderLeft: '1px solid',
                                        borderColor: 'divider',
                                        p: 1,
                                        fontWeight: 'bold',
                                        textAlign: 'center',
                                        fontSize: 13
                                    }}
                                >
                                    {dayName} {dayNum} {monthName}
                                </Box>
                            );
                        })}

                        {/* Lignes horaires */}
                        {Array.from({ length: hourEnd - hourStart + 1 }).map((_, i) => {
                            const hour = hourStart + i;
                            return (
                                <React.Fragment key={hour}>
                                    {/* Colonne heure */}
                                    <Box
                                        sx={{
                                            borderTop: '1px solid',
                                            borderColor: 'divider',
                                            textAlign: 'right',
                                            pr: 0.5,
                                            fontSize: 12,
                                            color: 'text.secondary',
                                            userSelect: 'none',
                                            height: `${cellHeightPx}px`,
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            py: 0.5
                                        }}
                                    >
                                        {String(hour).padStart(2, '0')}h00
                                    </Box>

                                    {/* Colonnes jours */}
                                    {workWeekDates.map(dateStr => {
                                        const dayEvents = getEventsForDay(dateStr);

                                        return (
                                            <Box
                                                key={dateStr + hour}
                                                sx={{
                                                    borderTop: '1px solid',
                                                    borderLeft: '1px solid',
                                                    borderColor: 'divider',
                                                    height: `${cellHeightPx}px`,
                                                    p: 0.25,
                                                    position: 'relative',
                                                    overflow: 'hidden'
                                                }}
                                            >
                                                {i === 0 &&
                                                    dayEvents.map(ev => (
                                                        <Box
                                                            key={ev.id}
                                                            sx={{
                                                                position: 'absolute',
                                                                top: 0,
                                                                left: 0,
                                                                right: 0,
                                                                bottom: 0,
                                                                m: 0.5,
                                                                borderRadius: 0.5,
                                                                backgroundColor: 'primary.light',
                                                                color: 'primary.contrastText',
                                                                fontSize: 10,
                                                                cursor: 'pointer',
                                                                '&:hover': { backgroundColor: 'primary.main' },
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                            }}
                                                            title={`${ev.summary}\n${new Date(ev.startTime).toLocaleDateString('fr-FR')} - ${new Date(ev.endTime).toLocaleDateString('fr-FR')}\n${ev.teacherEmail}`}
                                                        >
                                                            <Typography fontWeight="bold" lineHeight={1} fontSize={10}>
                                                                {ev.summary || '(Sans titre)'}
                                                            </Typography>
                                                            <Typography fontSize={9} lineHeight={1}>
                                                                {ev.teacherEmail}
                                                            </Typography>
                                                            {ev.allDay && (
                                                                <Typography fontSize={9} lineHeight={1}>
                                                                    Toute la journée
                                                                </Typography>
                                                            )}
                                                        </Box>
                                                    ))}
                                            </Box>
                                        );
                                    })}
                                </React.Fragment>
                            );
                        })}
                    </Box>
                </Box>
            </Paper>
        </Container>
    );
}
