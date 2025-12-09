import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/error.middleware";
import scheduleService from "../services/schedule.service";

export const syncSchedule = asyncHandler(
  async (req: Request, res: Response) => {
    const count = await scheduleService.syncSchedulesForLocation(
      req.params.locationId,
    );
    res.json({ message: "Schedules synced", count });
  },
);

export const getSchedulesForLocation = asyncHandler(
  async (req: Request, res: Response) => {
    const schedules = await scheduleService.getSchedulesForLocation(
      req.params.locationId,
    );
    res.json({ schedules });
  },
);

export const getSchedulesForTeacher = asyncHandler(
  async (req: Request, res: Response) => {
    const schedules = await scheduleService.getSchedulesForTeacher(
      req.params.teacherId,
    );
    res.json({ schedules });
  },
);
