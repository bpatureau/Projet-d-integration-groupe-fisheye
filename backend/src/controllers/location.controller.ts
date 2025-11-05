import { Request, Response } from "express";
import locationService from "../services/location.service";
import { asyncHandler } from "../middleware/error.middleware";

export const createLocation = asyncHandler(async (req: Request, res: Response) => {
  const location = await locationService.create(req.body);
  res.status(201).json({ location });
});

export const getAllLocations = asyncHandler(async (req: Request, res: Response) => {
  const locations = await locationService.findAll();
  res.json({ locations });
});

export const getLocation = asyncHandler(async (req: Request, res: Response) => {
  const location = await locationService.findById(req.params.id);
  res.json({ location });
});

export const updateLocation = asyncHandler(async (req: Request, res: Response) => {
  const location = await locationService.update(req.params.id, req.body);
  res.json({ location });
});

export const deleteLocation = asyncHandler(async (req: Request, res: Response) => {
  await locationService.delete(req.params.id);
  res.status(204).send();
});

export const getLocationTeachers = asyncHandler(async (req: Request, res: Response) => {
  const teachers = await locationService.getTeachers(req.params.id);
  res.json({ teachers });
});
