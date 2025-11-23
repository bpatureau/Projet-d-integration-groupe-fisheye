import mqtt, { type MqttClient } from "mqtt";
import config from "../config";
import logger from "../utils/logger";

class MQTTService {
  private client: MqttClient | null = null;
  private subscriptions: Map<string, (topic: string, payload: Buffer) => void> =
    new Map();

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client = mqtt.connect(config.mqtt.broker, {
        clientId: config.mqtt.clientId,
        username: config.mqtt.username,
        password: config.mqtt.password,
        keepalive: 30,
        connectTimeout: 30000,
        reconnectPeriod: 5000,
        clean: true,
        rejectUnauthorized: false,
      });

      this.client.on("connect", () => {
        logger.info("Connected to MQTT broker", { component: "MQTTService" });

        // Réabonnement à tous les topics après reconnexion
        this.subscriptions.forEach((_, topic) => {
          this.client?.subscribe(topic, { qos: 1 });
        });

        resolve();
      });

      this.client.on("error", (error) => {
        logger.error("MQTT connection error:", {
          component: "MQTTService",
          error: error.message,
        });
        reject(error);
      });

      this.client.on("message", (topic, payload) => {
        const handler =
          this.subscriptions.get(topic) || this.subscriptions.get("fisheye/#");
        if (handler) {
          handler(topic, payload);
        }
      });

      this.client.on("reconnect", () => {
        logger.warn("MQTT reconnecting...", { component: "MQTTService" });
      });

      this.client.on("offline", () => {
        logger.warn("MQTT client offline", { component: "MQTTService" });
      });
    });
  }

  subscribe(
    topic: string,
    handler: (topic: string, payload: Buffer) => void,
  ): void {
    if (!this.client) {
      throw new Error("MQTT client not connected");
    }

    this.subscriptions.set(topic, handler);
    this.client.subscribe(topic, { qos: 1 }, (err) => {
      if (err) {
        logger.error(`Failed to subscribe to ${topic}:`, {
          component: "MQTTService",
          error: err,
        });
      } else {
        logger.info(`Subscribed to MQTT topic: ${topic}`, {
          component: "MQTTService",
        });
      }
    });
  }

  async publish(
    topic: string,
    payload: string | object,
    options: { qos?: 0 | 1 | 2; retained?: boolean } = {},
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client?.connected) {
        return reject(new Error("MQTT client not connected"));
      }

      const message =
        typeof payload === "string" ? payload : JSON.stringify(payload);

      this.client.publish(
        topic,
        message,
        {
          qos: options.qos || 1,
          retain: options.retained || false,
        },
        (error) => {
          if (error) {
            logger.error(`Failed to publish to ${topic}:`, {
              component: "MQTTService",
              error: error.message,
            });
            reject(error);
          } else {
            logger.debug(`Published to ${topic}`, {
              component: "MQTTService",
            });
            resolve();
          }
        },
      );
    });
  }

  /**
   * Publie un message MQTT avec réessai automatique en cas d'échec
   */
  async publishWithRetry(
    topic: string,
    payload: string | object,
    maxRetries: number = 3,
  ): Promise<boolean> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.publish(topic, payload);
        return true;
      } catch (_error) {
        logger.warn(`MQTT publish attempt ${attempt} failed`, {
          component: "MQTTService",
          topic,
          attempt,
          maxRetries,
        });

        if (attempt === maxRetries) {
          logger.error("MQTT publish failed after all retries", {
            component: "MQTTService",
            topic,
          });
          return false;
        }

        // Attente avec backoff exponentiel avant de réessayer
        await new Promise((resolve) =>
          setTimeout(resolve, 2 ** attempt * 1000),
        );
      }
    }

    return false;
  }

  isConnected(): boolean {
    return this.client?.connected || false;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.end(false, {}, () => {
        logger.info("MQTT client disconnected", {
          component: "MQTTService",
        });
      });
      this.client = null;
    }
  }
}

export default new MQTTService();
