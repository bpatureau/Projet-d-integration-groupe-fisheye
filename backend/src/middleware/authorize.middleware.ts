import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../types";

export function authorize(allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.teacher) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!allowedRoles.includes(req.teacher.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
}
