import fs from "node:fs";
import type { Schedule } from "@prisma/client";
import { type calendar_v3, google } from "googleapis";
import config from "../config";
import logger from "../utils/logger";
import prismaService from "../utils/prisma";

interface ScheduleData {
  calendarId: string;
  locationId: string;
  eventId: string;
  teacherEmail: string;
  summary: string;
  description: string | undefined;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  lastSync: Date;
}

class CalendarService {
  private calendar: calendar_v3.Calendar | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    try {
      if (!fs.existsSync(config.google.serviceAccountPath)) {
        logger.warn("Google Calendar credentials not found", {
          component: "calendar",
        });
        return;
      }

      const auth = new google.auth.GoogleAuth({
        keyFile: config.google.serviceAccountPath,
        scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
      });

      this.calendar = google.calendar({ version: "v3", auth });
      this.isInitialized = true;
      logger.info("Calendar service initialized", { component: "calendar" });
    } catch (error) {
      logger.error("Failed to initialize calendar service", {
        component: "calendar",
        error,
      });
    }
  }

  /**
   * Synchronise un calendrier Google pour un lieu (récupère et stocke les événements)
   */
  async syncCalendarForLocation(
    locationId: string,
    calendarId: string,
  ): Promise<void> {
    if (!this.isInitialized || !this.calendar) {
      throw new Error("Calendar service not initialized");
    }

    const now = new Date();
    const timeMin = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    try {
      const response = await this.calendar.events.list({
        calendarId,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
      });

      const events = response.data.items || [];
      logger.info(
        `Fetched ${events.length} events from calendar ${calendarId}`,
        { component: "calendar" },
      );

      for (const event of events) {
        const teacherEmail = this.extractTeacherEmail(event);
        if (!teacherEmail || !event.id) continue;

        const schedule: ScheduleData = {
          calendarId,
          locationId,
          eventId: event.id,
          teacherEmail,
          summary: event.summary || "No Title",
          description: event.description || "",
          startTime: new Date(
            event.start?.dateTime || event.start?.date || now,
          ),
          endTime: new Date(event.end?.dateTime || event.end?.date || now),
          allDay: !event.start?.dateTime,
          lastSync: new Date(),
        };

        await this.upsertSchedule(schedule);
      }

      logger.info(`Synced ${events.length} events for calendar ${calendarId}`, {
        component: "calendar",
      });
    } catch (error) {
      logger.error(`Failed to sync calendar ${calendarId}`, {
        component: "calendar",
        error,
      });
      throw error;
    }
  }

  private extractTeacherEmail(event: calendar_v3.Schema$Event): string | null {
    if (event.attendees && event.attendees.length > 0) {
      return event.attendees[0].email || null;
    }
    if (event.creator?.email) {
      return event.creator.email;
    }
    if (event.organizer?.email) {
      return event.organizer.email;
    }
    return null;
  }

  private async upsertSchedule(schedule: ScheduleData): Promise<void> {
    await prismaService.client.schedule.upsert({
      where: { eventId: schedule.eventId },
      update: {
        teacherEmail: schedule.teacherEmail,
        summary: schedule.summary,
        description: schedule.description,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        allDay: schedule.allDay,
        lastSync: schedule.lastSync,
      },
      create: {
        calendarId: schedule.calendarId,
        locationId: schedule.locationId,
        eventId: schedule.eventId,
        teacherEmail: schedule.teacherEmail,
        summary: schedule.summary,
        description: schedule.description,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        allDay: schedule.allDay,
        lastSync: schedule.lastSync,
      },
    });
  }

  /**
   * Récupère l'emploi du temps d'un enseignant sur une période donnée
   */
  async getTeacherSchedule(
    teacherEmail: string,
    startTime: Date,
    endTime: Date,
  ): Promise<Schedule[]> {
    return prismaService.client.schedule.findMany({
      where: {
        teacherEmail,
        startTime: { gte: startTime },
        endTime: { lte: endTime },
      },
      orderBy: { startTime: "asc" },
    });
  }

  /**
   * Récupère les emails des enseignants présents à un instant donné (basé sur le calendrier)
   */
  async getPresentTeacherEmails(now: Date): Promise<string[]> {
    const schedules = await prismaService.client.schedule.findMany({
      where: {
        startTime: { lte: now },
        endTime: { gt: now },
      },
      select: {
        teacherEmail: true,
      },
      distinct: ["teacherEmail"],
    });

    return schedules.map((s) => s.teacherEmail);
  }

  async getSchedulesForLocation(locationId: string): Promise<Schedule[]> {
    return prismaService.client.schedule.findMany({
      where: { locationId },
      orderBy: { startTime: "asc" },
    });
  }

  async getSchedulesForTeacher(teacherId: string): Promise<Schedule[]> {
    const teacher = await prismaService.client.teacher.findUnique({
      where: { id: teacherId },
    });

    if (!teacher || !teacher.gmailEmail) {
      return [];
    }

    return prismaService.client.schedule.findMany({
      where: { teacherEmail: teacher.gmailEmail },
      orderBy: { startTime: "asc" },
    });
  }
}

export default new CalendarService();
