import type { Response } from "express";
import { asyncHandler } from "../middleware/error.middleware";
import teacherService from "../services/teacher.service";
import type { AuthRequest } from "../types";

export const getProfile = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    res.json({ teacher: req.teacher });
  },
);

export const updateProfile = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    if (!req.teacher?.id) {
      throw new Error("Teacher ID is required");
    }
    const teacher = await teacherService.update(req.teacher.id, req.body);
    res.json({ teacher });
  },
);

export const updatePassword = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    if (!req.teacher?.id) {
      throw new Error("Teacher ID is required");
    }
    const { newPassword } = req.body;
    await teacherService.updatePassword(req.teacher.id, newPassword);
    res.json({ message: "Password updated successfully" });
  },
);

export const updatePreferences = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    if (!req.teacher?.id) {
      throw new Error("Teacher ID is required");
    }
    const teacher = await teacherService.updatePreferences(
      req.teacher.id,
      req.body,
    );
    res.json({ teacher });
  },
);
