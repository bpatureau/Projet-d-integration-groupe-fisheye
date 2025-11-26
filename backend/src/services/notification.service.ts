import axios from "axios";
import type {
  Doorbell,
  Location,
  Message,
  Teacher,
  Visit,
} from "../../prisma/generated/client.js";
import { DEVICE_CONFIGS } from "../config/devices.config";
import { getOutboundTopics, type MQTTPayloads } from "../mqtt/mqtt.constants";
import type { NotifiedTeacher, TeacherPreferences } from "../types";
import logger from "../utils/logger";
import prismaService from "../utils/prisma";
import mqttService from "./mqtt.service";

class NotificationService {
  /**
   * Notifie les enseignants lors d'une sonnerie (sonnette + Teams + buzzers)
   * Exécute les notifications en parallèle de manière non-bloquante
   */
  async notifyTeachersOfRing(
    visit: Visit & { doorbell: Doorbell; location: Location },
    teachers: Teacher[],
  ): Promise<NotifiedTeacher[]> {
    logger.info(`Notifying ${teachers.length} teachers for visit`, {
      visitId: visit.id,
      locationId: visit.locationId,
    });

    const notifiedTeachers: NotifiedTeacher[] = [];
    const notificationPromises: Promise<unknown>[] = [];

    // 1. Activer la sonnette physique (toujours)
    notificationPromises.push(
      this.activateDoorbellBell(visit.doorbell.mqttClientId),
    );

    // 2. Récupérer tous les buzzers des enseignants concernés en une seule requête
    const teacherIds = teachers.map((t) => t.id);
    const buzzers = await prismaService.client.buzzer.findMany({
      where: {
        teacherId: { in: teacherIds },
        isOnline: true,
      },
    });

    // Créer une map pour accès rapide
    const buzzerMap = new Map(buzzers.map((b) => [b.teacherId, b]));

    for (const teacher of teachers) {
      const channels: string[] = ["doorbell"];
      const prefs = (teacher.preferences as unknown as TeacherPreferences) || {
        notifyOnTeams: true,
        buzzerEnabled: true,
      };

      // 3. Activer le buzzer (si activé et disponible)
      if (prefs.buzzerEnabled) {
        const buzzer = buzzerMap.get(teacher.id);
        if (buzzer) {
          notificationPromises.push(
            this.activateBuzzer(buzzer).then((activated) => {
              if (activated) channels.push("buzzer");
            }),
          );
        }
      }

      // 3. Notifier Teams (si activé)
      if (
        prefs.notifyOnTeams &&
        teacher.teamsEmail &&
        visit.location.teamsWebhookUrl
      ) {
        notificationPromises.push(
          this.sendTeamsNotification(
            visit.location.teamsWebhookUrl,
            visit.location,
            [teacher],
          ).then((sent) => {
            if (sent) channels.push("teams");
          }),
        );
      }

      notifiedTeachers.push({
        teacherId: teacher.id,
        email: teacher.email,
        name: teacher.name,
        notificationChannels: channels,
        notifiedAt: new Date(),
      });
    }

    // Attendre que toutes les notifications soient traitées (succès ou échec)
    // Cela évite de bloquer la réponse HTTP si Teams est lent
    Promise.allSettled(notificationPromises).then((results) => {
      const rejected = results.filter((r) => r.status === "rejected");
      if (rejected.length > 0) {
        logger.warn(
          `${rejected.length} notification actions failed for visit ${visit.id}`,
        );
      }
    });

    // Si aucun prof n'est notifié (aucun présent ou aucun ciblé), envoyer une notif générique au channel
    if (teachers.length === 0 && visit.location.teamsWebhookUrl) {
      this.sendTeamsNotification(
        visit.location.teamsWebhookUrl,
        visit.location,
        [],
      ).catch((err) => {
        logger.error("Failed to send generic teams notification", { err });
      });
    }

    logger.info(`Notifications dispatched for ${teachers.length} teachers`, {
      visitId: visit.id,
    });

    return notifiedTeachers;
  }

