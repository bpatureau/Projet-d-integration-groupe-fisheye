import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/error.middleware";
import buzzerService from "../services/buzzer.service";

export const createBuzzer = asyncHandler(
  async (req: Request, res: Response) => {
    const buzzer = await buzzerService.create(req.body);
    res.status(201).json({ buzzer });
  },
);

export const getAllBuzzers = asyncHandler(
  async (req: Request, res: Response) => {
    const buzzers = await buzzerService.findAll();
    res.json({ buzzers });
  },
);

export const getBuzzer = asyncHandler(async (req: Request, res: Response) => {
  const buzzer = await buzzerService.findById(req.params.id);
  res.json({ buzzer });
});

export const updateBuzzer = asyncHandler(
  async (req: Request, res: Response) => {
    const buzzer = await buzzerService.update(req.params.id, req.body);
    res.json({ buzzer });
  },
);

export const deleteBuzzer = asyncHandler(
  async (req: Request, res: Response) => {
    await buzzerService.delete(req.params.id);
    res.status(204).send();
  },
);
