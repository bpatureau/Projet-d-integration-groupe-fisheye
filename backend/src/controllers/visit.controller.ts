import type { Request, Response } from "express";
import type { VisitStatus } from "../../prisma/generated/client.js";
import { asyncHandler } from "../middleware/error.middleware";
import visitService from "../services/visit.service";

interface VisitFilters {
  status?: VisitStatus;
  locationId?: string;
  teacherId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export const getAllVisits = asyncHandler(
  async (req: Request, res: Response) => {
    const { page, limit, status, locationId, teacherId, startDate, endDate } =
      req.query;

    const filters: VisitFilters = {};

    if (page && typeof page === "string") {
      filters.page = parseInt(page, 10);
    }
    if (limit && typeof limit === "string") {
      filters.limit = parseInt(limit, 10);
    }
    if (status && typeof status === "string") {
      filters.status = status as VisitStatus;
    }
    if (locationId && typeof locationId === "string") {
      filters.locationId = locationId;
    }
    if (teacherId && typeof teacherId === "string") {
      filters.teacherId = teacherId;
    }
    if (startDate && typeof startDate === "string") {
      filters.startDate = new Date(startDate);
    }
    if (endDate && typeof endDate === "string") {
      filters.endDate = new Date(endDate);
    }

    const result = await visitService.findAll(filters);
    res.json(result);
  },
);

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

export const getVisitStats = asyncHandler(
  async (req: Request, res: Response) => {
    const { locationId, teacherId, startDate, endDate } = req.query;

    const filters: {
      locationId?: string;
      teacherId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {};

    if (locationId && typeof locationId === "string") {
      filters.locationId = locationId;
    }
    if (teacherId && typeof teacherId === "string") {
      filters.teacherId = teacherId;
    }
    if (startDate && typeof startDate === "string") {
      filters.startDate = new Date(startDate);
    }
    if (endDate && typeof endDate === "string") {
      filters.endDate = new Date(endDate);
    }

    const stats = await visitService.getStats(filters);
    res.json({ stats });
  },
);
