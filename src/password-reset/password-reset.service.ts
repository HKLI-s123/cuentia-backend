import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PasswordResetToken } from "./entities/password-reset-token.entity";
import { User } from "../users/entities/user.entity";
import { MailService } from "../mail/mail.service";
import * as bcrypt from "bcrypt";
import { randomBytes, createHash } from "crypto";

@Injectable()
export class PasswordResetService {
  constructor(
    @InjectRepository(PasswordResetToken)
    private resetRepo: Repository<PasswordResetToken>,

    @InjectRepository(User)
    private usersRepo: Repository<User>,

    private mailService: MailService
  ) {}

  // -------------------------------------------------
  // 1️⃣ REQUEST PASSWORD RESET
  // -------------------------------------------------
  async requestPasswordReset(email: string) {
    const normalized = email.trim().toLowerCase();
    const genericResponse = {
      message: "Si la cuenta existe, enviamos instrucciones a tu correo."
    };

    const user = await this.usersRepo.findOne({ where: { email: normalized } });
    if (!user) return genericResponse; // Anti user enumeration

    if (user.provider === "google") {
      throw new BadRequestException("Tu cuenta usa inicio de sesión con Google. No requiere contraseña.");
    }

    const now = Date.now();
    const last = user.lastPasswordResetSent?.getTime() ?? 0;

    // 5 minutos
    if (now - last < 5 * 60 * 1000) {
      throw new BadRequestException("Intenta nuevamente en unos minutos.");
    }
    
    // Intentos diarios
    const today = new Date();
    const lastDate = user.lastPasswordResetSent
      ? new Date(user.lastPasswordResetSent)
      : null;
    
    const isSameDay =
      lastDate &&
      lastDate.getFullYear() === today.getFullYear() &&
      lastDate.getMonth() === today.getMonth() &&
      lastDate.getDate() === today.getDate();
    
    if (isSameDay && user.passwordResetAttempts >= 5) {
      throw new BadRequestException("Has solicitado demasiados enlaces hoy.");
    }

    // Actualizar contador
    if (!isSameDay) {
      user.passwordResetAttempts = 0;
    }
    
    user.passwordResetAttempts++;
    user.lastPasswordResetSent = new Date();
    await this.usersRepo.save(user);

    // Generar token seguro
    const rawToken = randomBytes(32).toString("hex");
    const hashed = createHash("sha256").update(rawToken).digest("hex");

    const expiresAt = new Date(Date.now() + 1000 * 60 * 15); // 15 minutos

    // Insertar token
    await this.resetRepo.insert({
      userId: user.id,
      token: hashed,
      expiresAt,
    });

    // Enviar correo
    await this.mailService.sendPasswordResetEmail(user.email, rawToken);

    return genericResponse;
  }

  // -------------------------------------------------
  // 2️⃣ RESET PASSWORD
  // -------------------------------------------------
  async resetPassword(rawToken: string, newPassword: string) {
    await new Promise(resolve => setTimeout(resolve, 300));

    const hashed = createHash("sha256").update(rawToken).digest("hex");

    const entry = await this.resetRepo.findOne({ where: { token: hashed } });

    if (!entry || entry.expiresAt < new Date()) {
      throw new BadRequestException("Token inválido o expirado");
    }

    const user = await this.usersRepo.findOne({ where: { id: entry.userId } });
    if (!user) throw new BadRequestException("Usuario no encontrado");

    // Actualizar contraseña
    const newHash = await bcrypt.hash(newPassword, 12);
    user.passwordHash = newHash;

    // Invalidar todas las sesiones activas
    user.currentHashedRefreshToken = null;

    await this.usersRepo.save(user);
    await this.resetRepo.delete(entry.id);

    return { message: "Contraseña actualizada correctamente" };
  }
}
