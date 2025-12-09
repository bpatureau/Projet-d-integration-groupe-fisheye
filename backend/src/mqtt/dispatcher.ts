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
  private deviceTypeCache = new Map<string, "doorbell" | "panel" | "buzzer">();

  initialize(): void {
    mqttService.subscribe(getWildcardTopic(), this.routeMessage.bind(this));
    logger.info("MQTT dispatcher initialized");
  }

  private async routeMessage(topic: string, payload: Buffer): Promise<void> {
    try {
      logger.debug("MQTT message received", { topic });

      if (matchesTopic(topic, MQTT_TOPICS_INBOUND.EVENT_BUTTON)) {
        await this.handleDoorbellButtonPressed(topic, payload);
      } else if (matchesTopic(topic, MQTT_TOPICS_INBOUND.EVENT_DOOR)) {
        await this.handleDoorOpened(topic, payload);
      } else if (matchesTopic(topic, MQTT_TOPICS_INBOUND.EVENT_MESSAGE)) {
        await this.handleMessageSend(topic, payload);
      } else if (matchesTopic(topic, MQTT_TOPICS_INBOUND.STATE_STATUS)) {
        await this.handleStatus(topic, payload);
      } else if (
        matchesTopic(topic, MQTT_TOPICS_INBOUND.EVENT_REQUEST_TEACHERS)
      ) {
        await this.handleTeachersRequest(topic, payload);
      } else if (matchesTopic(topic, MQTT_TOPICS_INBOUND.ACK_RING)) {
        await this.handleBellActivateAck(topic, payload);
      } else if (matchesTopic(topic, MQTT_TOPICS_INBOUND.ACK_BUZZ)) {
        await this.handleBuzzActivateAck(topic, payload);
      } else if (matchesTopic(topic, MQTT_TOPICS_INBOUND.ACK_DISPLAY)) {
        await this.handleDisplayUpdateAck(topic, payload);
      } else if (
        matchesTopic(topic, MQTT_TOPICS_INBOUND.EVENT_SCHEDULE_UPDATE)
      ) {
        await this.handleScheduleUpdate(topic, payload);
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
    await deviceActionService.handleDoorbellMessage(
      doorbell.id,
      text,
      targetTeacherId,
      undefined,
    );
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
    const payloadStr = payload.toString().trim();

    // Support du format texte simple "online" / "offline"
    if (payloadStr === "offline") {
      isOnline = false;
    } else if (payloadStr === "online") {
      isOnline = true;
    } else {
      // Support du format JSON legacy
      try {
        if (payload.length > 0) {
          const data: MQTTPayloads.DeviceStatus = JSON.parse(payloadStr);
          if (data.online === false) {
            isOnline = false;
          }
        }
      } catch {
        // Si le payload n'est pas du JSON valide et n'est pas "offline", on assume online (heartbeat vide)
      }
    }

    try {
      const doorbell = await doorbellService.findByMqttClientId(mqttClientId);
      await deviceActionService.handleStatus("doorbell", doorbell, isOnline);
      this.deviceTypeCache.set(mqttClientId, "doorbell");
      if (isOnline) {
        await deviceActionService.refreshLocationDevices(doorbell.locationId);
      }
      return;
    } catch {}

    try {
      const panel = await panelService.findByMqttClientId(mqttClientId);
      await deviceActionService.handleStatus("panel", panel, isOnline);
      this.deviceTypeCache.set(mqttClientId, "panel");
      if (isOnline) {
        await deviceActionService.refreshLocationDevices(panel.locationId);
      }
      return;
    } catch {}

    try {
      const buzzerDevice = await buzzerService.findByMqttClientId(mqttClientId);
      await deviceActionService.handleStatus("buzzer", buzzerDevice, isOnline);
      this.deviceTypeCache.set(mqttClientId, "buzzer");
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
   * Gère la demande de liste des enseignants (Panel ou Doorbell)
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

    // Vérifier le cache d'abord
    const cachedType = this.deviceTypeCache.get(mqttClientId);
    if (cachedType) {
      if (cachedType === "panel") {
        try {
          const panel = await panelService.findByMqttClientId(mqttClientId);
          await deviceActionService.triggerLocationRefresh(
            panel.locationId,
            panel.id,
          );
          return;
        } catch {}
      } else if (cachedType === "doorbell") {
        try {
          const doorbell =
            await doorbellService.findByMqttClientId(mqttClientId);
          await deviceActionService.triggerLocationRefresh(
            doorbell.locationId,
            doorbell.id,
          );
          return;
        } catch {}
      }
    }

    // Essayer de trouver un Panel
    try {
      const panel = await panelService.findByMqttClientId(mqttClientId);
      await deviceActionService.triggerLocationRefresh(
        panel.locationId,
        panel.id,
      );
      this.deviceTypeCache.set(mqttClientId, "panel");
      return;
    } catch {}

    // Essayer de trouver une Doorbell
    try {
      const doorbell = await doorbellService.findByMqttClientId(mqttClientId);
      await deviceActionService.triggerLocationRefresh(
        doorbell.locationId,
        doorbell.id,
      );
      this.deviceTypeCache.set(mqttClientId, "doorbell");
      return;
    } catch {}

    logger.warn("Teachers request from unknown device", { mqttClientId });
  }

  /**
   * Gère la confirmation d'activation de la sonnette
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
   * Gère la mise à jour de l'emploi du temps d'un enseignant par un panel
   */
  private async handleScheduleUpdate(
    topic: string,
    payload: Buffer,
  ): Promise<void> {
    const mqttClientId = extractClientIdFromTopic(topic);
    if (!mqttClientId) {
      logger.warn("Invalid topic format for schedule update", { topic });
      return;
    }

    let teacherId: string;
    let schedule: boolean[][];

    try {
      const data: MQTTPayloads.ScheduleUpdate = JSON.parse(payload.toString());
      teacherId = data.teacherId;
      schedule = data.schedule;
    } catch {
      logger.warn("Invalid schedule update payload", {
        mqttClientId,
        payload: payload.toString(),
      });
      return;
    }

    const panel = await panelService.findByMqttClientId(mqttClientId);
    await deviceActionService.handleScheduleUpdate(
      panel.id,
      teacherId,
      schedule,
    );
  }

  /**
   * Gère la confirmation de mise à jour de l'affichage
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
