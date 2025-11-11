import React, { useState } from 'react';
import {
    Container,
    Paper,
    Typography,
    Button,
    Box,
    TextField,
    CircularProgress,
    Stack
} from '@mui/material';
import { api } from '../lib/api';

interface CalendarEvent {
    id: string;
    title: string;
    start: string;
    end: string;
    provider: string;
}

type EventsByDay = Record<string, CalendarEvent[]>;

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

function groupEventsByDay(events: CalendarEvent[]): EventsByDay {
    return events.reduce((acc, ev) => {
        const day = ev.start.split(' ')[0];
        (acc[day] = acc[day] || []).push(ev);
        return acc;
    }, {} as EventsByDay);
}

function timeToDecimal(timeStr: string): number {
    const [h, m] = timeStr.split(':').map(Number);
    return h + m / 60;
}

export function Integrations() {
    const [googleEmail, setGoogleEmail] = useState('');
    const [outlookEmail, setOutlookEmail] = useState('');
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [mondayDate, setMondayDate] = useState<Date>(() => getMondayOfWeek(new Date()));

    const syncGoogle = async () => {
        setLoading(true);
        setMessage('');
        try {
            const data = await api.getCalendarEvents(googleEmail);
            setEvents(data);
            setMessage('Synchronisation Google réussie');
        } catch {
            setMessage('Erreur lors de la synchronisation Google');
        } finally {
            setLoading(false);
        }
    };

    const syncOutlook = async () => {
        setLoading(true);
        setMessage('');
        try {
            const data = await api.getCalendarEvents(outlookEmail);
            setEvents(data);
            setMessage('Synchronisation Outlook réussie');
        } catch {
            setMessage('Erreur lors de la synchronisation Outlook');
        } finally {
            setLoading(false);
        }
    };

    const workWeekDates = getWorkWeekDates(mondayDate);
    const eventsByDay = groupEventsByDay(events);

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

    const hourStart = 8;
    const hourEnd = 18;
    const cellHeightPx = 100;

    return (
        <Container maxWidth="lg" sx={{ mt: 4 }}>
            <Paper sx={{ p: 4 }}>
                <Typography variant="h4" gutterBottom>
                    Intégration Calendriers - Vue Agenda Hebdomadaire
                </Typography>

                <Stack spacing={3} mb={3}>
                    <Box>
                        <TextField
                            fullWidth
                            label="Adresse email Google"
                            value={googleEmail}
                            onChange={e => setGoogleEmail(e.target.value)}
                            sx={{ mb: 1 }}
                        />
                        <Button variant="contained" onClick={syncGoogle} disabled={loading || !googleEmail}>
                            Synchroniser Google
                        </Button>
                    </Box>
                    <Box>
                        <TextField
                            fullWidth
                            label="Adresse email Outlook (Teams)"
                            value={outlookEmail}
                            onChange={e => setOutlookEmail(e.target.value)}
                            sx={{ mb: 1 }}
                        />
                        <Button variant="contained" onClick={syncOutlook} disabled={loading || !outlookEmail}>
                            Synchroniser Outlook
                        </Button>
                    </Box>
                </Stack>

                {message && (
                    <Typography color={message.includes('Erreur') ? 'error.main' : 'success.main'} sx={{ mb: 2 }}>
                        {message}
                    </Typography>
                )}

                <Stack direction="row" spacing={2} justifyContent="center" mb={2}>
                    <Button variant="outlined" onClick={previousWeek}>
                        Semaine précédente
                    </Button>
                    <Button variant="outlined" onClick={nextWeek}>
                        Semaine suivante
                    </Button>
                </Stack>

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
                        {/* En-tête : heure vide + 5 jours */}
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

                        {/* Lignes par heure (8h à 18h) */}
                        {Array.from({ length: hourEnd - hourStart + 1 }).map((_, i) => {
                            const hour = hourStart + i;
                            return (
                                <React.Fragment key={hour}>
                                    {/* Heure */}
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

                                    {/* Cases pour chaque jour */}
                                    {workWeekDates.map(dateStr => {
                                        const dayEvents = eventsByDay[dateStr] || [];

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
                                                    overflow: 'visible'
                                                }}
                                            >
                                                {dayEvents.map(ev => {
                                                    const startH = timeToDecimal(ev.start.split(' ')[1]);
                                                    const endH = timeToDecimal(ev.end.split(' ')[1]);

                                                    // Affiche l'événement SEULEMENT si la première heure se chevauche
                                                    if (!(endH > hour && startH < hour + 1)) {
                                                        return null; // Pas de chevauchement
                                                    }

                                                    const topOffset = (startH - hour) * 100;
                                                    const heightInCells = endH - startH;
                                                    const totalHeight = heightInCells * cellHeightPx;

                                                    return (
                                                        <Box
                                                            key={ev.id}
                                                            sx={{
                                                                position: 'absolute',
                                                                top: `${topOffset}%`,
                                                                left: 0,
                                                                right: 0,
                                                                height: `${totalHeight}px`,
                                                                minHeight: '24px',
                                                                p: 0.5,
                                                                borderRadius: 0.5,
                                                                backgroundColor: 'primary.light',
                                                                color: 'primary.contrastText',
                                                                fontSize: 10,
                                                                cursor: 'pointer',
                                                                '&:hover': { backgroundColor: 'primary.main' },
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                zIndex: 10
                                                            }}
                                                            title={`${ev.title}\n${ev.start} - ${ev.end}\n${ev.provider}`}
                                                        >
                                                            <Typography fontWeight="bold" lineHeight={1} fontSize={10}>
                                                                {ev.title}
                                                            </Typography>
                                                            <Typography fontSize={8} lineHeight={1}>
                                                                {ev.start.split(' ')[1]} - {ev.end.split(' ')[1]}
                                                            </Typography>
                                                        </Box>
                                                    );
                                                })}
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
