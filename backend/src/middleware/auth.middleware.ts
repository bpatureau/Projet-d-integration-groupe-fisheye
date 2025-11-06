import type { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import config from "../config";
import type { AuthRequest } from "../types";
import prismaService from "../utils/prisma";

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const decoded = jwt.verify(token, config.jwt.secret) as any;
    const teacher = await prismaService.client.teacher.findUnique({
      where: { id: decoded.teacherId },
    });

    if (!teacher) {
      return res.status(401).json({ error: "Teacher not found" });
    }

    req.teacher = teacher;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function extractToken(req: AuthRequest): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  if (req.query.token && typeof req.query.token === "string") {
    return req.query.token;
  }

  return null;
}
