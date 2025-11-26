import type {
  Buzzer,
  Doorbell,
  LedPanel,
  Message,
  Prisma,
  Teacher,
  Visit,
} from "../../prisma/generated/client.js";
import type { MQTTPayloads } from "../mqtt/mqtt.constants.js";
import { NotFoundError, ValidationError } from "../utils/errors";
import logger from "../utils/logger";
import prismaService from "../utils/prisma";
import buzzerService from "./buzzer.service";
import doorbellService from "./doorbell.service";
import messageService from "./message.service";
import notificationService from "./notification.service";
import panelService from "./panel.service";
import presenceService from "./presence.service";
import visitService from "./visit.service";

/**
 * Service de gestion des actions des appareils (sonnettes, buzzers, panneaux LED)
 * Gère les flux métier: sonnerie avec choix d'enseignant, ouverture de porte, sélection sur panneau LED
 */
class DeviceActionService {
  /**
   * Gère l'appui sur le bouton de sonnette (avec enseignant cible optionnel)
   * Flux 1: Sonnerie avec choix de professeur
   */
  async handleDoorbellButtonPressed(
    doorbellId: string,
    targetTeacherId?: string,
  ): Promise<Visit> {
    const doorbell = await prismaService.client.doorbell.findUnique({
      where: { id: doorbellId },
      include: { location: true },
    });

    if (!doorbell) {
      throw new NotFoundError("Doorbell not found");
    }

    let validatedTargetTeacherId: string | undefined = targetTeacherId;
    if (targetTeacherId) {
      const teacher = await prismaService.client.teacher.findUnique({
        where: { id: targetTeacherId },
      });

      if (!teacher) {
        logger.warn("Target teacher not found, creating visit without target", {
          targetTeacherId,
          doorbellId,
        });
        validatedTargetTeacherId = undefined;
      }
    }

    const visit = await visitService.create({
      doorbellId: doorbell.id,
      locationId: doorbell.locationId,
      targetTeacherId: validatedTargetTeacherId,
    });

    logger.info("Doorbell button pressed", {
      doorbellId: doorbell.id,
      locationId: doorbell.locationId,
      targetTeacherId: validatedTargetTeacherId,
      visitId: visit.id,
    });

    const presentTeachers = await presenceService.getOnlyPresentTeachers(
      doorbell.locationId,
    );

    let teachersToNotify: Teacher[] = presentTeachers;
    if (validatedTargetTeacherId) {
      // Notifie uniquement l'enseignant ciblé s'il est présent
      teachersToNotify = presentTeachers.filter(
        (t) => t.id === validatedTargetTeacherId,
      );
      if (teachersToNotify.length === 0) {
        logger.warn("Target teacher not present", {
          targetTeacherId: validatedTargetTeacherId,
          locationId: doorbell.locationId,
        });
        // Optionnel: Notifier tous les profs si le ciblé est absent ?
      }
    }

    const visitWithRelations = {
      ...visit,
      doorbell,
      location: doorbell.location,
    };

    notificationService
      .notifyTeachersOfRing(visitWithRelations, teachersToNotify)
      .catch((error) => {
        logger.error("Failed to send notifications", {
          error,
          visitId: visit.id,
        });
      });

    return visit;
  }

  /**
   * Gère l'ouverture de la porte (marque la dernière visite comme répondue)
   * Flux 2: Détection ouverture de porte
   */
  async handleDoorOpened(doorbellId: string): Promise<Visit | null> {
    const visit = await visitService.getLastPendingVisit(doorbellId);

    if (!visit) {
      logger.warn("Door opened but no recent pending visit found", {
        doorbellId,
      });
      return null;
    }

    const updatedVisit = await visitService.markDoorOpened(visit.id);

    logger.info("Door opened, visit answered", {
      visitId: visit.id,
      doorbellId,
    });

    return updatedVisit;
  }

  /**
   * Gère la sélection d'un enseignant sur le panneau LED (affiche son emploi du temps)
   * Flux 3: Affichage LED Panel
   */
  async handleTeacherSelected(
    panelId: string,
    teacherId: string,
  ): Promise<void> {
    const panel = await prismaService.client.ledPanel.findUnique({
      where: { id: panelId },
      include: { location: true },
    });

    if (!panel) {
      throw new NotFoundError("LED Panel not found");
    }

    const teacher = await prismaService.client.teacher.findUnique({
      where: { id: teacherId },
    });

    if (!teacher) {
      throw new NotFoundError("Teacher not found");
    }

    await panelService.updateSelectedTeacher(panel.id, teacher.id);

    const weekSchedule = await panelService.generateWeekScheduleGrid(teacher);

    await notificationService.publishPanelDisplay(panel.mqttClientId, {
      teacherName: teacher.name,
      teacherId: teacher.id,
      weekSchedule,
    });

    logger.info("Teacher selected on LED panel", {
      panelId: panel.id,
      teacherId: teacher.id,
      teacherName: teacher.name,
    });
  }

