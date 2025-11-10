import type { Message, Prisma } from "@prisma/client";
import { NotFoundError } from "../utils/errors";
import logger from "../utils/logger";
import prismaService from "../utils/prisma";

class MessageService {
  /**
   * Crée un nouveau message depuis la sonnette
   */
  async create(data: {
    text: string;
    senderInfo?: string;
    visitId?: string;
    targetTeacherId?: string;
    targetLocationId?: string;
  }): Promise<Message> {
    const message = await prismaService.client.message.create({
      data: {
        text: data.text,
        senderInfo: data.senderInfo,
        visitId: data.visitId,
        targetTeacherId: data.targetTeacherId,
        targetLocationId: data.targetLocationId,
        isRead: false,
      },
      include: {
        visit: true,
        targetTeacher: true,
        targetLocation: true,
      },
    });

    logger.info("Message created", {
      messageId: message.id,
      targetTeacherId: data.targetTeacherId,
      targetLocationId: data.targetLocationId,
      visitId: data.visitId,
    });

    return message;
  }

  /**
   * Récupère tous les messages avec filtres optionnels
   */
  async findAll(filters?: {
    isRead?: boolean;
    targetTeacherId?: string;
    targetLocationId?: string;
    visitId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{ messages: Message[]; total: number }> {
    const {
      isRead,
      targetTeacherId,
      targetLocationId,
      visitId,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = filters || {};

    const where: Prisma.MessageWhereInput = {};

    if (isRead !== undefined) {
      where.isRead = isRead;
    }

    if (targetTeacherId) {
      where.targetTeacherId = targetTeacherId;
    }

    if (targetLocationId) {
      where.targetLocationId = targetLocationId;
    }

    if (visitId) {
      where.visitId = visitId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [messages, total] = await Promise.all([
      prismaService.client.message.findMany({
        where,
        include: {
          visit: {
            include: {
              doorbell: true,
              location: true,
            },
          },
          targetTeacher: true,
          targetLocation: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prismaService.client.message.count({ where }),
    ]);

    return { messages, total };
  }

  /**
   * Récupère un message par son ID
   */
  async findById(id: string): Promise<Message> {
    const message = await prismaService.client.message.findUnique({
      where: { id },
      include: {
        visit: {
          include: {
            doorbell: true,
            location: true,
          },
        },
        targetTeacher: true,
        targetLocation: true,
      },
    });

    if (!message) {
      throw new NotFoundError("Message not found");
    }

    return message;
  }

  /**
   * Marque un message comme lu
   */
  async markAsRead(messageId: string): Promise<Message> {
    const message = await this.findById(messageId);

    if (message.isRead) {
      return message;
    }

    const updated = await prismaService.client.message.update({
      where: { id: messageId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
      include: {
        visit: {
          include: {
            doorbell: true,
            location: true,
          },
        },
        targetTeacher: true,
        targetLocation: true,
      },
    });

    logger.info("Message marked as read", { messageId });
    return updated;
  }

  /**
   * Récupère les messages récents pour une visite (dans les 5 dernières minutes)
   */
  async getRecentMessagesForVisit(visitId: string): Promise<Message[]> {
    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

    return prismaService.client.message.findMany({
      where: {
        visitId,
        createdAt: {
          gte: fiveMinutesAgo,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        visit: true,
        targetTeacher: true,
        targetLocation: true,
      },
    });
  }

  /**
   * Compte le nombre de messages non lus pour un professeur
   */
  async countUnreadForTeacher(teacherId: string): Promise<number> {
    return prismaService.client.message.count({
      where: {
        targetTeacherId: teacherId,
        isRead: false,
      },
    });
  }

  /**
   * Compte le nombre de messages non lus pour un local
   */
  async countUnreadForLocation(locationId: string): Promise<number> {
    return prismaService.client.message.count({
      where: {
        targetLocationId: locationId,
        isRead: false,
      },
    });
  }

  /**
   * Supprime un message
   */
  async delete(id: string): Promise<void> {
    await this.findById(id);

    await prismaService.client.message.delete({
      where: { id },
    });

    logger.info("Message deleted", { messageId: id });
  }

  /**
   * Marque tous les messages comme lus pour un professeur
   */
  async markAllAsReadForTeacher(teacherId: string): Promise<number> {
    const result = await prismaService.client.message.updateMany({
      where: {
        targetTeacherId: teacherId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    logger.info("All messages marked as read for teacher", {
      teacherId,
      count: result.count,
    });

    return result.count;
  }

  /**
   * Marque tous les messages comme lus pour un local
   */
  async markAllAsReadForLocation(locationId: string): Promise<number> {
    const result = await prismaService.client.message.updateMany({
      where: {
        targetLocationId: locationId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    logger.info("All messages marked as read for location", {
      locationId,
      count: result.count,
    });

    return result.count;
  }
}

export default new MessageService();
