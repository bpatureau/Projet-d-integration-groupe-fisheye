import type { NextFunction, Request, Response } from "express";
import { AppError, isOperationalError, ValidationError } from "../utils/errors";
import logger from "../utils/logger";

/**
 * Middleware global de gestion des erreurs
 * Capture toutes les erreurs des routes et contrôleurs
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  let statusCode = 500;
  let message = "Internal server error";
  let errors: unknown[] | undefined;
  let context: Record<string, unknown> | undefined;

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
  } else if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof err.code === "string" &&
    err.code.startsWith("P")
  ) {
    statusCode = 400;
    message = "Database operation failed";

    if ("code" in err && err.code === "P2002") {
      statusCode = 409;
      message = "A record with this value already exists";
    } else if ("code" in err && err.code === "P2025") {
      statusCode = 404;
      message = "Record not found";
    }

    logger.error("Database error", {
      component: "error_handler",
      error: err,
      path: req.path,
      method: req.method,
    });
  } else if (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    err.name === "JsonWebTokenError"
  ) {
    statusCode = 401;
    message = "Invalid authentication token";

    logger.warn("JWT error", {
      component: "error_handler",
      message:
        "message" in err && typeof err.message === "string"
          ? err.message
          : "Unknown error",
      path: req.path,
      method: req.method,
    });
  } else if (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    err.name === "TokenExpiredError"
  ) {
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
      stack:
        typeof err === "object" && err !== null && "stack" in err
          ? err.stack
          : undefined,
    });
  }

  const response: Record<string, unknown> = {
    error: message,
  };

  if (errors) {
    response.errors = errors;
  }

  if (process.env.NODE_ENV === "development") {
    if (context) {
      response.context = context;
    }
    if (typeof err === "object" && err !== null && "stack" in err) {
      response.stack = err.stack;
    }
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
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
