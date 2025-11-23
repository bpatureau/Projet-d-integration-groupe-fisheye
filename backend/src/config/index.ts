import "dotenv/config";
import { validateEnvOrExit } from "../utils/env-validator";

validateEnvOrExit();

interface Config {
  server: {
    host: string;
    port: number;
  };
  jwt: {
    secret: string;
    ttl: string;
  };
  mqtt: {
    broker: string;
    clientId: string;
    username?: string;
    password?: string;
  };
  google: {
    serviceAccountPath: string;
  };
  logging: {
    level: string;
  };
  cors: {
    allowedOrigins: string[];
  };
  timeouts: {
    visit: number; // secondes
  };
  scheduler: {
    calendarSyncInterval: number; // minutes
    deviceOfflineThreshold: number; // minutes
  };
}

const config: Config = {
  server: {
    host: process.env.SERVER_HOST || "0.0.0.0",
    port: parseInt(process.env.SERVER_PORT || "8080", 10),
  },
  jwt: {
    secret: process.env.JWT_SECRET || "",
    ttl: process.env.JWT_TTL || "168h",
  },
  mqtt: {
    broker: process.env.MQTT_BROKER || "mqtts://localhost:8883",
    clientId: process.env.MQTT_CLIENT_ID || "fisheye-backend",
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
  },
  google: {
    serviceAccountPath:
      process.env.GOOGLE_SA_JSON || "./credentials/service-account.json",
  },
  logging: {
    level: process.env.LOG_LEVEL || "info",
  },
  cors: {
    allowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || "*")
      .split(",")
      .map((o) => o.trim()),
  },
  timeouts: {
    visit: parseInt(process.env.VISIT_TIMEOUT || "30", 10),
  },
  scheduler: {
    calendarSyncInterval: parseInt(
      process.env.CALENDAR_SYNC_INTERVAL || "30",
      10,
    ),
    deviceOfflineThreshold: parseInt(
      process.env.DEVICE_OFFLINE_THRESHOLD || "15",
      10,
    ),
  },
};

if (!config.jwt.secret) {
  throw new Error("JWT_SECRET is required");
}

export default config;
