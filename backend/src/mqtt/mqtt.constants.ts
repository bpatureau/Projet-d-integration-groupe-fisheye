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
  // Events
  EVENT_BUTTON: "event/button",
  EVENT_DOOR: "event/door",
  EVENT_MESSAGE: "event/message",
  EVENT_REQUEST_TEACHERS: "event/request_teachers",
  EVENT_SCHEDULE_UPDATE: "event/schedule_update",

  // State
  STATE_STATUS: "status",

  // Acknowledgments (Device → Backend)
  ACK_RING: "event/ack_ring",
  ACK_BUZZ: "event/ack_buzz",
  ACK_DISPLAY: "event/ack_display",
} as const;

/**
 * Topics MQTT pour la communication Backend → Device (published)
 */
export const MQTT_TOPICS_OUTBOUND = {
  // Cmds
  CMD_RING: "cmd/ring",
  CMD_BUZZ: "cmd/buzz",
  CMD_MISSED: "cmd/missed",

  // Data
  // Data
  DATA_TEACHERS: "data/teachers",
} as const;

/**
 * Constructeur de topics MQTT
 * Génère les topics complets au format: fisheye/{clientId}/{cat}/{action}
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
    buttonPressed: `${MQTT_NAMESPACE}/${clientId}/${MQTT_TOPICS_INBOUND.EVENT_BUTTON}`,
    doorOpened: `${MQTT_NAMESPACE}/${clientId}/${MQTT_TOPICS_INBOUND.EVENT_DOOR}`,
    messageSend: `${MQTT_NAMESPACE}/${clientId}/${MQTT_TOPICS_INBOUND.EVENT_MESSAGE}`,
    teachersRequest: `${MQTT_NAMESPACE}/${clientId}/${MQTT_TOPICS_INBOUND.EVENT_REQUEST_TEACHERS}`,
    status: `${MQTT_NAMESPACE}/${clientId}/${MQTT_TOPICS_INBOUND.STATE_STATUS}`,
    bellActivateAck: `${MQTT_NAMESPACE}/${clientId}/${MQTT_TOPICS_INBOUND.ACK_RING}`,
    buzzActivateAck: `${MQTT_NAMESPACE}/${clientId}/${MQTT_TOPICS_INBOUND.ACK_BUZZ}`,
    displayUpdateAck: `${MQTT_NAMESPACE}/${clientId}/${MQTT_TOPICS_INBOUND.ACK_DISPLAY}`,
  };
}

/**
 * Topics Backend → Device
 */
export function getOutboundTopics(clientId: string) {
  return {
    bellActivate: `${MQTT_NAMESPACE}/${clientId}/${MQTT_TOPICS_OUTBOUND.CMD_RING}`,
    visitMissed: `${MQTT_NAMESPACE}/${clientId}/${MQTT_TOPICS_OUTBOUND.CMD_MISSED}`,
    buzzActivate: `${MQTT_NAMESPACE}/${clientId}/${MQTT_TOPICS_OUTBOUND.CMD_BUZZ}`,
    teachersList: `${MQTT_NAMESPACE}/${clientId}/${MQTT_TOPICS_OUTBOUND.DATA_TEACHERS}`,
  };
}

/**
 * Extrait le clientId d'un topic MQTT complet
 * @param topic Topic au format fisheye/{clientId}/{cat}/{action}
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
 * @param topic Topic au format fisheye/{clientId}/{cat}/{action}
 * @returns action complète (ex: "event/button")
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

  export type TeachersRequest = Record<string, never>;

  export interface DeviceStatus {
    online?: boolean;
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

  export interface TeacherInfo {
    id: string;
    name: string;
    email: string;
    isPresent: boolean;
    presenceSource: string;
    schedule: boolean[][];
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

  export interface ScheduleUpdate {
    teacherId: string;
    schedule: boolean[][];
  }
}
