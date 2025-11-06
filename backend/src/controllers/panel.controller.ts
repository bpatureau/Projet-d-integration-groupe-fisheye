import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/error.middleware";
import panelService from "../services/panel.service";

export const createPanel = asyncHandler(async (req: Request, res: Response) => {
  const panel = await panelService.create(req.body);
  res.status(201).json({ panel });
});

export const getAllPanels = asyncHandler(
  async (_req: Request, res: Response) => {
    const panels = await panelService.findAll();
    res.json({ panels });
  },
);

export const getPanel = asyncHandler(async (req: Request, res: Response) => {
  const panel = await panelService.findById(req.params.id);
  res.json({ panel });
});

export const updatePanel = asyncHandler(async (req: Request, res: Response) => {
  const panel = await panelService.update(req.params.id, req.body);
  res.json({ panel });
});

export const deletePanel = asyncHandler(async (req: Request, res: Response) => {
  await panelService.delete(req.params.id);
  res.status(204).send();
});
