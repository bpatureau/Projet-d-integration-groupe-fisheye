import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "../../prisma/generated/client.js";
import logger from "./logger";

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);

class PrismaService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      adapter,
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
    this.prisma.$on("query" as never, (e: unknown) => {
      logger.debug("Query executed", {
        component: "prisma",
        duration:
          typeof e === "object" && e !== null && "duration" in e
            ? e.duration
            : undefined,
        query:
          typeof e === "object" && e !== null && "query" in e
            ? e.query
            : undefined,
      });
    });

    // Journalise les erreurs
    this.prisma.$on("error" as never, (e: unknown) => {
      logger.error("Prisma error", {
        component: "prisma",
        error: e,
      });
    });

    // Journalise les avertissements
    this.prisma.$on("warn" as never, (e: unknown) => {
      logger.warn("Prisma warning", {
        component: "prisma",
        message:
          typeof e === "object" && e !== null && "message" in e
            ? e.message
            : undefined,
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
