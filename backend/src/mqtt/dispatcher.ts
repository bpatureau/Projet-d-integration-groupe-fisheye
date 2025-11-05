import mqttService from "../services/mqtt.service";
import deviceActionService from "../services/device-action.service";
import doorbellService from "../services/doorbell.service";
import panelService from "../services/panel.service";
import logger from "../utils/logger";

/**
 * Distributeur de messages MQTT
 * Route les messages MQTT des appareils vers les gestionnaires appropriés
 *
 * Structure des topics:
 * - fisheye/{clientId}/button/pressed - Bouton sonnette appuyé
 * - fisheye/{clientId}/door/opened - Porte ouverte
 * - fisheye/{clientId}/teacher/selected - Sélection enseignant sur panneau
 * - fisheye/{clientId}/heartbeat - Heartbeat de l'appareil
 */
class MQTTDispatcher {
  initialize(): void {
    mqttService.subscribe("fisheye/#", this.routeMessage.bind(this));
    logger.info("MQTT dispatcher initialized");
  }

  private async routeMessage(topic: string, payload: Buffer): Promise<void> {
    try {
      logger.debug("MQTT message received", { topic });

      if (topic.endsWith("/button/pressed")) {
        await this.handleDoorbellButtonPressed(topic, payload);
      } else if (topic.endsWith("/door/opened")) {
        await this.handleDoorOpened(topic, payload);
      } else if (topic.endsWith("/teacher/selected")) {
        await this.handleTeacherSelected(topic, payload);
      } else if (topic.endsWith("/heartbeat")) {
        await this.handleHeartbeat(topic, payload);
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
    payload: Buffer
  ): Promise<void> {
    const parts = topic.split("/");
    const mqttClientId = parts[1];

    let targetTeacherId: string | undefined;
    try {
      const data = JSON.parse(payload.toString());
      targetTeacherId = data.targetTeacherId;
    } catch {
    }

    const doorbell = await doorbellService.findByMqttClientId(mqttClientId);
    await deviceActionService.handleDoorbellButtonPressed(
      doorbell.id,
      targetTeacherId
    );
  }

  /**
   * Gère l'ouverture de porte
   * Topic: fisheye/{clientId}/door/opened
   */
  private async handleDoorOpened(
    topic: string,
    payload: Buffer
  ): Promise<void> {
    const parts = topic.split("/");
    const mqttClientId = parts[1];

    const doorbell = await doorbellService.findByMqttClientId(mqttClientId);
    await deviceActionService.handleDoorOpened(doorbell.id);
  }

  /**
   * Gère la sélection d'enseignant sur le panneau LED
   * Topic: fisheye/{clientId}/teacher/selected
   * Payload: { teacherId: "uuid" }
   */
  private async handleTeacherSelected(
    topic: string,
    payload: Buffer
  ): Promise<void> {
    const parts = topic.split("/");
    const mqttClientId = parts[1];

    let teacherId: string;
    try {
      const data = JSON.parse(payload.toString());
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
   * Gère le heartbeat d'un appareil
   * Topic: fisheye/{clientId}/heartbeat
   */
  private async handleHeartbeat(
    topic: string,
    payload: Buffer
  ): Promise<void> {
    const parts = topic.split("/");
    const mqttClientId = parts[1];

    try {
      const doorbell = await doorbellService.findByMqttClientId(mqttClientId);
      await deviceActionService.handleHeartbeat("doorbell", doorbell.deviceId);
      return;
    } catch {}

    try {
      const panel = await panelService.findByMqttClientId(mqttClientId);
      await deviceActionService.handleHeartbeat("panel", panel.deviceId);
      return;
    } catch {}

    logger.warn("Heartbeat from unknown device", { mqttClientId });
  }
}

export default new MQTTDispatcher();
