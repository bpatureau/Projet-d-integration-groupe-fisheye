import { z } from "zod";

// ========================================
// SCHÉMAS D'AUTHENTIFICATION
// ========================================

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

// ========================================
// SCHÉMAS DE PROFIL
// ========================================

export const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  gmailEmail: z.string().email().optional(),
  teamsEmail: z.string().email().optional(),
});

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

export const updatePreferencesSchema = z.object({
  notifyOnTeams: z.boolean().optional(),
  buzzerEnabled: z.boolean().optional(),
});

// ========================================
// SCHÉMAS DE LIEU
// ========================================

export const createLocationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  calendarId: z.string().optional(),
  teamsWebhookUrl: z.string().url().optional(),
});

export const updateLocationSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  calendarId: z.string().optional(),
  teamsWebhookUrl: z.string().url().optional(),
});

// ========================================
// SCHÉMAS D'ENSEIGNANT
// ========================================

export const createTeacherSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(1, "Name is required"),
  gmailEmail: z.string().email().optional(),
  teamsEmail: z.string().email().optional(),
  preferences: z
    .object({
      notifyOnTeams: z.boolean().default(true),
      buzzerEnabled: z.boolean().default(true),
    })
    .optional(),
});

export const updateTeacherSchema = z.object({
  username: z.string().min(1).optional(),
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  gmailEmail: z.string().email().optional(),
  teamsEmail: z.string().email().optional(),
  preferences: z
    .object({
      notifyOnTeams: z.boolean(),
      buzzerEnabled: z.boolean(),
    })
    .optional(),
});

// ========================================
// SCHÉMAS DE SONNETTE
// ========================================

export const createDoorbellSchema = z.object({
  deviceId: z.string().min(1, "Device ID is required"),
  mqttClientId: z.string().min(1, "MQTT Client ID is required"),
  locationId: z.string().uuid("Invalid location ID"),
});

export const updateDoorbellSchema = z.object({
  deviceId: z.string().min(1).optional(),
  mqttClientId: z.string().min(1).optional(),
  locationId: z.string().uuid().optional(),
});

// ========================================
// SCHÉMAS DE BUZZER
// ========================================

export const createBuzzerSchema = z.object({
  deviceId: z.string().min(1, "Device ID is required"),
  mqttClientId: z.string().min(1, "MQTT Client ID is required"),
  teacherId: z.string().uuid("Invalid teacher ID"),
});

export const updateBuzzerSchema = z.object({
  deviceId: z.string().min(1).optional(),
  mqttClientId: z.string().min(1).optional(),
  teacherId: z.string().uuid().optional(),
});

// ========================================
// SCHÉMAS DE PANNEAU LED
// ========================================

export const createLEDPanelSchema = z.object({
  deviceId: z.string().min(1, "Device ID is required"),
  mqttClientId: z.string().min(1, "MQTT Client ID is required"),
  locationId: z.string().uuid("Invalid location ID"),
});

export const updateLEDPanelSchema = z.object({
  deviceId: z.string().min(1).optional(),
  mqttClientId: z.string().min(1).optional(),
  locationId: z.string().uuid().optional(),
  selectedTeacherId: z.string().uuid().nullable().optional(),
});

// ========================================
// SCHÉMAS DE VISITE
// ========================================

export const answerVisitSchema = z.object({
  answeredById: z.string().uuid("Invalid teacher ID"),
});

// ========================================
// SCHÉMAS D'EMPLOI DU TEMPS
// ========================================

export const syncScheduleSchema = z.object({
  calendarId: z.string().min(1, "Calendar ID is required"),
});

// ========================================
// SCHÉMAS D'ACTION DES APPAREILS (MQTT)
// ========================================

export const buttonPressedSchema = z.object({
  targetTeacherId: z.string().uuid().optional(),
});

export const teacherSelectedSchema = z.object({
  teacherId: z.string().uuid("Invalid teacher ID"),
});

export const statusSchema = z.object({
  timestamp: z.string().datetime().optional(),
  uptime: z.number().optional(),
});

// ========================================
// SCHÉMAS DE REQUÊTE
// ========================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const visitFilterSchema = paginationSchema.extend({
  status: z.enum(["pending", "answered", "missed"]).optional(),
  locationId: z.string().uuid().optional(),
  teacherId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// ========================================
// SCHÉMAS DE MESSAGE
// ========================================

export const createMessageSchema = z.object({
  text: z.string().min(1, "Message text is required"),
  senderInfo: z.string().optional(),
  visitId: z.string().uuid().optional(),
  targetTeacherId: z.string().uuid().optional(),
  targetLocationId: z.string().uuid().optional(),
});

export const messageFilterSchema = paginationSchema.extend({
  isRead: z
    .string()
    .transform((val) => val === "true")
    .optional(),
  targetTeacherId: z.string().uuid().optional(),
  targetLocationId: z.string().uuid().optional(),
  visitId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const markAllAsReadSchema = z.object({
  teacherId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
});
