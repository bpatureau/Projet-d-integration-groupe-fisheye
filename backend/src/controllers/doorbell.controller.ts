import { Request, Response } from "express";
import doorbellService from "../services/doorbell.service";
import { asyncHandler } from "../middleware/error.middleware";

export const createDoorbell = asyncHandler(async (req: Request, res: Response) => {
  const doorbell = await doorbellService.create(req.body);
  res.status(201).json({ doorbell });
});

export const getAllDoorbells = asyncHandler(async (req: Request, res: Response) => {
  const doorbells = await doorbellService.findAll();
  res.json({ doorbells });
});

export const getDoorbell = asyncHandler(async (req: Request, res: Response) => {
  const doorbell = await doorbellService.findById(req.params.id);
  res.json({ doorbell });
});

export const updateDoorbell = asyncHandler(async (req: Request, res: Response) => {
  const doorbell = await doorbellService.update(req.params.id, req.body);
  res.json({ doorbell });
});

export const deleteDoorbell = asyncHandler(async (req: Request, res: Response) => {
  await doorbellService.delete(req.params.id);
  res.status(204).send();
});
