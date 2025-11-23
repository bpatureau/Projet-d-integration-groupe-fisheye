import type { Teacher } from "../../prisma/generated/client.js";
import type { ManualStatus, PresentTeacher } from "../types";
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
    const presentTeachers: PresentTeacher[] = teachers.map((teacher) => {
      const { isPresent, presenceSource, manualStatus } =
        this.determinePresence(teacher, calendarPresentEmails, now);

      return {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        isPresent,
        presenceSource,
        manualStatus,
      };
    });

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
    return teachers.filter((teacher) => {
      const { isPresent } = this.determinePresence(
        teacher,
        calendarPresentEmails,
        now,
      );
      return isPresent;
    });
  }

  private determinePresence(
    teacher: Teacher,
    calendarPresentEmails: string[],
    now: Date,
  ): {
    isPresent: boolean;
    presenceSource: "calendar" | "manual" | "unavailable";
    manualStatus?: ManualStatus;
  } {
    let isPresent = false;
    let presenceSource: "calendar" | "manual" | "unavailable" = "unavailable";
    let manualStatus: ManualStatus | undefined;

    // Vérifie d'abord le statut manuel (prioritaire sur le calendrier)
    if (teacher.manualStatus) {
      const status = teacher.manualStatus as unknown as ManualStatus;
      if (status.until) {
        const until = new Date(status.until);
        if (until > now) {
          // Le statut manuel est encore valide
          isPresent = status.status === "present";
          presenceSource = "manual";
          manualStatus = status;
        }
      } else {
        // Pas d'expiration, toujours valide
        isPresent = status.status === "present";
        presenceSource = "manual";
        manualStatus = status;
      }
    }

    // Repli sur le calendrier si pas de statut manuel
    if (presenceSource === "unavailable" && teacher.gmailEmail) {
      if (calendarPresentEmails.includes(teacher.gmailEmail)) {
        isPresent = true;
        presenceSource = "calendar";
      }
    }

    return { isPresent, presenceSource, manualStatus };
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
