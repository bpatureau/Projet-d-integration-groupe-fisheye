import jwt, { type JwtPayload } from "jsonwebtoken";
import type { StringValue } from "ms";
import type { Teacher } from "../../prisma/generated/client.js";
import config from "../config";
import { NotFoundError, UnauthorizedError } from "../utils/errors";
import logger from "../utils/logger";
import { verifyPassword } from "../utils/password";
import prismaService from "../utils/prisma";

class AuthService {
  /**
   * Authentifie un enseignant avec son nom d'utilisateur et mot de passe
   */
  async login(
    username: string,
    password: string,
  ): Promise<{ teacher: Teacher; token: string }> {
    const teacher = await prismaService.client.teacher.findUnique({
      where: { username },
    });

    if (!teacher) {
      throw new UnauthorizedError("Invalid credentials");
    }

    const isPasswordValid = await verifyPassword(
      password,
      teacher.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedError("Invalid credentials");
    }

    const token = this.generateToken(teacher);

    logger.info("Teacher logged in", { teacherId: teacher.id, username });

    return {
      teacher,
      token,
    };
  }

  generateToken(teacher: Teacher): string {
    const payload = {
      teacherId: teacher.id,
      username: teacher.username,
      email: teacher.email,
    };
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.ttl as StringValue,
    });
  }

  verifyToken(token: string): JwtPayload | string {
    try {
      return jwt.verify(token, config.jwt.secret);
    } catch (_error) {
      throw new UnauthorizedError("Invalid or expired token");
    }
  }

  async getTeacherFromToken(token: string): Promise<Teacher> {
    const decoded = this.verifyToken(token);

    if (typeof decoded === "string" || !("teacherId" in decoded)) {
      throw new UnauthorizedError("Invalid token payload");
    }

    const teacher = await prismaService.client.teacher.findUnique({
      where: { id: decoded.teacherId as string },
    });

    if (!teacher) {
      throw new NotFoundError("Teacher not found");
    }

    return teacher;
  }
}

export default new AuthService();
