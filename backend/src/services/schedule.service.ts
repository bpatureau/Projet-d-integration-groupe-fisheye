import { Schedule } from "@prisma/client";
import prismaService from "../utils/prisma";
import calendarService from "./calendar.service";
import locationService from "./location.service";
import logger from "../utils/logger";

class ScheduleService {
  /**
   * Synchronise les emplois du temps depuis le calendrier d'un lieu
   */
  async syncSchedulesForLocation(locationId: string): Promise<number> {
    const location = await locationService.findById(locationId);

    if (!location.calendarId) {
      logger.warn("Location has no calendar ID", { locationId });
      return 0;
    }

    await calendarService.syncCalendarForLocation(locationId, location.calendarId);

    const schedules = await calendarService.getSchedulesForLocation(locationId);
    logger.info("Synced schedules for location", {
      locationId,
      count: schedules.length,
    });

    return schedules.length;
  }

  async getSchedulesForLocation(locationId: string): Promise<Schedule[]> {
    return calendarService.getSchedulesForLocation(locationId);
  }

  async getSchedulesForTeacher(teacherId: string): Promise<Schedule[]> {
    return calendarService.getSchedulesForTeacher(teacherId);
  }
}

export default new ScheduleService();
