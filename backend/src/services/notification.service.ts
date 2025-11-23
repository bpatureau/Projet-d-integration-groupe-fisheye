import axios from "axios";
import type {
  Doorbell,
  Location,
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

    for (const teacher of teachers) {
      const channels: string[] = ["doorbell"];
      const prefs = (teacher.preferences as unknown as TeacherPreferences) || {
        notifyOnTeams: true,
        buzzerEnabled: true,
      };

      // 2. Activer le buzzer (si activé)
      if (prefs.buzzerEnabled) {
        notificationPromises.push(
          this.activateBuzzer(teacher.id).then((activated) => {
            if (activated) channels.push("buzzer");
          }),
        );
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

    logger.info(`Notifications dispatched for ${teachers.length} teachers`, {
      visitId: visit.id,
    });

    return notifiedTeachers;
  }

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

  private async activateBuzzer(teacherId: string): Promise<boolean> {
    try {
      const buzzer = await prismaService.client.buzzer.findUnique({
        where: { teacherId },
      });

      if (!buzzer || !buzzer.isOnline) {
        return false;
      }

      const topic = getOutboundTopics(buzzer.mqttClientId).buzzActivate;
      const duration = DEVICE_CONFIGS.buzzer.buzzDuration;
      const payload: MQTTPayloads.BuzzActivate = { duration };

      await mqttService.publish(topic, payload, { qos: 1 });

      logger.info("Buzzer activated", {
        teacherId,
        mqttClientId: buzzer.mqttClientId,
        duration,
      });
      return true;
    } catch (error) {
      logger.error("Failed to activate buzzer", { error, teacherId });
      return false;
    }
  }

  private async sendTeamsNotification(
    webhookUrl: string,
    location: Location,
    teachers: Teacher[],
  ): Promise<boolean> {
    const mentions = teachers.map((t) => t.name).join(", ");

    const message = {
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      summary: "Quelqu'un sonne à l'entrée",
      sections: [
        {
          activityTitle: `🔔 Sonnette - ${location.name}`,
          activitySubtitle: "Quelqu'un demande à entrer",
          facts: [
            { name: "Lieu", value: location.name },
            { name: "Professeurs notifiés", value: mentions },
            { name: "Heure", value: new Date().toLocaleTimeString("fr-FR") },
          ],
        },
      ],
    };

    try {
      await axios.post(webhookUrl, message, { timeout: 5000 }); // Timeout 5s
      logger.info("Teams notification sent", {
        location: location.name,
        teachers: teachers.length,
      });
      return true;
    } catch (error) {
      logger.error("Failed to send Teams notification", { error });
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
