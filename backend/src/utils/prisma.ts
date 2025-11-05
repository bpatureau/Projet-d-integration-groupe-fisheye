import { PrismaClient } from "@prisma/client";
import logger from "./logger";

class PrismaService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      log: [
        {
          emit: "event",
          level: "query",
        },
        {
          emit: "event",
          level: "error",
        },
        {
          emit: "event",
          level: "warn",
        },
      ],
    });

    // Journalise les requêtes en mode debug
    this.prisma.$on("query" as never, (e: any) => {
      logger.debug("Query executed", {
        component: "prisma",
        duration: e.duration,
        query: e.query,
      });
    });

    // Journalise les erreurs
    this.prisma.$on("error" as never, (e: any) => {
      logger.error("Prisma error", {
        component: "prisma",
        error: e,
      });
    });

    // Journalise les avertissements
    this.prisma.$on("warn" as never, (e: any) => {
      logger.warn("Prisma warning", {
        component: "prisma",
        message: e.message,
      });
    });
  }

  get client() {
    return this.prisma;
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }

  async ping(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}

export default new PrismaService();
