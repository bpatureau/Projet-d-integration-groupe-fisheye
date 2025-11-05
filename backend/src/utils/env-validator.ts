/**
 * Utilitaire de validation des variables d'environnement
 * S'assure que toute la configuration requise est présente avant le démarrage de l'application
 */

interface EnvVar {
  name: string;
  required: boolean;
  default?: string;
  validate?: (value: string) => boolean;
  description: string;
}

const ENV_SCHEMA: EnvVar[] = [
  // Configuration du serveur
  {
    name: "SERVER_HOST",
    required: false,
    default: "0.0.0.0",
    description: "Server host address",
  },
  {
    name: "SERVER_PORT",
    required: false,
    default: "8080",
    validate: (v) => !isNaN(parseInt(v)) && parseInt(v) > 0 && parseInt(v) <= 65535,
    description: "Server port (1-65535)",
  },

  // Configuration de la base de données
  {
    name: "DATABASE_URL",
    required: true,
    validate: (v) => v.startsWith("postgresql://") || v.startsWith("postgres://"),
    description: "PostgreSQL connection string",
  },

  // Configuration JWT
  {
    name: "JWT_SECRET",
    required: true,
    validate: (v) => v.length >= 32,
    description: "JWT secret key (minimum 32 characters)",
  },
  {
    name: "JWT_TTL",
    required: false,
    default: "168h",
    validate: (v) => /^\d+[smhd]$/.test(v),
    description: "JWT time to live (e.g., 168h, 7d, 10080m)",
  },

  // Configuration MQTT
  {
    name: "MQTT_BROKER",
    required: true,
    validate: (v) =>
      v.startsWith("mqtt://") ||
      v.startsWith("mqtts://") ||
      v.startsWith("tcp://") ||
      v.startsWith("tls://") ||
      v.startsWith("ws://") ||
      v.startsWith("wss://"),
    description: "MQTT broker URL",
  },
  {
    name: "MQTT_CLIENT_ID",
    required: false,
    default: "fisheye-backend",
    description: "MQTT client identifier",
  },
  {
    name: "MQTT_USERNAME",
    required: false,
    description: "MQTT username (optional)",
  },
  {
    name: "MQTT_PASSWORD",
    required: false,
    description: "MQTT password (optional)",
  },

  // Configuration Google Calendar
  {
    name: "GOOGLE_SA_JSON",
    required: false,
    default: "./credentials/service-account.json",
    description: "Path to Google service account JSON file",
  },

  // Configuration des logs
  {
    name: "LOG_LEVEL",
    required: false,
    default: "info",
    validate: (v) =>
      ["error", "warn", "info", "http", "verbose", "debug", "silly"].includes(v),
    description: "Winston log level",
  },

  // Configuration CORS
  {
    name: "CORS_ALLOWED_ORIGINS",
    required: false,
    default: "*",
    description: "Comma-separated list of allowed origins or *",
  },

  // Délais d'expiration (en secondes)
  {
    name: "VISIT_TIMEOUT",
    required: false,
    default: "30",
    validate: (v) => !isNaN(parseInt(v)) && parseInt(v) > 0,
    description: "Visit timeout in seconds",
  },
  {
    name: "MANUAL_STATUS_TIMEOUT",
    required: false,
    default: "7200",
    validate: (v) => !isNaN(parseInt(v)) && parseInt(v) > 0,
    description: "Manual status timeout in seconds",
  },
  {
    name: "MANUAL_DND_TIMEOUT",
    required: false,
    default: "14400",
    validate: (v) => !isNaN(parseInt(v)) && parseInt(v) > 0,
    description: "Manual DND timeout in seconds",
  },

  // Intervalles des planificateurs (en minutes)
  {
    name: "CALENDAR_SYNC_INTERVAL",
    required: false,
    default: "5",
    validate: (v) => !isNaN(parseInt(v)) && parseInt(v) > 0,
    description: "Calendar sync interval in minutes",
  },
  {
    name: "DEVICE_OFFLINE_THRESHOLD",
    required: false,
    default: "10",
    validate: (v) => !isNaN(parseInt(v)) && parseInt(v) > 0,
    description: "Device offline threshold in minutes",
  },
];

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Valide toutes les variables d'environnement selon le schéma défini
 * @returns Résultat de validation avec erreurs et avertissements
 */
export function validateEnv(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const envVar of ENV_SCHEMA) {
    const value = process.env[envVar.name];

    // Vérifie les variables requises
    if (envVar.required && !value) {
      errors.push(
        `Missing required environment variable: ${envVar.name} - ${envVar.description}`
      );
      continue;
    }

    // Définit la valeur par défaut si non fournie
    if (!value && envVar.default) {
      process.env[envVar.name] = envVar.default;
      continue;
    }

    // Ignore la validation si pas de valeur et non requis
    if (!value) {
      continue;
    }

    // Exécute la validation personnalisée
    if (envVar.validate && !envVar.validate(value)) {
      errors.push(
        `Invalid value for ${envVar.name}: "${value}" - ${envVar.description}`
      );
    }
  }

  // Avertissements de sécurité supplémentaires
  if (process.env.NODE_ENV === "production") {
    if (process.env.CORS_ALLOWED_ORIGINS === "*") {
      warnings.push(
        "CORS_ALLOWED_ORIGINS is set to '*' in production. Consider restricting to specific origins."
      );
    }

    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 64) {
      warnings.push(
        "JWT_SECRET is shorter than recommended 64 characters for production use."
      );
    }

    if (
      process.env.MQTT_BROKER &&
      (process.env.MQTT_BROKER.startsWith("mqtt://") ||
        process.env.MQTT_BROKER.startsWith("tcp://"))
    ) {
      warnings.push(
        "MQTT_BROKER is using unencrypted connection in production. Consider using mqtts:// or tls://"
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Affiche les résultats de validation dans la console
 * @param result Résultat de validation
 */
export function printValidationResult(result: ValidationResult): void {
  if (result.errors.length > 0) {
    console.error("\n❌ Environment Validation Errors:");
    result.errors.forEach((error) => console.error(`  • ${error}`));
  }

  if (result.warnings.length > 0) {
    console.warn("\n⚠️  Environment Validation Warnings:");
    result.warnings.forEach((warning) => console.warn(`  • ${warning}`));
  }

  if (result.valid && result.warnings.length === 0) {
    console.log("\n✅ Environment validation passed");
  }
}

/**
 * Valide l'environnement et quitte l'application si la validation échoue
 * Doit être appelé au démarrage de l'application
 */
export function validateEnvOrExit(): void {
  const result = validateEnv();
  printValidationResult(result);

  if (!result.valid) {
    console.error(
      "\n💥 Application cannot start due to invalid environment configuration.\n"
    );
    process.exit(1);
  }
}
