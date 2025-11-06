import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/error.middleware";
import locationService from "../services/location.service";
import teacherService from "../services/teacher.service";

export const createTeacher = asyncHandler(
  async (req: Request, res: Response) => {
    const teacher = await teacherService.create(req.body);
    res.status(201).json({ teacher });
  },
);

export const getAllTeachers = asyncHandler(
  async (_req: Request, res: Response) => {
    const teachers = await teacherService.findAll();
    res.json({ teachers });
  },
);

export const getTeacher = asyncHandler(async (req: Request, res: Response) => {
  const teacher = await teacherService.findById(req.params.id);
  res.json({ teacher });
});

export const updateTeacher = asyncHandler(
  async (req: Request, res: Response) => {
    const teacher = await teacherService.update(req.params.id, req.body);
    res.json({ teacher });
  },
);

export const deleteTeacher = asyncHandler(
  async (req: Request, res: Response) => {
    await teacherService.delete(req.params.id);
    res.status(204).send();
  },
);

export const getTeacherLocations = asyncHandler(
  async (req: Request, res: Response) => {
    const locations = await teacherService.getLocations(req.params.id);
    res.json({ locations });
  },
);

export const addTeacherToLocation = asyncHandler(
  async (req: Request, res: Response) => {
    await locationService.addTeacher(req.params.locationId, req.params.id);
    res.status(201).json({ message: "Teacher added to location" });
  },
);

export const removeTeacherFromLocation = asyncHandler(
  async (req: Request, res: Response) => {
    await locationService.removeTeacher(req.params.locationId, req.params.id);
    res.status(204).send();
  },
);
