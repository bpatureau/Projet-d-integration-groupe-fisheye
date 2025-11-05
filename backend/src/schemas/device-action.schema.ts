import { z } from "zod";

/**
 * Schémas de validation pour les payloads d'action des appareils
 *
 * Ces schémas valident les données provenant des appareils via MQTT ou HTTP.
 * L'utilisation de Zod fournit la sécurité des types et des messages d'erreur clairs.
 */

/**
 * Payload de sélection d'enseignant (depuis l'encodeur rotatif du panneau LED)
 * Envoyé lorsqu'un enseignant est sélectionné sur le panneau
 */
export const teacherSelectedPayloadSchema = z.object({
  teacherId: z.string().uuid("Teacher ID must be a valid UUID"),
});

export type TeacherSelectedPayload = z.infer<
  typeof teacherSelectedPayloadSchema
>;

/**
 * Payload de heartbeat (métadonnées optionnelles)
 * Les appareils peuvent envoyer des informations supplémentaires avec le heartbeat
 */
export const heartbeatPayloadSchema = z
  .object({
    batteryLevel: z.number().min(0).max(100).optional(),
    signalStrength: z.number().optional(),
    uptime: z.number().optional(),
  })
  .optional();

export type HeartbeatPayload = z.infer<typeof heartbeatPayloadSchema>;

/**
 * Fonction utilitaire pour parser de manière sécurisée les payloads MQTT
 *
 * @param schema - Schéma Zod à valider
 * @param payload - Buffer provenant du message MQTT
 * @returns Données parsées et validées, ou null si invalide
 */
export function parseMqttPayload<T>(
  schema: z.ZodSchema<T>,
  payload: Buffer
): T | null {
  try {
    const raw = payload.toString();

    // Gère les payloads vides
    if (!raw || raw.trim() === "") {
      return schema.parse({});
    }

    // Parse le JSON
    const data = JSON.parse(raw);

    // Valide avec le schéma
    return schema.parse(data);
  } catch (error) {
    return null;
  }
}
