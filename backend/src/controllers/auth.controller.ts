import { Request, Response } from "express";
import authService from "../services/auth.service";
import { asyncHandler } from "../middleware/error.middleware";
import logger from "../utils/logger";

/**
 * POST /api/auth/login
 * Connexion avec nom d'utilisateur et mot de passe
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { username, password } = req.body;

  const result = await authService.login(username, password);

  logger.info("Teacher logged in", { teacherId: result.teacher.id, username });

  res.json({
    token: result.token,
    teacher: {
      id: result.teacher.id,
      username: result.teacher.username,
      email: result.teacher.email,
      name: result.teacher.name,
    },
  });
});
