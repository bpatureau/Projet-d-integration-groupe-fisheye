import type { NextFunction, Request, Response } from "express";
import { AppError, isOperationalError, ValidationError } from "../utils/errors";
import logger from "../utils/logger";

/**
 * Middleware global de gestion des erreurs
 * Capture toutes les erreurs des routes et contrôleurs
 */
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  let statusCode = 500;
  let message = "Internal server error";
  let errors: any[] | undefined;
  let context: Record<string, any> | undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    context = err.context;

    if (err instanceof ValidationError) {
      errors = err.errors;
    }

    if (isOperationalError(err)) {
      logger.warn("Operational error", {
        component: "error_handler",
        statusCode,
        message,
        path: req.path,
        method: req.method,
        context,
      });
    } else {
      logger.error("Application error", {
        component: "error_handler",
        error: err,
        path: req.path,
        method: req.method,
      });
    }
  } else if (err.code && err.code.startsWith("P")) {
    statusCode = 400;
    message = "Database operation failed";

    if (err.code === "P2002") {
      statusCode = 409;
      message = "A record with this value already exists";
    } else if (err.code === "P2025") {
      statusCode = 404;
      message = "Record not found";
    }

    logger.error("Database error", {
      component: "error_handler",
      error: err,
      path: req.path,
      method: req.method,
    });
  } else if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid authentication token";

    logger.warn("JWT error", {
      component: "error_handler",
      message: err.message,
      path: req.path,
      method: req.method,
    });
  } else if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Authentication token expired";

    logger.warn("JWT expired", {
      component: "error_handler",
      path: req.path,
      method: req.method,
    });
  } else {
    logger.error("Unexpected error", {
      component: "error_handler",
      error: err,
      path: req.path,
      method: req.method,
      stack: err.stack,
    });
  }

  const response: any = {
    error: message,
  };

  if (errors) {
    response.errors = errors;
  }

  if (process.env.NODE_ENV === "development") {
    if (context) {
      response.context = context;
    }
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

/**
 * Gestionnaire 404 pour les routes inexistantes
 */
export function notFoundHandler(req: Request, res: Response) {
  logger.warn("Route not found", {
    component: "error_handler",
    path: req.path,
    method: req.method,
  });

  res.status(404).json({
    error: "Route not found",
    path: req.path,
  });
}

/**
 * Wrapper pour capturer les erreurs des gestionnaires de routes asynchrones
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
