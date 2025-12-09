import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/error.middleware";
import messageService from "../services/message.service";

interface MessageFilters {
  isRead?: boolean;
  targetTeacherId?: string;
  targetLocationId?: string;
  visitId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export const createMessage = asyncHandler(
  async (req: Request, res: Response) => {
    const { text, senderInfo, visitId, targetTeacherId, targetLocationId } =
      req.body;

    const message = await messageService.create({
      text,
      senderInfo,
      visitId,
      targetTeacherId,
      targetLocationId,
    });

    res.status(201).json({ message });
  },
);

export const getAllMessages = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      page,
      limit,
      isRead,
      targetTeacherId,
      targetLocationId,
      visitId,
      startDate,
      endDate,
    } = req.query;

    const filters: MessageFilters = {};

    if (page && typeof page === "string") {
      filters.page = parseInt(page, 10);
    }
    if (limit && typeof limit === "string") {
      filters.limit = parseInt(limit, 10);
    }
    if (isRead !== undefined && typeof isRead === "string") {
      filters.isRead = isRead === "true";
    }
    if (targetTeacherId && typeof targetTeacherId === "string") {
      filters.targetTeacherId = targetTeacherId;
    }
    if (targetLocationId && typeof targetLocationId === "string") {
      filters.targetLocationId = targetLocationId;
    }
    if (visitId && typeof visitId === "string") {
      filters.visitId = visitId;
    }
    if (startDate && typeof startDate === "string") {
      filters.startDate = new Date(startDate);
    }
    if (endDate && typeof endDate === "string") {
      filters.endDate = new Date(endDate);
    }

    const result = await messageService.findAll(filters);
    res.json(result);
  },
);

export const getMessage = asyncHandler(async (req: Request, res: Response) => {
  const message = await messageService.findById(req.params.id);
  res.json({ message });
});

export const markMessageAsRead = asyncHandler(
  async (req: Request, res: Response) => {
    const message = await messageService.markAsRead(req.params.id);
    res.json({ message });
  },
);

export const deleteMessage = asyncHandler(
  async (req: Request, res: Response) => {
    await messageService.delete(req.params.id);
    res.status(204).send();
  },
);

export const getUnreadCount = asyncHandler(
  async (req: Request, res: Response) => {
    const { teacherId, locationId } = req.query;

    let count = 0;

    if (teacherId && typeof teacherId === "string") {
      count = await messageService.countUnreadForTeacher(teacherId);
    } else if (locationId && typeof locationId === "string") {
      count = await messageService.countUnreadForLocation(locationId);
    }

    res.json({ count });
  },
);

export const markAllAsRead = asyncHandler(
  async (req: Request, res: Response) => {
    const { teacherId, locationId } = req.body;

    let count = 0;

    if (teacherId) {
      count = await messageService.markAllAsReadForTeacher(teacherId);
    } else if (locationId) {
      count = await messageService.markAllAsReadForLocation(locationId);
    }

    res.json({ count });
  },
);
