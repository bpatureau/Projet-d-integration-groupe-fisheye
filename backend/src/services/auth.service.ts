import jwt from "jsonwebtoken";
import { Teacher } from "@prisma/client";
import prismaService from "../utils/prisma";
import { hashPassword, verifyPassword } from "../utils/password";
import config from "../config";
import { UnauthorizedError, NotFoundError } from "../utils/errors";
import logger from "../utils/logger";

class AuthService {
  /**
   * Authentifie un enseignant avec son nom d'utilisateur et mot de passe
   */
  async login(
    username: string,
    password: string
  ): Promise<{ teacher: Teacher; token: string }> {
    const teacher = await prismaService.client.teacher.findUnique({
      where: { username },
    });

    if (!teacher) {
      throw new UnauthorizedError("Invalid credentials");
    }

    const isPasswordValid = await verifyPassword(password, teacher.passwordHash);

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
    const options: any = {
      expiresIn: config.jwt.ttl,
    };
    return jwt.sign(payload, config.jwt.secret, options);
  }

  verifyToken(token: string): any {
    try {
      return jwt.verify(token, config.jwt.secret);
    } catch (error) {
      throw new UnauthorizedError("Invalid or expired token");
    }
  }

  async getTeacherFromToken(token: string): Promise<Teacher> {
    const decoded = this.verifyToken(token);
    const teacher = await prismaService.client.teacher.findUnique({
      where: { id: decoded.teacherId },
    });

    if (!teacher) {
      throw new NotFoundError("Teacher not found");
    }

    return teacher;
  }
}

export default new AuthService();
