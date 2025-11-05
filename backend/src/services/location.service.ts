import { Location } from "@prisma/client";
import prismaService from "../utils/prisma";
import { NotFoundError, ConflictError } from "../utils/errors";
import logger from "../utils/logger";

class LocationService {
  async create(data: {
    name: string;
    description?: string;
    calendarId?: string;
    teamsWebhookUrl?: string;
  }): Promise<Location> {
    const location = await prismaService.client.location.create({
      data,
    });

    logger.info("Location created", { locationId: location.id });
    return location;
  }

  async findAll(): Promise<Location[]> {
    return prismaService.client.location.findMany({
      orderBy: { name: "asc" },
    });
  }

  async findById(id: string): Promise<Location> {
    const location = await prismaService.client.location.findUnique({
      where: { id },
    });

    if (!location) {
      throw new NotFoundError("Location not found");
    }

    return location;
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      calendarId?: string;
      teamsWebhookUrl?: string;
    }
  ): Promise<Location> {
    await this.findById(id);

    const location = await prismaService.client.location.update({
      where: { id },
      data,
    });

    logger.info("Location updated", { locationId: id });
    return location;
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);

    await prismaService.client.location.delete({
      where: { id },
    });

    logger.info("Location deleted", { locationId: id });
  }

  async getTeachers(locationId: string) {
    await this.findById(locationId);

    const teacherLocations = await prismaService.client.teacherLocation.findMany({
      where: { locationId },
      include: { teacher: true },
    });

    return teacherLocations.map((tl) => tl.teacher);
  }

  /**
   * Associe un enseignant à un lieu
   */
  async addTeacher(locationId: string, teacherId: string): Promise<void> {
    await this.findById(locationId);

    const existing = await prismaService.client.teacherLocation.findUnique({
      where: {
        teacherId_locationId: {
          teacherId,
          locationId,
        },
      },
    });

    if (existing) {
      throw new ConflictError("Teacher already associated with this location");
    }

    await prismaService.client.teacherLocation.create({
      data: {
        teacherId,
        locationId,
      },
    });

    logger.info("Teacher added to location", { teacherId, locationId });
  }

  /**
   * Dissocie un enseignant d'un lieu
   */
  async removeTeacher(locationId: string, teacherId: string): Promise<void> {
    const teacherLocation = await prismaService.client.teacherLocation.findUnique({
      where: {
        teacherId_locationId: {
          teacherId,
          locationId,
        },
      },
    });

    if (!teacherLocation) {
      throw new NotFoundError("Teacher not associated with this location");
    }

    await prismaService.client.teacherLocation.delete({
      where: {
        teacherId_locationId: {
          teacherId,
          locationId,
        },
      },
    });

    logger.info("Teacher removed from location", { teacherId, locationId });
  }
}

export default new LocationService();
