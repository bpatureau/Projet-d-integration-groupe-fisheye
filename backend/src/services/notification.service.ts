import type { Doorbell, Location, Teacher, Visit } from "@prisma/client";
import axios from "axios";
import { DEVICE_CONFIGS } from "../config/devices.config";
import { getOutboundTopics, type MQTTPayloads } from "../mqtt/mqtt.constants";
import type { NotifiedTeacher, TeacherPreferences } from "../types";
import logger from "../utils/logger";
import prismaService from "../utils/prisma";
import mqttService from "./mqtt.service";

class NotificationService {
  /**
   * Notifie les enseignants lors d'une sonnerie (sonnette + Teams + buzzers)
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

    await this.activateDoorbellBell(visit.doorbell.mqttClientId);

    for (const teacher of teachers) {
      const channels: string[] = ["doorbell"];
      const prefs = (teacher.preferences as unknown as TeacherPreferences) || {
        notifyOnTeams: true,
        buzzerEnabled: true,
      };

      if (prefs.buzzerEnabled) {
        const activated = await this.activateBuzzer(teacher.id);
        if (activated) {
          channels.push("buzzer");
        }
      }

      if (
        prefs.notifyOnTeams &&
        teacher.teamsEmail &&
        visit.location.teamsWebhookUrl
      ) {
        const sent = await this.sendTeamsNotification(
          visit.location.teamsWebhookUrl,
          visit.location,
          [teacher],
        );
        if (sent) {
          channels.push("teams");
        }
      }

      notifiedTeachers.push({
        teacherId: teacher.id,
        email: teacher.email,
        name: teacher.name,
        notificationChannels: channels,
        notifiedAt: new Date(),
      });
    }

    logger.info(`Notified ${teachers.length} teachers`, {
      visitId: visit.id,
      channels: notifiedTeachers.map((nt) => nt.notificationChannels),
    });

    return notifiedTeachers;
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
        logger.warn("Buzzer not found or offline", { teacherId });
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
      await axios.post(webhookUrl, message);
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
   */
  async publishPanelDisplay(
    mqttClientId: string,
    data: MQTTPayloads.DisplayUpdate,
  ): Promise<void> {
    const topic = getOutboundTopics(mqttClientId).displayUpdate;
    await mqttService.publish(topic, data, { qos: 0 });
    logger.info("Panel display published", { mqttClientId });
  }

  /**
   * Publie la liste des enseignants vers un panneau LED via MQTT
   */
  async publishTeachersList(
    mqttClientId: string,
    teachers: MQTTPayloads.TeacherInfo[],
  ): Promise<void> {
    const topic = getOutboundTopics(mqttClientId).teachersList;
    const payload: MQTTPayloads.TeachersList = { teachers };
    await mqttService.publish(topic, payload, { qos: 1 });
    logger.info("Teachers list published to panel", {
      mqttClientId,
      teacherCount: teachers.length,
    });
  }

  /**
   * Diffuse un changement de présence à tous les panels en ligne
   */
  async broadcastPresenceChange(
    data: MQTTPayloads.PresenceChanged,
  ): Promise<void> {
    const panels = await prismaService.client.ledPanel.findMany({
      where: { isOnline: true },
    });

    logger.info("Broadcasting presence change to panels", {
      teacherId: data.teacherId,
      teacherName: data.teacherName,
      status: data.status,
      panelCount: panels.length,
    });

    const publishPromises = panels.map((panel) => {
      const topic = getOutboundTopics(panel.mqttClientId).presenceChanged;
      return mqttService.publish(topic, data, { qos: 1 }).catch((error) => {
        logger.error("Failed to broadcast presence change to panel", {
          panelId: panel.id,
          mqttClientId: panel.mqttClientId,
          error,
        });
      });
    });

    await Promise.all(publishPromises);
  }
}

export default new NotificationService();
