import { Request, Response } from "express";
import visitService from "../services/visit.service";
import { asyncHandler } from "../middleware/error.middleware";

export const getAllVisits = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, ...otherFilters } = req.query;

  const filters = {
    ...otherFilters,
    ...(page && { page: parseInt(page as string, 10) }),
    ...(limit && { limit: parseInt(limit as string, 10) }),
  };

  const result = await visitService.findAll(filters as any);
  res.json(result);
});

export const getVisit = asyncHandler(async (req: Request, res: Response) => {
  const visit = await visitService.findById(req.params.id);
  res.json({ visit });
});

export const answerVisit = asyncHandler(async (req: Request, res: Response) => {
  const visit = await visitService.answer(req.params.id, req.body.answeredById);
  res.json({ visit });
});

export const deleteVisit = asyncHandler(async (req: Request, res: Response) => {
  await visitService.delete(req.params.id);
  res.status(204).send();
});

export const getVisitStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await visitService.getStats(req.query as any);
  res.json({ stats });
});
