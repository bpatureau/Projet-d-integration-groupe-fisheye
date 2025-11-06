import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/error.middleware";
import deviceActionService from "../services/device-action.service";

export const buttonPressed = asyncHandler(
  async (req: Request, res: Response) => {
    const { deviceId } = req.params;
    const { targetTeacherId } = req.body;
    const visit =
      await deviceActionService.handleDoorbellButtonPressedByDeviceId(
        deviceId,
        targetTeacherId,
      );
    res.json({ visit });
  },
);

export const doorOpened = asyncHandler(async (req: Request, res: Response) => {
  const { deviceId } = req.params;
  const visit = await deviceActionService.handleDoorOpenedByDeviceId(deviceId);
  res.json({ visit: visit || null });
});

export const teacherSelected = asyncHandler(
  async (req: Request, res: Response) => {
    const { deviceId } = req.params;
    const { teacherId } = req.body;
    await deviceActionService.handleTeacherSelectedByDeviceId(
      deviceId,
      teacherId,
    );
    res.json({ message: "Teacher selected" });
  },
);

export const heartbeat = asyncHandler(async (req: Request, res: Response) => {
  const { type, deviceId } = req.params;
  const deviceType = type as "doorbell" | "buzzer" | "panel";
  await deviceActionService.handleHeartbeat(deviceType, deviceId);
  res.json({ message: "Heartbeat received" });
});
