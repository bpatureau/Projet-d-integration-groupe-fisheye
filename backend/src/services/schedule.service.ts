import type { Schedule } from "../../prisma/generated/client.js";
import logger from "../utils/logger";
import calendarService from "./calendar.service";
import deviceActionService from "./device-action.service";
import locationService from "./location.service";

class ScheduleService {
  /**
   * Synchronise les emplois du temps depuis le calendrier d'un lieu
   * Met également à jour les panneaux LED pour les enseignants concernés
   */
  async syncSchedulesForLocation(locationId: string): Promise<number> {
    const location = await locationService.findById(locationId);

    if (!location.calendarId) {
      logger.warn("Location has no calendar ID", { locationId });
      return 0;
    }

    const updatedTeacherEmails = await calendarService.syncCalendarForLocation(
      locationId,
      location.calendarId,
    );

    const schedules = await calendarService.getSchedulesForLocation(locationId);
    logger.info("Synced schedules for location", {
      locationId,
      count: schedules.length,
      updatedTeachers: updatedTeacherEmails.length,
    });

    // Met à jour les panneaux LED pour les enseignants dont les horaires ont changé
    if (updatedTeacherEmails.length > 0) {
      deviceActionService
        .updatePanelsForTeachers(updatedTeacherEmails)
        .catch((error) => {
          logger.error("Failed to update panels after schedule sync", {
            locationId,
            error,
          });
        });
    }

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
