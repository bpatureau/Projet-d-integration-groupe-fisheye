import type { Doorbell, LEDPanel, Teacher, Visit } from "@prisma/client";
import { DEVICE_CONFIGS } from "../config/devices.config";
import { NotFoundError, ValidationError } from "../utils/errors";
import logger from "../utils/logger";
import prismaService from "../utils/prisma";
import buzzerService from "./buzzer.service";
import calendarService from "./calendar.service";
import doorbellService from "./doorbell.service";
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
      }
    }

    if (teachersToNotify.length > 0) {
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
    }

    return visit;
  }

  async handleDoorbellButtonPressedByDeviceId(
    deviceId: string,
    targetTeacherId?: string,
  ): Promise<Visit> {
    const doorbell = await doorbellService.findByDeviceId(deviceId);
    return this.handleDoorbellButtonPressed(doorbell.id, targetTeacherId);
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

  async handleDoorOpenedByDeviceId(deviceId: string): Promise<Visit | null> {
    const doorbell = await doorbellService.findByDeviceId(deviceId);
    return this.handleDoorOpened(doorbell.id);
  }

  /**
   * Gère la sélection d'un enseignant sur le panneau LED (affiche son emploi du temps)
   * Flux 3: Affichage LED Panel
   */
  async handleTeacherSelected(
    panelId: string,
    teacherId: string,
  ): Promise<void> {
    const panel = await prismaService.client.lEDPanel.findUnique({
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

    const weekSchedule = await this.generateWeekScheduleGrid(teacher);

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

  async handleTeacherSelectedByDeviceId(
    deviceId: string,
    teacherId: string,
  ): Promise<void> {
    const panel = await panelService.findByDeviceId(deviceId);
    return this.handleTeacherSelected(panel.id, teacherId);
  }

  /**
   * Génère la grille d'emploi du temps pour le panneau LED (5×4)
   * 5 jours (Lun-Ven) × 4 blocs horaires (8h-10h, 10h-12h, 14h-16h, 16h-18h)
   */
  private async generateWeekScheduleGrid(
    teacher: Teacher,
  ): Promise<boolean[][]> {
    if (!teacher.gmailEmail) {
      return Array(5).fill(Array(4).fill(false));
    }

    const config = DEVICE_CONFIGS.ledPanel;
    const now = new Date();

    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 5);

    const schedules = await calendarService.getTeacherSchedule(
      teacher.gmailEmail,
      startOfWeek,
      endOfWeek,
    );

    const grid: boolean[][] = Array.from({ length: 5 }, () =>
      Array(4).fill(false),
    );

    const timeBlocks = [
      { start: 8, end: 10 },
      { start: 10, end: 12 },
      { start: 14, end: 16 },
      { start: 16, end: 18 },
    ];

    for (let dayIndex = 0; dayIndex < 5; dayIndex++) {
      const dayStart = new Date(startOfWeek);
      dayStart.setDate(startOfWeek.getDate() + dayIndex);

      for (let blockIndex = 0; blockIndex < 4; blockIndex++) {
        const block = timeBlocks[blockIndex];
        const blockStart = new Date(dayStart);
        blockStart.setHours(block.start, 0, 0, 0);
        const blockEnd = new Date(dayStart);
        blockEnd.setHours(block.end, 0, 0, 0);

        const hasEvent = schedules.some((schedule) => {
          const scheduleStart = new Date(schedule.startTime);
          const scheduleEnd = new Date(schedule.endTime);
          return scheduleStart < blockEnd && scheduleEnd > blockStart;
        });

        grid[dayIndex][blockIndex] = hasEvent;
      }
    }

    return grid;
  }

  /**
   * Gère le heartbeat d'un appareil (met à jour son statut en ligne)
   */
  async handleHeartbeat(
    deviceType: "doorbell" | "buzzer" | "panel",
    deviceId: string,
  ): Promise<void> {
    let device: Doorbell | any | LEDPanel | null = null;

    switch (deviceType) {
      case "doorbell":
        device = await doorbellService.findByDeviceId(deviceId);
        await doorbellService.updateOnlineStatus(device.id, true);
        break;
      case "buzzer":
        device = await buzzerService.findByDeviceId(deviceId);
        await buzzerService.updateOnlineStatus(device.id, true);
        break;
      case "panel":
        device = await panelService.findByDeviceId(deviceId);
        await panelService.updateOnlineStatus(device.id, true);
        break;
      default:
        throw new ValidationError(`Unknown device type: ${deviceType}`);
    }

    logger.debug("Device heartbeat received", { deviceType, deviceId });
  }
}

export default new DeviceActionService();
