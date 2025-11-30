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
    schedule: {
      days: 5, // Nombre de jours à afficher (Lundi -> Vendredi)
      timeBlocks: [
        { start: 8, end: 10 },
        { start: 10, end: 12 },
        { start: 13, end: 15 },
        { start: 15, end: 17 },
      ],
    },
  },
} as const;

export type DeviceConfig = typeof DEVICE_CONFIGS;
