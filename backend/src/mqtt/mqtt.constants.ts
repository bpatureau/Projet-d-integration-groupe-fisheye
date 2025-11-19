/**
 * Constantes et utilitaires pour les topics MQTT
 * Namespace: fisheye/{clientId}/...
 */

/**
 * Préfixe du namespace MQTT pour l'application Fisheye
 */
export const MQTT_NAMESPACE = "fisheye";

/**
 * Topics MQTT pour la communication Device → Backend (subscribed)
 */
export const MQTT_TOPICS_INBOUND = {
  // Sonnette
  BUTTON_PRESSED: "button/pressed",
  DOOR_OPENED: "door/opened",
  MESSAGE_SEND: "message/send",

  // Panneau LED
  TEACHER_SELECTED: "teacher/selected",
  TEACHERS_REQUEST: "teachers/request",
  PRESENCE_UPDATE: "presence/update",

  // Tous les appareils
  STATUS: "status",

  // Acknowledgments (Device → Backend)
  BELL_ACTIVATE_ACK: "bell/activate/ack",
  BUZZ_ACTIVATE_ACK: "buzz/activate/ack",
  DISPLAY_UPDATE_ACK: "display/update/ack",
} as const;

/**
 * Topics MQTT pour la communication Backend → Device (published)
 */
export const MQTT_TOPICS_OUTBOUND = {
  // Sonnette
  BELL_ACTIVATE: "bell/activate",
  VISIT_MISSED: "visit/missed",

  // Buzzer
  BUZZ_ACTIVATE: "buzz/activate",

  // Panneau LED
  DISPLAY_UPDATE: "display/update",
  TEACHERS_LIST: "teachers/list",
  PRESENCE_CHANGED: "presence/changed",
} as const;

/**
 * Constructeur de topics MQTT
 * Génère les topics complets au format: fisheye/{clientId}/{action}
 */

/**
 * Topic wildcard pour s'abonner à tous les messages Fisheye
 */
export function getWildcardTopic(): string {
  return `${MQTT_NAMESPACE}/#`;
}

/**
 * Topics Device → Backend
 */
export function getInboundTopics(clientId: string) {
  return {
    buttonPressed: `${MQTT_NAMESPACE}/${clientId}/${MQTT_TOPICS_INBOUND.BUTTON_PRESSED}`,
    doorOpened: `${MQTT_NAMESPACE}/${clientId}/${MQTT_TOPICS_INBOUND.DOOR_OPENED}`,
    messageSend: `${MQTT_NAMESPACE}/${clientId}/${MQTT_TOPICS_INBOUND.MESSAGE_SEND}`,
    teacherSelected: `${MQTT_NAMESPACE}/${clientId}/${MQTT_TOPICS_INBOUND.TEACHER_SELECTED}`,
    teachersRequest: `${MQTT_NAMESPACE}/${clientId}/${MQTT_TOPICS_INBOUND.TEACHERS_REQUEST}`,
    presenceUpdate: `${MQTT_NAMESPACE}/${clientId}/${MQTT_TOPICS_INBOUND.PRESENCE_UPDATE}`,
    status: `${MQTT_NAMESPACE}/${clientId}/${MQTT_TOPICS_INBOUND.STATUS}`,
    bellActivateAck: `${MQTT_NAMESPACE}/${clientId}/${MQTT_TOPICS_INBOUND.BELL_ACTIVATE_ACK}`,
    buzzActivateAck: `${MQTT_NAMESPACE}/${clientId}/${MQTT_TOPICS_INBOUND.BUZZ_ACTIVATE_ACK}`,
    displayUpdateAck: `${MQTT_NAMESPACE}/${clientId}/${MQTT_TOPICS_INBOUND.DISPLAY_UPDATE_ACK}`,
  };
}

/**
 * Topics Backend → Device
 */
export function getOutboundTopics(clientId: string) {
  return {
    bellActivate: `${MQTT_NAMESPACE}/${clientId}/${MQTT_TOPICS_OUTBOUND.BELL_ACTIVATE}`,
    visitMissed: `${MQTT_NAMESPACE}/${clientId}/${MQTT_TOPICS_OUTBOUND.VISIT_MISSED}`,
    buzzActivate: `${MQTT_NAMESPACE}/${clientId}/${MQTT_TOPICS_OUTBOUND.BUZZ_ACTIVATE}`,
    displayUpdate: `${MQTT_NAMESPACE}/${clientId}/${MQTT_TOPICS_OUTBOUND.DISPLAY_UPDATE}`,
    teachersList: `${MQTT_NAMESPACE}/${clientId}/${MQTT_TOPICS_OUTBOUND.TEACHERS_LIST}`,
    presenceChanged: `${MQTT_NAMESPACE}/${clientId}/${MQTT_TOPICS_OUTBOUND.PRESENCE_CHANGED}`,
  };
}

/**
 * Extrait le clientId d'un topic MQTT complet
 * @param topic Topic au format fisheye/{clientId}/action
 * @returns clientId ou null si le format est invalide
 */
export function extractClientIdFromTopic(topic: string): string | null {
  const parts = topic.split("/");
  if (parts.length < 3 || parts[0] !== MQTT_NAMESPACE) {
    return null;
  }
  return parts[1];
}

/**
 * Extrait l'action d'un topic MQTT complet
 * @param topic Topic au format fisheye/{clientId}/action/sous-action
 * @returns action complète (ex: "bell/activate")
 */
export function extractActionFromTopic(topic: string): string | null {
  const parts = topic.split("/");
  if (parts.length < 3 || parts[0] !== MQTT_NAMESPACE) {
    return null;
  }
  // Retourne tout après le clientId
  return parts.slice(2).join("/");
}

/**
 * Vérifie si un topic correspond à une action spécifique
 */
export function matchesTopic(topic: string, action: string): boolean {
  return topic.endsWith(`/${action}`);
}

/**
 * Types TypeScript pour les payloads MQTT
 */
export namespace MQTTPayloads {
  // Device → Backend

  export interface ButtonPressed {
    targetTeacherId?: string;
  }

  export type DoorOpened = Record<string, never>;

  export interface MessageSend {
    text: string;
    targetTeacherId?: string;
  }

  export interface TeacherSelected {
    teacherId: string;
  }

  export type TeachersRequest = Record<string, never>;

  export interface PresenceUpdate {
    teacherId: string;
    status: "present" | "absent" | "dnd";
    until?: string;
  }

  export interface DeviceStatus {
    timestamp?: string;
    uptime?: number;
    batteryLevel?: number;
    signalStrength?: number;
  }

  export interface Acknowledgment {
    success: boolean;
    error?: string;
  }

  // Backend → Device

  export interface BellActivate {
    duration: number;
  }

  export interface VisitMissed {
    visitId: string;
  }

  export interface BuzzActivate {
    duration: number;
  }

  export interface DisplayUpdate {
    teacherName: string;
    teacherId: string;
    weekSchedule: boolean[][];
  }

  export interface TeacherInfo {
    id: string;
    name: string;
    email: string;
    isPresent: boolean;
    presenceSource: string;
    manualStatus?: {
      status: "present" | "absent" | "dnd";
      until?: string;
    };
  }

  export interface TeachersList {
    teachers: TeacherInfo[];
  }

  export interface PresenceChanged {
    teacherId: string;
    teacherName: string;
    status: "present" | "absent" | "dnd";
    until?: string;
    source: "panel" | "api" | "calendar";
  }
}
