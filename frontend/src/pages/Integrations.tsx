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
    const hourEnd = 17;
    const slotDurationMinutes = 30;
    const slotsPerHour = 60 / slotDurationMinutes;
    const totalSlots = (hourEnd - hourStart + 1) * slotsPerHour;
    const cellHeightPx = 30;
    const headerHeightPx = 60;

    const locationId = '1f358c01-e709-4b3d-bf6f-49b7de464859';

    const loadSchedules = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.getLocationSchedules(locationId);
            setSchedules(data);
        } catch (e: any) {
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

    const getTimeFromSlot = (slotIndex: number): string => {
        const totalMinutes = slotIndex * slotDurationMinutes;
        const hour = Math.floor(totalMinutes / 60) + hourStart;
        const minute = totalMinutes % 60;
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    };

    const getEventPosition = (event: Schedule) => {
        const eventStart = new Date(event.startTime);
        const eventEnd = new Date(event.endTime);

        const startMinutes = (eventStart.getHours() - hourStart) * 60 + eventStart.getMinutes();
        const startSlot = Math.max(0, Math.floor(startMinutes / slotDurationMinutes));

        const durationMinutes = (eventEnd.getTime() - eventStart.getTime()) / (1000 * 60);
        const durationSlots = Math.ceil(durationMinutes / slotDurationMinutes);

        return {
            startSlot: Math.min(startSlot, totalSlots - 1),
            heightSlots: Math.min(durationSlots, totalSlots - startSlot)
        };
    };

    const formatEventTimeRange = (event: Schedule): string => {
        const start = new Date(event.startTime);
        const end = new Date(event.endTime);
        const f = (d: Date) => `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
        return `${f(start)}-${f(end)}`;
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
                        {loading ? <CircularProgress size={20} /> : 'Recharger'}
                    </Button>
                </Stack>

                {error && (
                    <Typography color="error" sx={{ mb: 2 }}>
                        {error}
                    </Typography>
                )}

                <Box sx={{ overflowX: 'auto', position: 'relative' }}>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: `70px repeat(5, 1fr)`,
                            gridTemplateRows: `${headerHeightPx}px repeat(${totalSlots}, ${cellHeightPx}px)`,
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                            minWidth: 900,
                            fontSize: '0.8rem',
                            position: 'relative'
                        }}
                    >
                        <Box
                            sx={{
                                gridRow: '1',
                                borderRight: '1px solid',
                                borderColor: 'divider',
                                backgroundColor: 'grey.100',
                                fontWeight: 'bold',
                                p: 1,
                                position: 'sticky',
                                top: 0,
                                zIndex: 10,
                                height: `${headerHeightPx}px`,
                                display: 'flex',
                                alignItems: 'center'
                            }}
                        >
                            Heure
                        </Box>

                        {workWeekDates.map((dateStr) => {
                            const d = new Date(dateStr + 'T00:00:00');
                            const dayName = d.toLocaleDateString('fr-FR', { weekday: 'short' });
                            const dayNum = d.getDate();
                            const monthName = d.toLocaleDateString('fr-FR', { month: 'short' });
                            return (
                                <Box
                                    key={dateStr}
                                    sx={{
                                        gridRow: '1',
                                        borderLeft: '1px solid',
                                        borderColor: 'divider',
                                        p: 1,
                                        fontWeight: 'bold',
                                        textAlign: 'center',
                                        fontSize: 12,
                                        backgroundColor: 'grey.100',
                                        position: 'sticky',
                                        top: 0,
                                        zIndex: 10,
                                        height: `${headerHeightPx}px`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexDirection: 'column'
                                    }}
                                >
                                    {dayName}
                                    <br />
                                    {dayNum} {monthName}
                                </Box>
                            );
                        })}

                        {Array.from({ length: totalSlots }).map((_, slotIndex) => {
                            const timeLabel = getTimeFromSlot(slotIndex);
                            return (
                                <React.Fragment key={slotIndex}>
                                    <Box
                                        sx={{
                                            gridRow: `${slotIndex + 2}`,
                                            borderTop: slotIndex === 0 ? '1px solid' : 'none',
                                            borderColor: 'divider',
                                            borderRight: '1px solid',
                                            textAlign: 'right',
                                            pr: 1,
                                            fontSize: 11,
                                            color: 'text.secondary',
                                            userSelect: 'none',
                                            height: `${cellHeightPx}px`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            backgroundColor: 'grey.50',
                                            fontWeight: slotIndex % 2 === 0 ? 'bold' : 'normal'
                                        }}
                                    >
                                        {timeLabel}
                                    </Box>

                                    {workWeekDates.map(dateStr => (
                                        <Box
                                            key={`${dateStr}-${slotIndex}`}
                                            sx={{
                                                gridRow: `${slotIndex + 2}`,
                                                borderTop: slotIndex === 0 ? '1px solid' : 'none',
                                                borderLeft: '1px solid',
                                                borderColor: 'divider',
                                                height: `${cellHeightPx}px`,
                                                backgroundColor: 'background.paper'
                                            }}
                                        />
                                    ))}
                                </React.Fragment>
                            );
                        })}

                        {workWeekDates.map(dateStr =>
                            schedules
                                .filter(s => {
                                    const start = new Date(s.startTime);
                                    return start.toDateString() === new Date(dateStr).toDateString();
                                })
                                .map(ev => {
                                    const { startSlot, heightSlots } = getEventPosition(ev);
                                    const timeRange = formatEventTimeRange(ev);

                                    return (
                                        <Box
                                            key={`${dateStr}-${ev.id}`}
                                            sx={{
                                                gridRow: `${startSlot + 2} / span ${heightSlots}`,
                                                gridColumn: `${workWeekDates.indexOf(dateStr) + 2}`,
                                                position: 'relative',
                                                m: 0.125,
                                                borderRadius: 1,
                                                background: `linear-gradient(135deg, ${ev.summary?.includes('TD') ? '#4CAF50' : '#2196F3'} 0%, ${ev.summary?.includes('TP') ? '#66BB6A' : '#42A5F5'} 100%)`,
                                                color: 'white',
                                                fontSize: 10,
                                                fontWeight: 500,
                                                cursor: 'pointer',
                                                boxShadow: 2,
                                                overflow: 'hidden',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                zIndex: 5,
                                                minHeight: `${heightSlots * cellHeightPx}px`,
                                                '&:hover': {
                                                    transform: 'scale(1.01)',
                                                    boxShadow: 3
                                                }
                                            }}
                                            title={`${ev.summary}\n${timeRange}\n${ev.teacherEmail}`}
                                        >
                                            <Box
                                                sx={{
                                                    p: 0.75,
                                                    flex: 1,
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    justifyContent: 'center',
                                                    width: '100%',
                                                    height: '100%'
                                                }}
                                            >
                                                <Typography
                                                    sx={{
                                                        fontWeight: 'bold',
                                                        fontSize: 11,
                                                        lineHeight: 1.1,
                                                        mb: 0.25
                                                    }}
                                                >
                                                    {ev.summary?.length > 18 ? `${ev.summary.substring(0, 200)}...` : ev.summary || '(Sans titre)'}
                                                </Typography>
                                                <Typography
                                                    sx={{
                                                        fontSize: 9,
                                                        fontWeight: 'medium',
                                                        opacity: 0.9
                                                    }}
                                                >
                                                    {timeRange} • {ev.teacherEmail}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    );
                                })
                        )}
                    </Box>
                </Box>
            </Paper>
        </Container>
    );
}