  /**
   * Gère la création d'un message depuis la sonnette
   * Le message peut être lié à une visite récente ou être autonome
   */
  async handleDoorbellMessage(
    doorbellId: string,
    text: string,
    targetTeacherId?: string,
    targetLocationId?: string,
  ): Promise<Message> {
    const doorbell = await prismaService.client.doorbell.findUnique({
      where: { id: doorbellId },
      include: { location: true },
    });

    if (!doorbell) {
      throw new NotFoundError("Doorbell not found");
    }

    // Cherche une visite récente (dans les 5 dernières minutes)
    const recentVisit = await visitService.getLastPendingVisit(doorbellId);

    // Détermine la cible du message
    // Le message est toujours associé au local de la sonnette par défaut
    const finalTargetLocationId = targetLocationId || doorbell.locationId;

    // Crée le message
    const message = await messageService.create({
      text,
      senderInfo: `Doorbell at ${doorbell.location.name}`,
      visitId: recentVisit?.id,
      targetTeacherId,
      targetLocationId: finalTargetLocationId,
    });

    logger.info("Message created from doorbell", {
      messageId: message.id,
      doorbellId: doorbell.id,
      visitId: recentVisit?.id,
      targetTeacherId,
      targetLocationId: finalTargetLocationId,
    });

    // Notifie les enseignants concernés
    const messageWithRelations = await messageService.findById(message.id);

    await notificationService.notifyTeachersOfMessage(messageWithRelations);

    return message;
  }

  /**
   * Met à jour les panneaux LED pour les enseignants dont les horaires ont changé
   */
  async updatePanelsForTeachers(teacherEmails: string[]): Promise<void> {
    if (teacherEmails.length === 0) {
      return;
    }

    logger.info("Updating panels for teachers with schedule changes", {
      teacherCount: teacherEmails.length,
    });

    // Récupère les enseignants par email
    const teachers = await prismaService.client.teacher.findMany({
      where: {
        gmailEmail: {
          in: teacherEmails,
        },
      },
    });

    if (teachers.length === 0) {
      logger.warn("No teachers found for the given emails", {
        teacherEmails,
      });
      return;
    }

    // Pour chaque enseignant, trouve les panneaux qui l'affichent et les met à jour
    for (const teacher of teachers) {
      const panels = await prismaService.client.ledPanel.findMany({
        where: {
          selectedTeacherId: teacher.id,
          isOnline: true, // Only update online panels
        },
      });

      if (panels.length === 0) {
        continue;
      }

      logger.info("Updating panels for teacher", {
        teacherId: teacher.id,
        teacherName: teacher.name,
        panelCount: panels.length,
      });

      // Génère la grille d'emploi du temps
      const weekSchedule = await panelService.generateWeekScheduleGrid(teacher);

      // Envoie la mise à jour à chaque panneau
      for (const panel of panels) {
        try {
          await notificationService.publishPanelDisplay(panel.mqttClientId, {
            teacherName: teacher.name,
            teacherId: teacher.id,
            weekSchedule,
          });

          logger.info("Panel updated with new schedule", {
            panelId: panel.id,
            teacherId: teacher.id,
            teacherName: teacher.name,
          });
        } catch (error) {
          logger.error("Failed to update panel", {
            panelId: panel.id,
            teacherId: teacher.id,
            error,
          });
        }
      }
    }
  }

  /**
   * Gère le status d'un appareil (met à jour son statut en ligne/hors ligne)
   * Supporte désormais la détection de déconnexion via LWT (isOnline = false)
   */
  async handleStatus(
    deviceType: "doorbell" | "buzzer" | "panel",
    device: Doorbell | Buzzer | LedPanel,
    isOnline: boolean = true,
  ): Promise<void> {
    switch (deviceType) {
      case "doorbell":
        await doorbellService.updateOnlineStatus(device.id, isOnline);
        break;
      case "buzzer":
        await buzzerService.updateOnlineStatus(device.id, isOnline);
        break;
      case "panel":
        await panelService.updateOnlineStatus(device.id, isOnline);
        break;
      default:
        throw new ValidationError(`Unknown device type: ${deviceType}`);
    }

    // Loggue les changements d'état
    if (device.isOnline !== isOnline) {
      if (isOnline) {
        logger.info("Device came online", {
          deviceType,
          deviceId: device.deviceId,
        });
      } else {
        logger.warn("Device went offline", {
          deviceType,
          deviceId: device.deviceId,
        });
      }
    } else {
      // Heartbeat (pas de changement d'état)
      logger.debug("Device status update (heartbeat)", {
        deviceType,
        deviceId: device.deviceId,
        isOnline,
      });
    }
  }

