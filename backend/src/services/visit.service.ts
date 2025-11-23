import type {
  Prisma,
  Visit,
  VisitStatus,
} from "../../prisma/generated/client.js";
import config from "../config";
import type { VisitStats } from "../types";
import { NotFoundError } from "../utils/errors";
import logger from "../utils/logger";
import prismaService from "../utils/prisma";
import notificationService from "./notification.service";

class VisitService {
  /**
   * Crée une nouvelle visite lors de l'appui sur la sonnette
   */
  async create(data: {
    doorbellId: string;
    locationId: string;
    targetTeacherId?: string;
  }): Promise<Visit> {
    const autoMissAt = new Date();
    autoMissAt.setSeconds(autoMissAt.getSeconds() + config.timeouts.visit);

    const visit = await prismaService.client.visit.create({
      data: {
        doorbellId: data.doorbellId,
        locationId: data.locationId,
        targetTeacherId: data.targetTeacherId,
        status: "pending",
        autoMissAt,
      },
      include: {
        doorbell: true,
        location: true,
        targetTeacher: true,
      },
    });

    logger.info("Visit created", {
      visitId: visit.id,
      locationId: data.locationId,
      targetTeacherId: data.targetTeacherId,
    });

    return visit;
  }

  /**
   * Récupère toutes les visites avec filtres optionnels (pagination, statut, date, enseignant)
   */
  async findAll(filters?: {
    status?: VisitStatus;
    locationId?: string;
    teacherId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{ visits: Visit[]; total: number }> {
    const {
      status,
      locationId,
      teacherId,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = filters || {};

    const where: Prisma.VisitWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (locationId) {
      where.locationId = locationId;
    }

    if (teacherId) {
      where.OR = [{ targetTeacherId: teacherId }, { answeredById: teacherId }];
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [visits, total] = await Promise.all([
      prismaService.client.visit.findMany({
        where,
        include: {
          doorbell: true,
          location: true,
          targetTeacher: true,
          answeredBy: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prismaService.client.visit.count({ where }),
    ]);

    return { visits, total };
  }

  async findById(id: string): Promise<Visit> {
    const visit = await prismaService.client.visit.findUnique({
      where: { id },
      include: {
        doorbell: true,
        location: true,
        targetTeacher: true,
        answeredBy: true,
      },
    });

    if (!visit) {
      throw new NotFoundError("Visit not found");
    }

    return visit;
  }

  /**
   * Marque une visite comme répondue par un enseignant
   */
  async answer(visitId: string, answeredById: string): Promise<Visit> {
    const visit = await this.findById(visitId);

    if (visit.status !== "pending") {
      throw new Error("Visit is not pending");
    }

    const updated = await prismaService.client.visit.update({
      where: { id: visitId },
      data: {
        status: "answered",
        answeredById,
        answeredAt: new Date(),
      },
      include: {
        doorbell: true,
        location: true,
        targetTeacher: true,
        answeredBy: true,
      },
    });

    logger.info("Visit answered", { visitId, answeredById });
    return updated;
  }

  /**
   * Marque la porte comme ouverte et la visite comme répondue
   */
  async markDoorOpened(visitId: string): Promise<Visit> {
    const visit = await prismaService.client.visit.update({
      where: { id: visitId },
      data: {
        doorOpened: true,
        doorOpenedAt: new Date(),
        status: "answered",
      },
      include: {
        doorbell: true,
        location: true,
        targetTeacher: true,
        answeredBy: true,
      },
    });

    logger.info("Door opened for visit", { visitId });
    return visit;
  }

  /**
   * Marque une visite comme manquée (automatique ou manuelle)
   */
  async markAsMissed(visitId: string): Promise<Visit> {
    const visit = await prismaService.client.visit.update({
      where: { id: visitId },
      data: {
        status: "missed",
      },
      include: {
        doorbell: true,
        location: true,
        targetTeacher: true,
        answeredBy: true,
      },
    });

    // Notifie la sonnette que la visite est manquée
    await notificationService.notifyDoorbellOfMiss(visit);

    logger.info("Visit marked as missed", { visitId });
    return visit;
  }

  /**
   * Marque automatiquement comme manquées les visites en attente expirées
   */
  async autoMissExpiredVisits(): Promise<number> {
    const now = new Date();

    // Trouve d'abord les visites à expirer pour pouvoir les notifier
    const expiredVisits = await prismaService.client.visit.findMany({
      where: {
        status: "pending",
        autoMissAt: {
          lte: now,
        },
      },
      include: {
        doorbell: true,
        location: true,
        targetTeacher: true,
        answeredBy: true,
      },
    });

    if (expiredVisits.length === 0) {
      return 0;
    }

    // Met à jour en masse
    await prismaService.client.visit.updateMany({
      where: {
        id: { in: expiredVisits.map((v) => v.id) },
      },
      data: {
        status: "missed",
      },
    });

    // Notifie chaque sonnette
    for (const visit of expiredVisits) {
      await notificationService.notifyDoorbellOfMiss(visit).catch((err) => {
        logger.error("Failed to notify missed visit during auto-miss", {
          visitId: visit.id,
          error: err,
        });
      });
    }

    if (expiredVisits.length > 0) {
      logger.info("Auto-missed expired visits", {
        count: expiredVisits.length,
      });
    }

    return expiredVisits.length;
  }

  /**
   * Récupère la dernière visite en attente pour une sonnette (dans les 5 dernières minutes)
   */
  async getLastPendingVisit(doorbellId: string): Promise<Visit | null> {
    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

    return prismaService.client.visit.findFirst({
      where: {
        doorbellId,
        status: "pending",
        createdAt: {
          gte: fiveMinutesAgo,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        doorbell: true,
        location: true,
        targetTeacher: true,
      },
    });
  }

  /**
   * Calcule les statistiques des visites (total, temps de réponse moyen, taux d'ouverture de porte)
   */
  async getStats(filters?: {
    locationId?: string;
    teacherId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<VisitStats> {
    const where: Prisma.VisitWhereInput = {};

    if (filters?.locationId) {
      where.locationId = filters.locationId;
    }

    if (filters?.teacherId) {
      where.OR = [
        { targetTeacherId: filters.teacherId },
        { answeredById: filters.teacherId },
      ];
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const [total, pending, answered, missed, visits] = await Promise.all([
      prismaService.client.visit.count({ where }),
      prismaService.client.visit.count({
        where: { ...where, status: "pending" },
      }),
      prismaService.client.visit.count({
        where: { ...where, status: "answered" },
      }),
      prismaService.client.visit.count({
        where: { ...where, status: "missed" },
      }),
      prismaService.client.visit.findMany({
        where: {
          ...where,
          status: "answered",
          answeredAt: { not: null },
        },
        select: {
          createdAt: true,
          answeredAt: true,
          doorOpened: true,
        },
      }),
    ]);

    let averageResponseTime: number | undefined;
    if (visits.length > 0) {
      const totalResponseTime = visits.reduce((sum, visit) => {
        if (!visit.answeredAt) {
          return sum;
        }
        const diff = visit.answeredAt.getTime() - visit.createdAt.getTime();
        return sum + diff / 1000;
      }, 0);
      averageResponseTime = totalResponseTime / visits.length;
    }

    const doorOpenRate =
      answered > 0
        ? (visits.filter((v) => v.doorOpened).length / answered) * 100
        : undefined;

    return {
      total,
      pending,
      answered,
      missed,
      averageResponseTime,
      doorOpenRate,
    };
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);

    await prismaService.client.visit.delete({
      where: { id },
    });

    logger.info("Visit deleted", { visitId: id });
  }
}

export default new VisitService();
