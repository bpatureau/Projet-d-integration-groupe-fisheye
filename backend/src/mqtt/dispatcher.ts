import buzzerService from "../services/buzzer.service";
import deviceActionService from "../services/device-action.service";
import doorbellService from "../services/doorbell.service";
import mqttService from "../services/mqtt.service";
import panelService from "../services/panel.service";
import logger from "../utils/logger";
import {
  extractClientIdFromTopic,
  getWildcardTopic,
  MQTT_TOPICS_INBOUND,
  type MQTTPayloads,
  matchesTopic,
} from "./mqtt.constants";

/**
 * Distributeur de messages MQTT
 * Route les messages MQTT des appareils vers les gestionnaires appropriés
 */
class MQTTDispatcher {
  initialize(): void {
    mqttService.subscribe(getWildcardTopic(), this.routeMessage.bind(this));
    logger.info("MQTT dispatcher initialized");
  }

  private async routeMessage(topic: string, payload: Buffer): Promise<void> {
    try {
      logger.debug("MQTT message received", { topic });

      if (matchesTopic(topic, MQTT_TOPICS_INBOUND.BUTTON_PRESSED)) {
        await this.handleDoorbellButtonPressed(topic, payload);
      } else if (matchesTopic(topic, MQTT_TOPICS_INBOUND.DOOR_OPENED)) {
        await this.handleDoorOpened(topic, payload);
      } else if (matchesTopic(topic, MQTT_TOPICS_INBOUND.MESSAGE_SEND)) {
        await this.handleMessageSend(topic, payload);
      } else if (matchesTopic(topic, MQTT_TOPICS_INBOUND.TEACHER_SELECTED)) {
        await this.handleTeacherSelected(topic, payload);
      } else if (matchesTopic(topic, MQTT_TOPICS_INBOUND.STATUS)) {
        await this.handleStatus(topic, payload);
      } else if (matchesTopic(topic, MQTT_TOPICS_INBOUND.TEACHERS_REQUEST)) {
        await this.handleTeachersRequest(topic, payload);
      } else if (matchesTopic(topic, MQTT_TOPICS_INBOUND.PRESENCE_UPDATE)) {
        await this.handlePresenceUpdate(topic, payload);
      } else if (matchesTopic(topic, MQTT_TOPICS_INBOUND.BELL_ACTIVATE_ACK)) {
        await this.handleBellActivateAck(topic, payload);
      } else if (matchesTopic(topic, MQTT_TOPICS_INBOUND.BUZZ_ACTIVATE_ACK)) {
        await this.handleBuzzActivateAck(topic, payload);
      } else if (matchesTopic(topic, MQTT_TOPICS_INBOUND.DISPLAY_UPDATE_ACK)) {
        await this.handleDisplayUpdateAck(topic, payload);
      }
    } catch (error) {
      logger.error("Error routing MQTT message", { topic, error });
    }
  }

  /**
   * Gère l'appui sur le bouton de sonnette
   */
  private async handleDoorbellButtonPressed(
    topic: string,
    payload: Buffer
  ): Promise<void> {
    const mqttClientId = extractClientIdFromTopic(topic);
    if (!mqttClientId) {
      logger.warn("Invalid topic format for button pressed", { topic });
      return;
    }

    let targetTeacherId: string | undefined;
    try {
      const data: MQTTPayloads.ButtonPressed = JSON.parse(payload.toString());
      targetTeacherId = data.targetTeacherId;
    } catch {}

    const doorbell = await doorbellService.findByMqttClientId(mqttClientId);
    await deviceActionService.handleDoorbellButtonPressed(
      doorbell.id,
      targetTeacherId
    );
  }

  /**
   * Gère l'ouverture de porte
   */
  private async handleDoorOpened(
    topic: string,
    _payload: Buffer
  ): Promise<void> {
    const mqttClientId = extractClientIdFromTopic(topic);
    if (!mqttClientId) {
      logger.warn("Invalid topic format for door opened", { topic });
      return;
    }

    const doorbell = await doorbellService.findByMqttClientId(mqttClientId);
    await deviceActionService.handleDoorOpened(doorbell.id);
  }

  /**
   * Gère l'envoi d'un message texte depuis la sonnette
   */
  private async handleMessageSend(
    topic: string,
    payload: Buffer
  ): Promise<void> {
    const mqttClientId = extractClientIdFromTopic(topic);
    if (!mqttClientId) {
      logger.warn("Invalid topic format for message send", { topic });
      return;
    }

    let text: string;
    let targetTeacherId: string | undefined;

    try {
      const data: MQTTPayloads.MessageSend = JSON.parse(payload.toString());
      text = data.text;
      targetTeacherId = data.targetTeacherId;
    } catch {
      logger.warn("Invalid message send payload", {
        mqttClientId,
        payload: payload.toString(),
      });
      return;
    }

    const doorbell = await doorbellService.findByMqttClientId(mqttClientId);
    await deviceActionService.handleDoorbellMessage(
      doorbell.id,
      text,
      targetTeacherId,
      undefined
    );
  }

  /**
   * Gère la sélection d'enseignant sur le panneau LED
   */
  private async handleTeacherSelected(
    topic: string,
    payload: Buffer
  ): Promise<void> {
    const mqttClientId = extractClientIdFromTopic(topic);
    if (!mqttClientId) {
      logger.warn("Invalid topic format for teacher selected", { topic });
      return;
    }

    let teacherId: string;
    try {
      const data: MQTTPayloads.TeacherSelected = JSON.parse(payload.toString());
      teacherId = data.teacherId;
    } catch {
      logger.warn("Invalid teacher selected payload", {
        mqttClientId,
        payload: payload.toString(),
      });
      return;
    }

    const panel = await panelService.findByMqttClientId(mqttClientId);
    await deviceActionService.handleTeacherSelected(panel.id, teacherId);
  }

