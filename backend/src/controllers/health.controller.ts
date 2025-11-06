/**
 * Contrôleur de vérification de santé de l'application
 */

import type { Request, Response } from "express";
import { version } from "../../package.json";
import prisma from "../utils/prisma";

/**
 * Vérifie l'état de santé de l'application
 * Retourne 200 si sain, 503 si en erreur
 */
export async function checkHealth(req: Request, res: Response) {
  const health = {
    status: "ok",
    version,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };

  // Vérifie la connexion à la base de données
  try {
    await prisma.ping();
  } catch (error: any) {
    res.status(503).json({
      ...health,
      status: "error",
      db: "disconnected",
      error: error.message,
    });
    return;
  }

  res.status(200).json(health);
}
