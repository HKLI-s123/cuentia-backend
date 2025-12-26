import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class RecaptchaService {
  private readonly secret: string;

  constructor(private readonly configService: ConfigService) {
  this.secret = this.configService.get<string>('RECAPTCHA_SECRET') as string;

    if (!this.secret) {
      console.warn('⚠️ RECAPTCHA_SECRET no está definido. CAPTCHA deshabilitado.');
    }
  }

  async verifyToken(token: string): Promise<boolean> {
    if (!this.secret) {
      // ⚠️ Solo fallback para desarrollo
      return true;
    }

    if (!token) {
      console.log("❌ No se envió token de captcha");
      return false;
    }

    try {
      const res = await axios.post(
        `https://www.google.com/recaptcha/api/siteverify?secret=${this.secret}&response=${token}`
      );

      console.log("🔍 RESPUESTA CAPTCHA:", res.data);

      // reCAPTCHA v3 → score debe ser aceptable
      if (!res.data.success) return false;

      if (res.data.score !== undefined) {
        return res.data.score >= 0.5;
      }

      return true;
    } catch (error) {
      console.log("❌ Error verificando captcha:", error);
      return false;
    }
  }
}
