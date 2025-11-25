import type { Doorbell } from "../../prisma/generated/client.js";
import { ConflictError, NotFoundError } from "../utils/errors";
import logger from "../utils/logger";
import prismaService from "../utils/prisma";

class DoorbellService {
  async create(data: {
    deviceId: string;
    mqttClientId: string;
    locationId: string;
  }): Promise<Doorbell> {
    // Vérifie qu'aucune sonnette n'existe déjà avec ces identifiants
    const existing = await prismaService.client.doorbell.findFirst({
      where: {
        OR: [{ deviceId: data.deviceId }, { mqttClientId: data.mqttClientId }],
      },
    });

    if (existing) {
      throw new ConflictError("Device ID or MQTT Client ID already exists");
    }

    const doorbell = await prismaService.client.doorbell.create({
      data: {
        deviceId: data.deviceId,
        mqttClientId: data.mqttClientId,
        locationId: data.locationId,
      },
    });

    logger.info("Doorbell created", { doorbellId: doorbell.id });
    return doorbell;
  }

  async findAll(): Promise<Doorbell[]> {
    return prismaService.client.doorbell.findMany({
      include: { location: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: string): Promise<Doorbell> {
    const doorbell = await prismaService.client.doorbell.findUnique({
      where: { id },
      include: { location: true },
    });

    if (!doorbell) {
      throw new NotFoundError("Doorbell not found");
    }

    return doorbell;
  }

  async findByDeviceId(deviceId: string): Promise<Doorbell> {
    const doorbell = await prismaService.client.doorbell.findUnique({
      where: { deviceId },
      include: { location: true },
    });

    if (!doorbell) {
      throw new NotFoundError("Doorbell not found");
    }

    return doorbell;
  }

  async findByMqttClientId(mqttClientId: string): Promise<Doorbell> {
    const doorbell = await prismaService.client.doorbell.findUnique({
      where: { mqttClientId },
      include: { location: true },
    });

    if (!doorbell) {
      throw new NotFoundError("Doorbell not found");
    }

    return doorbell;
  }

  async update(
    id: string,
    data: {
      deviceId?: string;
      mqttClientId?: string;
      locationId?: string;
    },
  ): Promise<Doorbell> {
    await this.findById(id);

    const doorbell = await prismaService.client.doorbell.update({
      where: { id },
      data,
      include: { location: true },
    });

    logger.info("Doorbell updated", { doorbellId: id });
    return doorbell;
  }

  async updateOnlineStatus(id: string, isOnline: boolean): Promise<void> {
    await prismaService.client.doorbell.update({
      where: { id },
      data: {
        isOnline,
        lastSeen: new Date(),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);

    await prismaService.client.doorbell.delete({
      where: { id },
    });

    logger.info("Doorbell deleted", { doorbellId: id });
  }
}

export default new DoorbellService();
