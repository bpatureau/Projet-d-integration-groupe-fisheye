import type { NextFunction, Request, Response } from "express";
import { ZodError, type z } from "zod";
import { ValidationError } from "../utils/errors";

/**
 * Factory de middleware pour valider les données de requête avec Zod
 * @param schema Schéma Zod de validation
 * @param source Source des données ('body' | 'query' | 'params')
 */
export function validateRequest(
  schema: z.ZodSchema,
  source: "body" | "query" | "params" = "body",
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dataToValidate = req[source];
      const validatedData = await schema.parseAsync(dataToValidate);

      if (source === "query" || source === "params") {
        Object.keys(validatedData).forEach((key) => {
          (req[source] as any)[key] = (validatedData as any)[key];
        });
      } else {
        req[source] = validatedData;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
          code: err.code,
        }));

        next(new ValidationError("Validation failed", errors));
      } else {
        next(error);
      }
    }
  };
}

export function validateBody(schema: z.ZodSchema) {
  return validateRequest(schema, "body");
}

export function validateQuery(schema: z.ZodSchema) {
  return validateRequest(schema, "query");
}

export function validateParams(schema: z.ZodSchema) {
  return validateRequest(schema, "params");
}
