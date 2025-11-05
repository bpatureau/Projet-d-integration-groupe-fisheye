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
  },
} as const;

export type DeviceConfig = typeof DEVICE_CONFIGS;