  /**
   * Notifie les enseignants lors de la réception d'un message
   */
  async notifyTeachersOfMessage(
    message: Message & {
      visit?: Visit | null;
      targetTeacher?: Teacher | null;
      targetLocation?: Location | null;
    },
  ): Promise<void> {
    const teachersToNotify: Teacher[] = [];

    // Si un prof spécifique est ciblé
    if (message.targetTeacher) {
      teachersToNotify.push(message.targetTeacher);
    }

    // Si aucun prof spécifique, on vérifie si on peut envoyer au channel du local
    if (teachersToNotify.length === 0) {
      if (message.targetLocation?.teamsWebhookUrl) {
        await this.sendTeamsMessageNotification(
          message.targetLocation.teamsWebhookUrl,
          message.targetLocation,
          undefined,
          message.text,
        );
      }
      return;
    }

    const notificationPromises: Promise<unknown>[] = [];

    for (const teacher of teachersToNotify) {
      const prefs = (teacher.preferences as unknown as TeacherPreferences) || {
        notifyOnTeams: true,
      };

      if (
        prefs.notifyOnTeams &&
        teacher.teamsEmail &&
        message.targetLocation?.teamsWebhookUrl
      ) {
        notificationPromises.push(
          this.sendTeamsMessageNotification(
            message.targetLocation.teamsWebhookUrl,
            message.targetLocation,
            teacher,
            message.text,
          ),
        );
      }
    }

    await Promise.allSettled(notificationPromises);
  }

