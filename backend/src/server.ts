import http from "node:http";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import config from "./config";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";
import mqttDispatcher from "./mqtt/dispatcher";
import routes from "./routes";
import visitAutoMissScheduler from "./schedulers/visit-auto-miss.scheduler";
import presenceUpdateScheduler from "./schedulers/presence-update.scheduler";
import calendarService from "./services/calendar.service";
import mqttService from "./services/mqtt.service";
import logger from "./utils/logger";
import prismaService from "./utils/prisma";

class Server {
  private app: express.Application;
  private server: http.Server;

  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandlers();
  }

  private setupMiddleware() {
    this.app.use(helmet());

    this.app.use(
      cors({
        origin: config.cors.allowedOrigins.includes("*")
          ? "*"
          : config.cors.allowedOrigins,
        credentials: true,
      }),
    );

    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    this.app.set("trust proxy", 1);
  }

  private setupRoutes() {
    this.app.use("/api", routes);
  }

  private setupErrorHandlers() {
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
  }

  async initialize() {
    try {
      logger.info("Connecting to database...");
      await prismaService.ping();
      logger.info("Database connected");

      await this.seedDefaultAdmin();

      logger.info("Connecting to MQTT broker...");
      await mqttService.connect();
      logger.info("MQTT connected");

      logger.info("Initializing calendar service...");
      await calendarService.initialize();

      logger.info("Initializing MQTT dispatcher...");
      mqttDispatcher.initialize();

      logger.info("Starting visit auto-miss scheduler...");
      visitAutoMissScheduler.start();

      logger.info("Starting presence update scheduler...");
      presenceUpdateScheduler.start();

      logger.info("All services initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize services", { error });
      throw error;
    }
  }

  private async seedDefaultAdmin() {
    try {
      const teacherCount = await prismaService.client.teacher.count();

      if (teacherCount === 0) {
        logger.info("========================================");
        logger.info("No data found in database!");
        logger.info(
          "To seed the database with demo data, run: npm run prisma:reset",
        );
        logger.info("Or manually seed with: npm run seed");
        logger.info("========================================");
      } else {
        logger.info(`Database contains ${teacherCount} teacher(s)`);
      }
    } catch (error) {
      logger.error("Failed to check database status", { error });
    }
  }

  async start() {
    await this.initialize();

    this.server.listen(config.server.port, config.server.host, () => {
      logger.info(
        `Server listening on ${config.server.host}:${config.server.port}`,
      );
    });

    process.on("SIGINT", () => this.shutdown("SIGINT"));
    process.on("SIGTERM", () => this.shutdown("SIGTERM"));
  }

  private async shutdown(signal: string) {
    logger.info(`${signal} received, shutting down gracefully...`);

    try {
      await new Promise<void>((resolve, reject) => {
        this.server.close((err) => {
          if (err) {
            logger.error("Error closing HTTP server", { error: err });
            reject(err);
          } else {
            logger.info("HTTP server closed");
            resolve();
          }
        });
      });

      logger.info("Stopping schedulers...");
      visitAutoMissScheduler.stop();
      presenceUpdateScheduler.stop();

      logger.info("Disconnecting from MQTT...");
      await mqttService.disconnect();

      logger.info("Closing database connections...");
      await prismaService.disconnect();

      logger.info("Shutdown complete");
      process.exit(0);
    } catch (error) {
      logger.error("Error during shutdown", { error });
      process.exit(1);
    }
  }
}

const server = new Server();
server.start().catch((error) => {
  logger.error("Failed to start server", { error });
  process.exit(1);
});
