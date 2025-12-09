import type { Teacher } from "../../prisma/generated/client.js";
import type { PresentTeacher } from "../types";
import prismaService from "../utils/prisma";
import calendarService from "./calendar.service";

class PresenceService {
  /**
   * Récupère les enseignants présents dans un lieu à un instant donné
   */
  async getPresentTeachersInLocation(
    locationId: string,
    now: Date = new Date(),
  ): Promise<PresentTeacher[]> {
    // Récupère tous les enseignants associés à ce lieu
    const teacherLocations =
      await prismaService.client.teacherLocation.findMany({
        where: { locationId },
        include: { teacher: true },
      });

    const teachers = teacherLocations.map((tl) => tl.teacher);

    // Récupère la présence basée sur le calendrier
    const calendarPresentEmails =
      await calendarService.getPresentTeacherEmails(now);

    // Détermine la présence de chaque enseignant
    const presentTeachers: PresentTeacher[] = await Promise.all(
      teachers.map(async (teacher) => {
        const { isPresent, presenceSource } = await this.determinePresence(
          teacher,
          calendarPresentEmails,
          now,
        );

        return {
          id: teacher.id,
          name: teacher.name,
          email: teacher.email,
          isPresent,
          presenceSource,
        };
      }),
    );

    return presentTeachers;
  }

  async getOnlyPresentTeachers(
    locationId: string,
    now: Date = new Date(),
  ): Promise<Teacher[]> {
    // Récupère tous les enseignants associés à ce lieu (avec leurs données complètes)
    const teacherLocations =
      await prismaService.client.teacherLocation.findMany({
        where: { locationId },
        include: { teacher: true },
      });

    const teachers = teacherLocations.map((tl) => tl.teacher);

    // Récupère la présence basée sur le calendrier
    const calendarPresentEmails =
      await calendarService.getPresentTeacherEmails(now);

    // Filtre pour ne garder que les présents
    const presenceResults = await Promise.all(
      teachers.map(async (teacher) => {
        const { isPresent } = await this.determinePresence(
          teacher,
          calendarPresentEmails,
          now,
        );
        return { teacher, isPresent };
      }),
    );

    return presenceResults
      .filter((result) => result.isPresent)
      .map((result) => result.teacher);
  }

  private async determinePresence(
    teacher: Teacher,
    calendarPresentEmails: string[],
    now: Date,
  ): Promise<{
    isPresent: boolean;
    presenceSource: "calendar" | "manual" | "unavailable";
  }> {
    let isPresent = false;
    let presenceSource: "calendar" | "manual" | "unavailable" = "unavailable";

    // 1. Vérifie l'emploi du temps manuel (prioritaire)
    if (teacher.manualSchedule) {
      // On vérifie si c'est le nouveau format avec weekStart
      const scheduleData = teacher.manualSchedule as {
        weekStart?: string;
        data?: boolean[][];
      };

      let manualSchedule: boolean[][] | null = null;

      if (scheduleData.weekStart && Array.isArray(scheduleData.data)) {
        // Vérifie si c'est pour la semaine courante
        const weekStart = new Date(scheduleData.weekStart);
        const nowStartOfWeek = new Date(now);
        const day = nowStartOfWeek.getDay();
        const diff = nowStartOfWeek.getDate() - day + (day === 0 ? -6 : 1);
        nowStartOfWeek.setDate(diff);
        nowStartOfWeek.setHours(0, 0, 0, 0);

        // On compare les timestamps (en ignorant l'heure précise si besoin, mais setHours(0,0,0,0) aide)
        // On utilise toDateString() pour être sûr
        if (weekStart.toDateString() === nowStartOfWeek.toDateString()) {
          manualSchedule = scheduleData.data;
        }
      }

      if (manualSchedule) {
        const config = (await import("../config/devices.config")).DEVICE_CONFIGS
          .ledPanel.schedule;

        // Détermine le jour et le bloc actuel
        const dayOfWeek = now.getDay(); // 0 = Dimanche, 1 = Lundi...
        const currentHour = now.getHours();

        // On ne gère que Lundi (1) à Vendredi (5)
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          const dayIndex = dayOfWeek - 1; // 0 = Lundi

          // Trouve le bloc correspondant à l'heure actuelle
          const blockIndex = config.timeBlocks.findIndex(
            (block) => currentHour >= block.start && currentHour < block.end,
          );

          if (blockIndex !== -1) {
            // Vérifie si le tableau est valide
            if (
              Array.isArray(manualSchedule) &&
              manualSchedule.length > dayIndex &&
              manualSchedule[dayIndex].length > blockIndex
            ) {
              isPresent = manualSchedule[dayIndex][blockIndex];
              presenceSource = "manual";
              return { isPresent, presenceSource };
            }
          }
        }
      }
    }

    // 2. Repli sur le calendrier
    if (teacher.gmailEmail) {
      if (calendarPresentEmails.includes(teacher.gmailEmail)) {
        isPresent = true;
        presenceSource = "calendar";
      }
    }

    return { isPresent, presenceSource };
  }

  /**
   * Vérifie si un enseignant spécifique est présent dans un lieu
   */
  async isTeacherPresent(
    teacherId: string,
    locationId: string,
    now: Date = new Date(),
  ): Promise<boolean> {
    const presentTeachers = await this.getPresentTeachersInLocation(
      locationId,
      now,
    );
    const teacher = presentTeachers.find((pt) => pt.id === teacherId);
    return teacher ? teacher.isPresent : false;
  }
}

export default new PresenceService();
