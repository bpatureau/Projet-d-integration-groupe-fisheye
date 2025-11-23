import { Prisma, type Teacher } from "../../prisma/generated/client.js";
import type { ManualStatus, TeacherPreferences } from "../types";
import { ConflictError, NotFoundError } from "../utils/errors";
import logger from "../utils/logger";
import { hashPassword } from "../utils/password";
import prismaService from "../utils/prisma";
import deviceActionService from "./device-action.service";

class TeacherService {
  async create(data: {
    username: string;
    email: string;
    password: string;
    name: string;
    gmailEmail?: string;
    teamsEmail?: string;
    preferences?: TeacherPreferences;
  }): Promise<Teacher> {
    // Vérifie que le nom d'utilisateur ou l'email n'existe pas déjà
    const existing = await prismaService.client.teacher.findFirst({
      where: {
        OR: [{ username: data.username }, { email: data.email }],
      },
    });

    if (existing) {
      throw new ConflictError("Username or email already exists");
    }

    const passwordHash = await hashPassword(data.password);

    const teacher = await prismaService.client.teacher.create({
      data: {
        username: data.username,
        email: data.email,
        passwordHash,
        name: data.name,
        gmailEmail: data.gmailEmail,
        teamsEmail: data.teamsEmail,
        preferences: (data.preferences ||
          ({
            notifyOnTeams: true,
            buzzerEnabled: true,
          } as TeacherPreferences)) as unknown as Prisma.InputJsonValue,
      },
    });

    logger.info("Teacher created", { teacherId: teacher.id });
    return teacher;
  }

  async findAll(): Promise<Teacher[]> {
    return prismaService.client.teacher.findMany({
      orderBy: { name: "asc" },
    });
  }

  async findById(id: string): Promise<Teacher> {
    const teacher = await prismaService.client.teacher.findUnique({
      where: { id },
    });

    if (!teacher) {
      throw new NotFoundError("Teacher not found");
    }

    return teacher;
  }

  async findByEmail(email: string): Promise<Teacher | null> {
    return prismaService.client.teacher.findUnique({
      where: { email },
    });
  }

  async findByGmailEmail(gmailEmail: string): Promise<Teacher | null> {
    return prismaService.client.teacher.findFirst({
      where: { gmailEmail },
    });
  }

  async update(
    id: string,
    data: {
      username?: string;
      email?: string;
      name?: string;
      gmailEmail?: string;
      teamsEmail?: string;
      preferences?: TeacherPreferences;
    },
  ): Promise<Teacher> {
    await this.findById(id);

    const updateData: {
      username?: string;
      email?: string;
      name?: string;
      gmailEmail?: string;
      teamsEmail?: string;
      preferences?: Prisma.InputJsonValue;
    } = {
      username: data.username,
      email: data.email,
      name: data.name,
      gmailEmail: data.gmailEmail,
      teamsEmail: data.teamsEmail,
    };
    if (data.preferences) {
      updateData.preferences =
        data.preferences as unknown as Prisma.InputJsonValue;
    }

    const teacher = await prismaService.client.teacher.update({
      where: { id },
      data: updateData,
    });

    logger.info("Teacher updated", { teacherId: id });
    return teacher;
  }

  async updatePassword(id: string, newPassword: string): Promise<void> {
    await this.findById(id);

    const passwordHash = await hashPassword(newPassword);

    await prismaService.client.teacher.update({
      where: { id },
      data: { passwordHash },
    });

    logger.info("Teacher password updated", { teacherId: id });
  }

  async updatePreferences(
    id: string,
    preferences: Partial<TeacherPreferences>,
  ): Promise<Teacher> {
    const teacher = await this.findById(id);

    const currentPrefs =
      (teacher.preferences as unknown as TeacherPreferences) || {
        notifyOnTeams: true,
        buzzerEnabled: true,
      };

    const updatedPrefs = {
      ...currentPrefs,
      ...preferences,
    };

    const updated = await prismaService.client.teacher.update({
      where: { id },
      data: { preferences: updatedPrefs as Prisma.InputJsonValue },
    });

    logger.info("Teacher preferences updated", { teacherId: id });
    return updated;
  }

  /**
   * Définit un statut de présence manuel pour un enseignant
   */
  async setManualStatus(id: string, status: ManualStatus): Promise<Teacher> {
    await this.findById(id);

    const teacher = await prismaService.client.teacher.update({
      where: { id },
      data: { manualStatus: status as unknown as Prisma.InputJsonValue },
    });

    logger.info("Teacher manual status set", {
      teacherId: id,
      status: status.status,
    });

    // Récupère les lieux associés à l'enseignant
    const locations = await this.getLocations(id);

    // Rafraîchit les appareils de chaque lieu
    for (const location of locations) {
      await deviceActionService
        .refreshLocationDevices(location.id)
        .catch((error) => {
          logger.error(
            "Failed to refresh location devices after status change",
            {
              locationId: location.id,
              error,
            },
          );
        });
    }

    return teacher;
  }

  /**
   * Supprime le statut de présence manuel d'un enseignant
   */
  async clearManualStatus(id: string): Promise<Teacher> {
    await this.findById(id);

    const teacher = await prismaService.client.teacher.update({
      where: { id },
      data: { manualStatus: Prisma.DbNull },
    });

    logger.info("Teacher manual status cleared", { teacherId: id });

    // Récupère les lieux associés à l'enseignant
    const locations = await this.getLocations(id);

    // Rafraîchit les appareils de chaque lieu
    for (const location of locations) {
      await deviceActionService
        .refreshLocationDevices(location.id)
        .catch((error) => {
          logger.error(
            "Failed to refresh location devices after status clear",
            {
              locationId: location.id,
              error,
            },
          );
        });
    }

    return teacher;
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);

    await prismaService.client.teacher.delete({
      where: { id },
    });

    logger.info("Teacher deleted", { teacherId: id });
  }

  /**
   * Récupère tous les lieux associés à un enseignant
   */
  async getLocations(teacherId: string) {
    await this.findById(teacherId);

    const teacherLocations =
      await prismaService.client.teacherLocation.findMany({
        where: { teacherId },
        include: { location: true },
      });

    return teacherLocations.map((tl) => tl.location);
  }
}

export default new TeacherService();
