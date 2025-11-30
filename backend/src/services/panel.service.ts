import type { LedPanel, Teacher } from "../../prisma/generated/client.js";
import { DEVICE_CONFIGS } from "../config/devices.config";
import { ConflictError, NotFoundError } from "../utils/errors";
import logger from "../utils/logger";
import prismaService from "../utils/prisma";
import calendarService from "./calendar.service";

class PanelService {
  async create(data: {
    deviceId: string;
    mqttClientId: string;
    locationId: string;
  }): Promise<LedPanel> {
    // Vérifie qu'aucun panneau LED n'existe déjà avec ces identifiants
    const existing = await prismaService.client.ledPanel.findFirst({
      where: {
        OR: [{ deviceId: data.deviceId }, { mqttClientId: data.mqttClientId }],
      },
    });

    if (existing) {
      throw new ConflictError("Device ID or MQTT Client ID already exists");
    }

    const panel = await prismaService.client.ledPanel.create({
      data,
    });

    logger.info("LED Panel created", { panelId: panel.id });
    return panel;
  }

  async findAll(): Promise<LedPanel[]> {
    return prismaService.client.ledPanel.findMany({
      include: {
        location: true,
        selectedTeacher: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: string): Promise<LedPanel> {
    const panel = await prismaService.client.ledPanel.findUnique({
      where: { id },
      include: {
        location: true,
        selectedTeacher: true,
      },
    });

    if (!panel) {
      throw new NotFoundError("LED Panel not found");
    }

    return panel;
  }

  async findByDeviceId(deviceId: string): Promise<LedPanel> {
    const panel = await prismaService.client.ledPanel.findUnique({
      where: { deviceId },
      include: {
        location: true,
        selectedTeacher: true,
      },
    });

    if (!panel) {
      throw new NotFoundError("LED Panel not found");
    }

    return panel;
  }

  async findByMqttClientId(mqttClientId: string): Promise<LedPanel> {
    const panel = await prismaService.client.ledPanel.findUnique({
      where: { mqttClientId },
      include: {
        location: true,
        selectedTeacher: true,
      },
    });

    if (!panel) {
      throw new NotFoundError("LED Panel not found");
    }

    return panel;
  }

  async update(
    id: string,
    data: {
      deviceId?: string;
      mqttClientId?: string;
      locationId?: string;
      selectedTeacherId?: string | null;
    },
  ): Promise<LedPanel> {
    await this.findById(id);

    const panel = await prismaService.client.ledPanel.update({
      where: { id },
      data,
      include: {
        location: true,
        selectedTeacher: true,
      },
    });

    logger.info("LED Panel updated", { panelId: id });
    return panel;
  }

  async updateSelectedTeacher(
    id: string,
    teacherId: string | null,
  ): Promise<LedPanel> {
    return this.update(id, { selectedTeacherId: teacherId });
  }

  async updateOnlineStatus(id: string, isOnline: boolean): Promise<void> {
    await prismaService.client.ledPanel.update({
      where: { id },
      data: {
        isOnline,
        lastSeen: new Date(),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);

    await prismaService.client.ledPanel.delete({
      where: { id },
    });

    logger.info("LED Panel deleted", { panelId: id });
  }

  /**
   * Génère la grille d'emploi du temps pour le panneau LED
   * Utilise la configuration définie dans devices.config.ts
   */
  async generateWeekScheduleGrid(teacher: Teacher): Promise<boolean[][]> {
    const config = DEVICE_CONFIGS.ledPanel.schedule;
    // Initialisation de la grille vide
    const grid: boolean[][] = Array.from({ length: config.days }, () =>
      Array(config.timeBlocks.length).fill(false),
    );

    const now = new Date();

    // Calcul du Lundi de la semaine courante
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay(); // 0 = Dimanche, 1 = Lundi...
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Ajuste au Lundi
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    // Si un emploi du temps manuel est défini, on l'utilise s'il est valide pour cette semaine
    if (teacher.manualSchedule) {
      const scheduleData = teacher.manualSchedule as {
        weekStart?: string;
        data?: boolean[][];
      };

      if (scheduleData.weekStart && Array.isArray(scheduleData.data)) {
        const manualWeekStart = new Date(scheduleData.weekStart);
        // On compare les dates (ignorer l'heure si besoin, mais setHours(0,0,0,0) aide)
        if (manualWeekStart.toDateString() === startOfWeek.toDateString()) {
          const manualSchedule = scheduleData.data;
          // Validation basique des dimensions
          if (
            manualSchedule.length === config.days &&
            manualSchedule[0].length === config.timeBlocks.length
          ) {
            return manualSchedule;
          }
          logger.warn(
            "Invalid manual schedule dimensions, falling back to calendar",
            {
              teacherId: teacher.id,
            },
          );
        }
      }
    }

    if (!teacher.gmailEmail) {
      return grid;
    }

    // (Variables now, startOfWeek, day, diff déjà calculées plus haut)

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 5); // Vendredi soir inclus

    const schedules = await calendarService.getTeacherSchedule(
      teacher.gmailEmail,
      startOfWeek,
      endOfWeek,
    );

    for (let dayIndex = 0; dayIndex < config.days; dayIndex++) {
      const dayStart = new Date(startOfWeek);
      dayStart.setDate(startOfWeek.getDate() + dayIndex);

      for (
        let blockIndex = 0;
        blockIndex < config.timeBlocks.length;
        blockIndex++
      ) {
        const block = config.timeBlocks[blockIndex];
        const blockStart = new Date(dayStart);
        blockStart.setHours(block.start, 0, 0, 0);
        const blockEnd = new Date(dayStart);
        blockEnd.setHours(block.end, 0, 0, 0);

        // Vérifie si un cours chevauche ce bloc horaire
        const hasEvent = schedules.some((schedule) => {
          const scheduleStart = new Date(schedule.startTime);
          const scheduleEnd = new Date(schedule.endTime);
          // Logique d'intersection d'intervalles
          return scheduleStart < blockEnd && scheduleEnd > blockStart;
        });

        grid[dayIndex][blockIndex] = hasEvent;
      }
    }

    return grid;
  }
}

export default new PanelService();
