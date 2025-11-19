/**
 * Configurations des appareils
 */

export const DEVICE_CONFIGS = {
  doorbell: {
    bellDuration: 3,
  },
  buzzer: {
    vibrationDuration: 2,
    buzzDuration: 3,
  },
  ledPanel: {
    gridWidth: 5,
    gridHeight: 4,
    blockDuration: 2,
    startHour: 8,
    refreshInterval: 60,
    colors: {
      present: "#00FF00",
      absent: "#FF0000",
      scheduled: "#0000FF",
    },
    schedule: {
      days: 5, // Nombre de jours à afficher (Lundi -> Vendredi)
      timeBlocks: [
        { start: 8, end: 10 },
        { start: 10, end: 12 },
        { start: 12, end: 14 },
        { start: 14, end: 16 },
        { start: 16, end: 18 },
      ],
    },
  },
} as const;

export type DeviceConfig = typeof DEVICE_CONFIGS;