  /**
   * Gère le status d'un appareil (Heartbeat ou LWT)
   * Topic: fisheye/{clientId}/status
   * Payload: { online: boolean, ... }
   */
  private async handleStatus(topic: string, payload: Buffer): Promise<void> {
    const mqttClientId = extractClientIdFromTopic(topic);
    if (!mqttClientId) {
      logger.warn("Invalid topic format for status", { topic });
      return;
    }

    // Parsing du payload pour détecter un statut hors ligne (LWT)
    let isOnline = true;
    try {
      if (payload.length > 0) {
        const data: MQTTPayloads.DeviceStatus = JSON.parse(payload.toString());
        if (data.online === false) {
          isOnline = false;
        }
      }
    } catch {
      // Si le payload n'est pas du JSON valide, on assume online (heartbeat vide)
    }

    try {
      const doorbell = await doorbellService.findByMqttClientId(mqttClientId);
      await deviceActionService.handleStatus(
        "doorbell",
        doorbell.deviceId,
        isOnline
      );
      return;
    } catch {}

    try {
      const panel = await panelService.findByMqttClientId(mqttClientId);
      await deviceActionService.handleStatus("panel", panel.deviceId, isOnline);
      return;
    } catch {}

    try {
      const buzzerDevice = await buzzerService.findByMqttClientId(mqttClientId);
      await deviceActionService.handleStatus(
        "buzzer",
        buzzerDevice.deviceId,
        isOnline
      );
      return;
    } catch {}

    // Ignorer le statut propre du backend pour éviter les logs d'avertissement
    if (
      !mqttClientId.includes("backend") &&
      mqttClientId !== "fisheye-backend"
    ) {
      logger.warn("Status from unknown device", { mqttClientId });
    }
  }

  /**
   * Gère la demande de liste des enseignants par un panel
   */
  private async handleTeachersRequest(
    topic: string,
    _payload: Buffer
  ): Promise<void> {
    const mqttClientId = extractClientIdFromTopic(topic);
    if (!mqttClientId) {
      logger.warn("Invalid topic format for teachers request", { topic });
      return;
    }

    const panel = await panelService.findByMqttClientId(mqttClientId);
    await deviceActionService.handleTeachersRequest(panel.id, panel.locationId);
  }

  /**
   * Gère la mise à jour de présence d'un enseignant par un panel
   */
  private async handlePresenceUpdate(
    topic: string,
    payload: Buffer
  ): Promise<void> {
    const mqttClientId = extractClientIdFromTopic(topic);
    if (!mqttClientId) {
      logger.warn("Invalid topic format for presence update", { topic });
      return;
    }

    let teacherId: string;
    let status: "present" | "absent" | "dnd";
    let until: string | undefined;

    try {
      const data: MQTTPayloads.PresenceUpdate = JSON.parse(payload.toString());
      teacherId = data.teacherId;
      status = data.status;
      until = data.until;
    } catch {
      logger.warn("Invalid presence update payload", {
        mqttClientId,
        payload: payload.toString(),
      });
      return;
    }

    const panel = await panelService.findByMqttClientId(mqttClientId);
    await deviceActionService.handlePresenceUpdate(
      panel.id,
      teacherId,
      status,
      until
    );
  }

  /**
   * Gère la confirmation d'activation de la sonnette
   */
  private async handleBellActivateAck(
    topic: string,
    payload: Buffer
  ): Promise<void> {
    const mqttClientId = extractClientIdFromTopic(topic);
    if (!mqttClientId) {
      logger.warn("Invalid topic format for bell activate ack", { topic });
      return;
    }

    try {
      const data: MQTTPayloads.Acknowledgment = JSON.parse(payload.toString());
      logger.info("Bell activation acknowledged", {
        mqttClientId,
        success: data.success,
        error: data.error,
      });
    } catch {
      logger.warn("Invalid bell activate ack payload", {
        mqttClientId,
        payload: payload.toString(),
      });
    }
  }

  /**
   * Gère la confirmation d'activation du buzzer
   */
  private async handleBuzzActivateAck(
    topic: string,
    payload: Buffer
  ): Promise<void> {
    const mqttClientId = extractClientIdFromTopic(topic);
    if (!mqttClientId) {
      logger.warn("Invalid topic format for buzz activate ack", { topic });
      return;
    }

    try {
      const data: MQTTPayloads.Acknowledgment = JSON.parse(payload.toString());
      logger.info("Buzz activation acknowledged", {
        mqttClientId,
        success: data.success,
        error: data.error,
      });
    } catch {
      logger.warn("Invalid buzz activate ack payload", {
        mqttClientId,
        payload: payload.toString(),
      });
    }
  }

  /**
   * Gère la confirmation de mise à jour de l'affichage
   */
  private async handleDisplayUpdateAck(
    topic: string,
    payload: Buffer
  ): Promise<void> {
    const mqttClientId = extractClientIdFromTopic(topic);
    if (!mqttClientId) {
      logger.warn("Invalid topic format for display update ack", { topic });
      return;
    }

    try {
      const data: MQTTPayloads.Acknowledgment = JSON.parse(payload.toString());
      logger.info("Display update acknowledged", {
        mqttClientId,
        success: data.success,
        error: data.error,
      });
    } catch {
      logger.warn("Invalid display update ack payload", {
        mqttClientId,
        payload: payload.toString(),
      });
    }
  }
}

export default new MQTTDispatcher();
