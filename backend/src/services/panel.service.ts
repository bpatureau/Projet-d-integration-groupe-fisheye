import { LEDPanel } from "@prisma/client";
import prismaService from "../utils/prisma";
import { NotFoundError, ConflictError } from "../utils/errors";
import logger from "../utils/logger";

class PanelService {
  async create(data: {
    deviceId: string;
    mqttClientId: string;
    locationId: string;
  }): Promise<LEDPanel> {
    // Vérifie qu'aucun panneau LED n'existe déjà avec ces identifiants
    const existing = await prismaService.client.lEDPanel.findFirst({
      where: {
        OR: [{ deviceId: data.deviceId }, { mqttClientId: data.mqttClientId }],
      },
    });

    if (existing) {
      throw new ConflictError("Device ID or MQTT Client ID already exists");
    }

    const panel = await prismaService.client.lEDPanel.create({
      data,
    });

    logger.info("LED Panel created", { panelId: panel.id });
    return panel;
  }

  async findAll(): Promise<LEDPanel[]> {
    return prismaService.client.lEDPanel.findMany({
      include: {
        location: true,
        selectedTeacher: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: string): Promise<LEDPanel> {
    const panel = await prismaService.client.lEDPanel.findUnique({
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

  async findByDeviceId(deviceId: string): Promise<LEDPanel> {
    const panel = await prismaService.client.lEDPanel.findUnique({
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

  async findByMqttClientId(mqttClientId: string): Promise<LEDPanel> {
    const panel = await prismaService.client.lEDPanel.findUnique({
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
    }
  ): Promise<LEDPanel> {
    await this.findById(id);

    const panel = await prismaService.client.lEDPanel.update({
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
    teacherId: string | null
  ): Promise<LEDPanel> {
    return this.update(id, { selectedTeacherId: teacherId });
  }

  async updateOnlineStatus(id: string, isOnline: boolean): Promise<void> {
    await prismaService.client.lEDPanel.update({
      where: { id },
      data: {
        isOnline,
        lastSeen: new Date(),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);

    await prismaService.client.lEDPanel.delete({
      where: { id },
    });

    logger.info("LED Panel deleted", { panelId: id });
  }
}

export default new PanelService();
