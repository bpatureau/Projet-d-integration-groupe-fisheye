import { Prisma } from "../../prisma/generated/client";
import deviceActionService from "../services/device-action.service";
import logger from "../utils/logger";
import prismaService from "../utils/prisma";

class PresenceUpdateScheduler {
    private intervalId: NodeJS.Timeout | null = null;
    private readonly CHECK_INTERVAL_MS = 60 * 1000; // 1 minute

    start() {
        if (this.intervalId) {
            return;
        }

        logger.info("Starting presence update scheduler", {
            component: "PresenceUpdateScheduler",
        });

        // Exécution immédiate puis périodique
        this.checkUpdates();
        this.intervalId = setInterval(() => {
            this.checkUpdates();
        }, this.CHECK_INTERVAL_MS);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            logger.info("Stopped presence update scheduler", {
                component: "PresenceUpdateScheduler",
            });
        }
    }

    private async checkUpdates() {
        try {
            const now = new Date();

            // Détecte les changements d'état (statuts expirés ou événements calendrier)
            const locationsToRefresh = new Set<string>();

            // 1. Vérifie les statuts manuels expirés dans la dernière minute
            const oneMinuteAgo = new Date(now.getTime() - this.CHECK_INTERVAL_MS);

            // Récupère les profs avec statut manuel (filtrage JSON fait en code)
            const teachersWithStatus = await prismaService.client.teacher.findMany({
                where: {
                    manualStatus: {
                        not: Prisma.DbNull,
                    },
                },
                include: {
                    locations: true,
                },
            });

            for (const teacher of teachersWithStatus) {
                const status = teacher.manualStatus as any;
                if (status?.until) {
                    const until = new Date(status.until);
                    if (until >= oneMinuteAgo && until <= now) {
                        // Expiré récemment
                        logger.info("Teacher manual status expired", {
                            teacherId: teacher.id,
                            until,
                        });

                        // Ajoute les lieux à rafraîchir
                        const teacherLocations = await prismaService.client.teacherLocation.findMany({
                            where: { teacherId: teacher.id }
                        });
                        teacherLocations.forEach(tl => locationsToRefresh.add(tl.locationId));
                    }
                }
            }

            // 2. Vérifie les événements calendrier (début ou fin dans la dernière minute)
            const changingSchedules = await prismaService.client.schedule.findMany({
                where: {
                    OR: [
                        {
                            startTime: {
                                gte: oneMinuteAgo,
                                lte: now,
                            },
                        },
                        {
                            endTime: {
                                gte: oneMinuteAgo,
                                lte: now,
                            },
                        },
                    ],
                },
                select: {
                    locationId: true
                }
            });

            changingSchedules.forEach(s => locationsToRefresh.add(s.locationId));

            if (locationsToRefresh.size > 0) {
                logger.info(`Found ${locationsToRefresh.size} locations to refresh due to presence updates`, {
                    locationIds: Array.from(locationsToRefresh)
                });

                for (const locationId of locationsToRefresh) {
                    await deviceActionService.refreshLocationDevices(locationId).catch(err => {
                        logger.error("Failed to refresh location devices from scheduler", { locationId, error: err });
                    });
                }
            }

        } catch (error) {
            logger.error("Error in presence update scheduler", {
                component: "PresenceUpdateScheduler",
                error,
            });
        }
    }
}

export default new PresenceUpdateScheduler();
