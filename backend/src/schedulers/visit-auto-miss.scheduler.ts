import visitService from "../services/visit.service";
import logger from "../utils/logger";

/**
 * Planificateur de marquage automatique des visites manquées
 *
 * Vérifie toutes les 10 secondes les visites en attente qui ont expiré
 * et doivent être marquées automatiquement comme manquées
 */
class VisitAutoMissScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly INTERVAL_MS = 10_000; // Vérifie toutes les 10 secondes

  /**
   * Démarre le planificateur de marquage automatique
   */
  start(): void {
    if (this.intervalId) {
      logger.warn("Visit auto-miss scheduler already running");
      return;
    }

    logger.info("Starting visit auto-miss scheduler", {
      intervalSeconds: this.INTERVAL_MS / 1000,
    });

    // Exécute immédiatement au démarrage
    this.checkExpiredVisits();

    // Puis exécute toutes les 10 secondes
    this.intervalId = setInterval(() => {
      this.checkExpiredVisits();
    }, this.INTERVAL_MS);
  }

  /**
   * Arrête le planificateur
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info("Visit auto-miss scheduler stopped");
    }
  }

  /**
   * Vérifie les visites expirées et les marque comme manquées
   */
  private async checkExpiredVisits(): Promise<void> {
    try {
      const count = await visitService.autoMissExpiredVisits();
      if (count > 0) {
        logger.info(`Auto-missed ${count} expired visits`);
      }
    } catch (error) {
      logger.error("Error checking expired visits", { error });
    }
  }
}

export default new VisitAutoMissScheduler();
