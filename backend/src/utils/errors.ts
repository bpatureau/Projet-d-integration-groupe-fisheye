/**
 * Classes d'erreurs personnalisées pour une gestion cohérente des erreurs
 * Chaque type d'erreur a un code HTTP spécifique et peut transporter un contexte additionnel
 */

/**
 * Classe de base pour les erreurs applicatives
 */
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true,
    public context?: Record<string, any>,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 Bad Request - Données invalides envoyées par le client
 */
export class BadRequestError extends AppError {
  constructor(message: string = "Bad request", context?: Record<string, any>) {
    super(message, 400, true, context);
  }
}

/**
 * 401 Unauthorized - Authentification requise ou échouée
 */
export class UnauthorizedError extends AppError {
  constructor(
    message: string = "Authentication required",
    context?: Record<string, any>,
  ) {
    super(message, 401, true, context);
  }
}

/**
 * 403 Forbidden - Permissions insuffisantes
 */
export class ForbiddenError extends AppError {
  constructor(
    message: string = "Insufficient permissions",
    context?: Record<string, any>,
  ) {
    super(message, 403, true, context);
  }
}

/**
 * 404 Not Found - Ressource inexistante
 */
export class NotFoundError extends AppError {
  constructor(
    message: string = "Resource not found",
    context?: Record<string, any>,
  ) {
    super(message, 404, true, context);
  }
}

/**
 * 409 Conflict - Ressource existe déjà ou conflit avec l'état actuel
 */
export class ConflictError extends AppError {
  constructor(
    message: string = "Resource conflict",
    context?: Record<string, any>,
  ) {
    super(message, 409, true, context);
  }
}

/**
 * 422 Unprocessable Entity - Échec de validation
 */
export class ValidationError extends AppError {
  constructor(
    message: string = "Validation failed",
    public errors?: any[],
    context?: Record<string, any>,
  ) {
    super(message, 422, true, context);
  }
}

/**
 * 429 Too Many Requests - Limite de taux dépassée
 */
export class RateLimitError extends AppError {
  constructor(
    message: string = "Too many requests",
    context?: Record<string, any>,
  ) {
    super(message, 429, true, context);
  }
}

/**
 * 500 Internal Server Error - Erreur serveur inattendue
 */
export class InternalServerError extends AppError {
  constructor(
    message: string = "Internal server error",
    context?: Record<string, any>,
  ) {
    super(message, 500, false, context);
  }
}

/**
 * 503 Service Unavailable - Service externe indisponible
 */
export class ServiceUnavailableError extends AppError {
  constructor(
    message: string = "Service unavailable",
    context?: Record<string, any>,
  ) {
    super(message, 503, true, context);
  }
}

/**
 * Vérifie si une erreur est opérationnelle (attendue)
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}
