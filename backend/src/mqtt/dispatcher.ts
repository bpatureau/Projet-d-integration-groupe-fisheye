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
 *
 * Structure des topics:
 * - fisheye/{clientId}/button/pressed - Bouton sonnette appuyé
 * - fisheye/{clientId}/door/opened - Porte ouverte
 * - fisheye/{clientId}/message/send - Envoi de message texte
 * - fisheye/{clientId}/teacher/selected - Sélection enseignant sur panneau
 * - fisheye/{clientId}/status - Status de l'appareil (heartbeat)
 * - fisheye/{clientId}/teachers/request - Demande liste des enseignants
 * - fisheye/{clientId}/presence/update - Mise à jour présence
 * - fisheye/{clientId}/bell/activate/ack - Confirmation activation sonnette
 * - fisheye/{clientId}/buzz/activate/ack - Confirmation activation buzzer
 * - fisheye/{clientId}/display/update/ack - Confirmation mise à jour affichage
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
   * Topic: fisheye/{clientId}/button/pressed
   * Payload: { targetTeacherId?: "uuid" }
   */
  private async handleDoorbellButtonPressed(
    topic: string,
    payload: Buffer,
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
      targetTeacherId,
    );
  }

  /**
   * Gère l'ouverture de porte
   * Topic: fisheye/{clientId}/door/opened
   */
  private async handleDoorOpened(
    topic: string,
    _payload: Buffer,
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
   * Topic: fisheye/{clientId}/message/send
   * Payload: { text: string, targetTeacherId?: "uuid" }
   * Note: Le message est toujours envoyé au lieu (location) de la sonnette
   */
  private async handleMessageSend(
    topic: string,
    payload: Buffer,
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
    // Le message est toujours envoyé au lieu de la sonnette (pas de targetLocationId)
    await deviceActionService.handleDoorbellMessage(
      doorbell.id,
      text,
      targetTeacherId,
      undefined, // targetLocationId n'est pas utilisé
    );
  }

  /**
   * Gère la sélection d'enseignant sur le panneau LED
   * Topic: fisheye/{clientId}/teacher/selected
   * Payload: { teacherId: "uuid" }
   */
  private async handleTeacherSelected(
    topic: string,
    payload: Buffer,
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
   * Gère le status d'un appareil
   * Topic: fisheye/{clientId}/status
   */
  private async handleStatus(topic: string, _payload: Buffer): Promise<void> {
    const mqttClientId = extractClientIdFromTopic(topic);
    if (!mqttClientId) {
      logger.warn("Invalid topic format for status", { topic });
      return;
    }

    try {
      const doorbell = await doorbellService.findByMqttClientId(mqttClientId);
      await deviceActionService.handleStatus("doorbell", doorbell.deviceId);
      return;
    } catch {}

    try {
      const panel = await panelService.findByMqttClientId(mqttClientId);
      await deviceActionService.handleStatus("panel", panel.deviceId);
      return;
    } catch {}

    try {
      const buzzerDevice = await buzzerService.findByMqttClientId(mqttClientId);
      await deviceActionService.handleStatus("buzzer", buzzerDevice.deviceId);
      return;
    } catch {}

    logger.warn("Status from unknown device", { mqttClientId });
  }

  /**
   * Gère la demande de liste des enseignants par un panel
   * Topic: fisheye/{clientId}/teachers/request
   * Payload: {} (pas de payload - utilise la location du panneau)
   */
  private async handleTeachersRequest(
    topic: string,
    _payload: Buffer,
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
   * Topic: fisheye/{clientId}/presence/update
   * Payload: { teacherId: "uuid", status: "present" | "absent" | "dnd", until?: timestamp }
   */
  private async handlePresenceUpdate(
    topic: string,
    payload: Buffer,
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
      until,
    );
  }

  /**
   * Gère la confirmation d'activation de la sonnette
   * Topic: fisheye/{clientId}/bell/activate/ack
   * Payload: { success: boolean, error?: string }
   */
  private async handleBellActivateAck(
    topic: string,
    payload: Buffer,
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
   * Topic: fisheye/{clientId}/buzz/activate/ack
   * Payload: { success: boolean, error?: string }
   */
  private async handleBuzzActivateAck(
    topic: string,
    payload: Buffer,
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
   * Topic: fisheye/{clientId}/display/update/ack
   * Payload: { success: boolean, error?: string }
   */
  private async handleDisplayUpdateAck(
    topic: string,
    payload: Buffer,
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
