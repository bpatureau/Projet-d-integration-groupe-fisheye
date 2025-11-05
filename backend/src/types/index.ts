import { Request } from "express";
import { Teacher as PrismaTeacher } from "@prisma/client";

// ========================================
// RE-EXPORT PRISMA TYPES
// ========================================

export type {
  Location,
  Teacher,
  TeacherLocation,
  Doorbell,
  Buzzer,
  LEDPanel,
  Visit,
  Schedule,
  VisitStatus,
} from "@prisma/client";

// ========================================
// CUSTOM TYPES
// ========================================

// Préférences professeur
export interface TeacherPreferences {
  notifyOnTeams: boolean;
  buzzerEnabled: boolean;
}

// Statut manuel du professeur
export interface ManualStatus {
  status: "present" | "absent" | "dnd";
  until?: Date; // Optionnel: jusque quand le statut est valide
}

// Notification d'un professeur
export interface NotifiedTeacher {
  teacherId: string;
  email: string;
  name: string;
  notificationChannels: string[]; // ["teams", "buzzer", "doorbell"]
  notifiedAt: Date;
}

// Request avec utilisateur authentifié
export interface AuthRequest extends Request {
  teacher?: PrismaTeacher;
}

// Message MQTT
export interface MQTTMessage {
  topic: string;
  payload: Buffer;
}

// Payload: Button Pressed
export interface ButtonPressedPayload {
  targetTeacherId?: string;
}

// Payload: Teacher Selected (LED Panel)
export interface TeacherSelectedPayload {
  teacherId: string;
}

// Payload: Display Update (vers LED Panel)
export interface DisplayUpdatePayload {
  teacherName: string;
  teacherId: string;
  weekSchedule: boolean[][]; // 5 jours × 4 blocs = [5][4]
}

// Payload: Heartbeat
export interface HeartbeatPayload {
  timestamp: Date;
  uptime?: number;
}

// Stats des visites
export interface VisitStats {
  total: number;
  pending: number;
  answered: number;
  missed: number;
  averageResponseTime?: number; // en secondes
  doorOpenRate?: number; // pourcentage
}

// Professeur présent (avec calendrier)
export interface PresentTeacher {
  id: string;
  name: string;
  email: string;
  isPresent: boolean;
  presenceSource: "calendar" | "manual" | "unavailable";
  manualStatus?: ManualStatus;
}

// Grille d'horaires pour LED Panel
export interface WeekScheduleGrid {
  days: DaySchedule[];
}

export interface DaySchedule {
  dayName: string;
  blocks: TimeBlock[];
}

export interface TimeBlock {
  startHour: number;
  endHour: number;
  isOccupied: boolean;
}
