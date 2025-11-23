import type { Buzzer } from "../../prisma/generated/client.js";
import { ConflictError, NotFoundError } from "../utils/errors";
import logger from "../utils/logger";
import prismaService from "../utils/prisma";

class BuzzerService {
  async create(data: {
    deviceId: string;
    mqttClientId: string;
    teacherId: string;
  }): Promise<Buzzer> {
    // Vérifie qu'aucun buzzer n'existe déjà avec ces identifiants (un seul buzzer par enseignant)
    const existing = await prismaService.client.buzzer.findFirst({
      where: {
        OR: [
          { deviceId: data.deviceId },
          { mqttClientId: data.mqttClientId },
          { teacherId: data.teacherId },
        ],
      },
    });

    if (existing) {
      if (existing.teacherId === data.teacherId) {
        throw new ConflictError("Teacher already has a buzzer");
      }
      throw new ConflictError("Device ID or MQTT Client ID already exists");
    }

    const buzzer = await prismaService.client.buzzer.create({
      data,
    });

    logger.info("Buzzer created", { buzzerId: buzzer.id });
    return buzzer;
  }

  async findAll(): Promise<Buzzer[]> {
    return prismaService.client.buzzer.findMany({
      include: { teacher: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: string): Promise<Buzzer> {
    const buzzer = await prismaService.client.buzzer.findUnique({
      where: { id },
      include: { teacher: true },
    });

    if (!buzzer) {
      throw new NotFoundError("Buzzer not found");
    }

    return buzzer;
  }

  async findByMqttClientId(mqttClientId: string): Promise<Buzzer> {
    const buzzer = await prismaService.client.buzzer.findUnique({
      where: { mqttClientId },
      include: { teacher: true },
    });

    if (!buzzer) {
      throw new NotFoundError("Buzzer not found");
    }

    return buzzer;
  }

  async findByDeviceId(deviceId: string): Promise<Buzzer> {
    const buzzer = await prismaService.client.buzzer.findUnique({
      where: { deviceId },
      include: { teacher: true },
    });

    if (!buzzer) {
      throw new NotFoundError("Buzzer not found");
    }

    return buzzer;
  }

  async findByTeacherId(teacherId: string): Promise<Buzzer | null> {
    return prismaService.client.buzzer.findUnique({
      where: { teacherId },
      include: { teacher: true },
    });
  }

  async update(
    id: string,
    data: {
      deviceId?: string;
      mqttClientId?: string;
      teacherId?: string;
    },
  ): Promise<Buzzer> {
    await this.findById(id);

    const buzzer = await prismaService.client.buzzer.update({
      where: { id },
      data,
      include: { teacher: true },
    });

    logger.info("Buzzer updated", { buzzerId: id });
    return buzzer;
  }

  async updateOnlineStatus(id: string, isOnline: boolean): Promise<void> {
    await prismaService.client.buzzer.update({
      where: { id },
      data: {
        isOnline,
        lastSeen: new Date(),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);

    await prismaService.client.buzzer.delete({
      where: { id },
    });

    logger.info("Buzzer deleted", { buzzerId: id });
  }
}

export default new BuzzerService();