  private async sendTeamsMessageNotification(
    webhookUrl: string,
    location: Location,
    teacher: Teacher | undefined,
    text: string,
  ): Promise<boolean> {
    const targetName = teacher
      ? `Pour : ${teacher.name}`
      : "Pour : Tout le monde";

    const adaptiveCard = {
      type: "message",
      attachments: [
        {
          contentType: "application/vnd.microsoft.card.adaptive",
          contentUrl: null,
          content: {
            $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
            type: "AdaptiveCard",
            version: "1.4",
            body: [
              {
                type: "Container",
                style: "accent",
                items: [
                  {
                    type: "TextBlock",
                    text: "📨 Nouveau Message",
                    weight: "Bolder",
                    size: "Medium",
                    color: "Light",
                  },
                ],
              },
              {
                type: "Container",
                items: [
                  {
                    type: "TextBlock",
                    text: location.name,
                    weight: "Bolder",
                    size: "Large",
                    spacing: "Small",
                  },
                  {
                    type: "TextBlock",
                    text: targetName,
                    isSubtle: true,
                    spacing: "None",
                  },
                ],
              },
              {
                type: "Container",
                style: "emphasis",
                items: [
                  {
                    type: "TextBlock",
                    text: text,
                    wrap: true,
                    fontType: "Monospace",
                  },
                ],
              },
              {
                type: "TextBlock",
                text: `Reçu à ${new Date().toLocaleTimeString("fr-FR")}`,
                size: "Small",
                isSubtle: true,
                horizontalAlignment: "Right",
                spacing: "Medium",
              },
            ],
          },
        },
      ],
    };

    try {
      await axios.post(webhookUrl, adaptiveCard, { timeout: 5000 });
      logger.info("Teams message notification sent", {
        location: location.name,
        teacher: teacher?.name || "Everyone",
      });
      return true;
    } catch (error: unknown) {
      let errorMessage = "Unknown error";
      let responseData: unknown;

      if (axios.isAxiosError(error)) {
        errorMessage = error.message;
        responseData = error.response?.data;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      logger.error("Failed to send Teams message notification", {
        error: errorMessage,
        responseData,
      });
      return false;
    }
  }

  /**
   * Notifie les enseignants lors de la réception d'un message
   */

  /**
   * Notifie la sonnette qu'une visite a été manquée (timeout ou rejet)
   * Permet d'afficher un message "Professeur absent" sur l'écran
   */
  async notifyDoorbellOfMiss(
    visit: Visit & { doorbell: Doorbell },
  ): Promise<void> {
    const topic = getOutboundTopics(visit.doorbell.mqttClientId).visitMissed;
    const payload: MQTTPayloads.VisitMissed = { visitId: visit.id };

    try {
      await mqttService.publish(topic, payload, { qos: 1 });
      logger.info("Doorbell notified of missed visit", {
        visitId: visit.id,
        mqttClientId: visit.doorbell.mqttClientId,
      });
    } catch (error) {
      logger.error("Failed to notify doorbell of missed visit", {
        visitId: visit.id,
        error,
      });
    }
  }

  private async activateDoorbellBell(mqttClientId: string): Promise<boolean> {
    try {
      const topic = getOutboundTopics(mqttClientId).bellActivate;
      const duration = DEVICE_CONFIGS.doorbell.bellDuration;
      const payload: MQTTPayloads.BellActivate = { duration };

      await mqttService.publish(topic, payload, { qos: 1 });

      logger.info("Doorbell bell activated", { mqttClientId, duration });
      return true;
    } catch (error) {
      logger.error("Failed to activate doorbell bell", { error });
      return false;
    }
  }

  private async activateBuzzer(
    buzzer: { mqttClientId: string } & { teacherId: string },
  ): Promise<boolean> {
    try {
      const topic = getOutboundTopics(buzzer.mqttClientId).buzzActivate;
      const duration = DEVICE_CONFIGS.buzzer.buzzDuration;
      const payload: MQTTPayloads.BuzzActivate = { duration };

      await mqttService.publish(topic, payload, { qos: 1 });

      logger.info("Buzzer activated", {
        teacherId: buzzer.teacherId,
        mqttClientId: buzzer.mqttClientId,
        duration,
      });
      return true;
    } catch (error) {
      logger.error("Failed to activate buzzer", {
        error,
        teacherId: buzzer.teacherId,
      });
      return false;
    }
  }

  private async sendTeamsNotification(
    webhookUrl: string,
    location: Location,
    teachers: Teacher[],
  ): Promise<boolean> {
    const teacherNames =
      teachers.length > 0
        ? teachers.map((t) => t.name).join(", ")
        : "Tout le monde";

    const adaptiveCard = {
      type: "message",
      attachments: [
        {
          contentType: "application/vnd.microsoft.card.adaptive",
          content: {
            $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
            type: "AdaptiveCard",
            version: "1.4",
            body: [
              {
                type: "Container",
                style: "attention",
                items: [
                  {
                    type: "TextBlock",
                    text: "🔔 Sonnette Activée",
                    weight: "Bolder",
                    size: "Medium",
                    color: "Light",
                  },
                ],
              },
              {
                type: "Container",
                items: [
                  {
                    type: "TextBlock",
                    text: location.name,
                    weight: "Bolder",
                    size: "Large",
                    spacing: "Small",
                  },
                  {
                    type: "TextBlock",
                    text: "Quelqu'un demande à entrer",
                    isSubtle: true,
                    spacing: "None",
                  },
                ],
              },
              {
                type: "Container",
                style: "emphasis",
                items: [
                  {
                    type: "FactSet",
                    facts: [
                      {
                        title: "Professeurs notifiés",
                        value: teacherNames,
                      },
                    ],
                  },
                ],
              },
              {
                type: "TextBlock",
                text: `Reçu à ${new Date().toLocaleTimeString("fr-FR")}`,
                size: "Small",
                isSubtle: true,
                horizontalAlignment: "Right",
                spacing: "Medium",
              },
            ],
          },
        },
      ],
    };

    try {
      await axios.post(webhookUrl, adaptiveCard, { timeout: 5000 });
      logger.info("Teams notification sent", {
        location: location.name,
        teachers: teachers.length > 0 ? teachers.length : "Generic",
      });
      return true;
    } catch (error: unknown) {
      let errorMessage = "Unknown error";
      let responseData: unknown;

      if (axios.isAxiosError(error)) {
        errorMessage = error.message;
        responseData = error.response?.data;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      logger.error("Failed to send Teams notification", {
        error: errorMessage,
        responseData,
      });
      return false;
    }
  }

  /**
   * Publie une mise à jour d'affichage vers un panneau LED via MQTT
   * Utilise RETAINED pour que le panneau affiche l'info même après reconnexion
   */
  async publishPanelDisplay(
    mqttClientId: string,
    data: MQTTPayloads.DisplayUpdate,
  ): Promise<void> {
    const topic = getOutboundTopics(mqttClientId).displayUpdate;
    // QoS 1 + Retained = true assure la dispo à la reconnexion et la fiabilité
    await mqttService.publish(topic, data, { qos: 1, retained: true });
    logger.info("Panel display published (retained)", { mqttClientId });
  }

  /**
   * Publie la liste des enseignants vers un panneau LED via MQTT
   * Utilise RETAINED pour que le panneau reçoive la liste à la connexion
   */
  async publishTeachersList(
    mqttClientId: string,
    teachers: MQTTPayloads.TeacherInfo[],
  ): Promise<void> {
    const topic = getOutboundTopics(mqttClientId).teachersList;
    const payload: MQTTPayloads.TeachersList = { teachers };
    // QoS 1 + Retained = true
    await mqttService.publish(topic, payload, { qos: 1, retained: true });
    logger.info("Teachers list published to panel (retained)", {
      mqttClientId,
      teacherCount: teachers.length,
    });
  }
}

export default new NotificationService();