  /**
   * Déclenche le rafraîchissement des données (liste des profs) pour un local
   * Peut être appelé par un panneau LED ou une sonnette
   */
  async triggerLocationRefresh(
    locationId: string,
    requestingDeviceId?: string,
  ): Promise<void> {
    logger.info("Location refresh requested", {
      locationId,
      requestingDeviceId,
    });

    // Déclenche un rafraîchissement global pour le local
    // Cela enverra la liste à tous les appareils du local (y compris celui qui a demandé)
    await this.refreshLocationDevices(locationId);
  }

  /**
   * Gère la mise à jour de présence d'un enseignant depuis un panel
   * Met à jour le statut manuel de présence et diffuse le changement
   */
  async handlePresenceUpdate(
    panelId: string,
    teacherId: string,
    status: "present" | "absent" | "dnd",
    until?: string,
  ): Promise<void> {
    const panel = await prismaService.client.ledPanel.findUnique({
      where: { id: panelId },
    });

    if (!panel) {
      throw new NotFoundError("LED Panel not found");
    }

    const teacher = await prismaService.client.teacher.findUnique({
      where: { id: teacherId },
    });

    if (!teacher) {
      throw new NotFoundError("Teacher not found");
    }

    // Met à jour le statut manuel de l'enseignant
    const manualStatus: {
      status: "present" | "absent" | "dnd";
      until?: string;
    } = {
      status,
      ...(until && { until }),
    };

    await prismaService.client.teacher.update({
      where: { id: teacherId },
      data: {
        manualStatus: manualStatus as Prisma.InputJsonValue,
      },
    });

    logger.info("Teacher presence updated from panel", {
      panelId,
      teacherId,
      teacherName: teacher.name,
      status,
      until,
    });

    // Rafraîchit tous les appareils du local avec la nouvelle liste
    await this.refreshLocationDevices(panel.locationId);
  }

  /**
   * Génère le payload de la liste des enseignants pour un local donné
   */
  private async getTeachersListPayload(
    locationId: string,
  ): Promise<MQTTPayloads.TeacherInfo[]> {
    // Récupère tous les enseignants associés à ce lieu
    const teacherLocations =
      await prismaService.client.teacherLocation.findMany({
        where: { locationId },
        include: { teacher: true },
      });

    const teachers = teacherLocations.map((tl) => tl.teacher);

    // Récupère les informations de présence pour chaque enseignant
    const presentTeachers =
      await presenceService.getPresentTeachersInLocation(locationId);

    // Crée la liste des enseignants avec leur statut de présence
    return teachers.map((teacher) => {
      const presenceInfo = presentTeachers.find((pt) => pt.id === teacher.id);
      return {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        isPresent: presenceInfo?.isPresent || false,
        presenceSource: presenceInfo?.presenceSource || "unavailable",
        manualStatus: presenceInfo?.manualStatus
          ? {
              status: presenceInfo.manualStatus.status,
              until: presenceInfo.manualStatus.until?.toISOString(),
            }
          : undefined,
      };
    });
  }

  /**
   * Rafraîchit les données (liste des profs) sur tous les appareils d'un local
   * Utilise des messages RETAINED pour que les appareils soient toujours à jour
   */
  async refreshLocationDevices(locationId: string): Promise<void> {
    logger.info("Refreshing devices for location", { locationId });

    const teachersList = await this.getTeachersListPayload(locationId);

    // 1. Récupérer tous les panneaux LED du local (en ligne)
    const panels = await prismaService.client.ledPanel.findMany({
      where: { locationId, isOnline: true },
    });

    // 2. Récupérer toutes les sonnettes du local (en ligne)
    // Note: Les sonnettes peuvent aussi afficher la liste des profs
    const doorbells = await prismaService.client.doorbell.findMany({
      where: { locationId, isOnline: true },
    });

    const devices = [
      ...panels.map((p) => ({
        id: p.id,
        mqttClientId: p.mqttClientId,
        type: "panel",
      })),
      ...doorbells.map((d) => ({
        id: d.id,
        mqttClientId: d.mqttClientId,
        type: "doorbell",
      })),
    ];

    logger.info(
      `Found ${devices.length} devices to refresh in location ${locationId}`,
    );

    // 3. Publier la liste mise à jour vers chaque appareil
    const publishPromises = devices.map((device) => {
      return notificationService
        .publishTeachersList(device.mqttClientId, teachersList)
        .catch((error) => {
          logger.error("Failed to publish teachers list to device", {
            deviceId: device.id,
            mqttClientId: device.mqttClientId,
            error,
          });
        });
    });

    await Promise.all(publishPromises);
  }
}

export default new DeviceActionService();
