import { Response } from "express";
import { AuthRequest } from "../types";
import teacherService from "../services/teacher.service";
import { asyncHandler } from "../middleware/error.middleware";

export const getProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ teacher: req.teacher });
});

export const updateProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const teacher = await teacherService.update(req.teacher!.id, req.body);
  res.json({ teacher });
});

export const updatePassword = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  await teacherService.updatePassword(req.teacher!.id, newPassword);
  res.json({ message: "Password updated successfully" });
});

export const updatePreferences = asyncHandler(async (req: AuthRequest, res: Response) => {
  const teacher = await teacherService.updatePreferences(req.teacher!.id, req.body);
  res.json({ teacher });
});

export const setManualStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const teacher = await teacherService.setManualStatus(req.teacher!.id, req.body);
  res.json({ teacher });
});

export const clearManualStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const teacher = await teacherService.clearManualStatus(req.teacher!.id);
  res.json({ teacher });
});
