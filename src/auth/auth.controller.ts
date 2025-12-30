import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  Get,
  BadRequestException,
  UnauthorizedException,
  Query, 
  Redirect,
  Patch,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RecaptchaService } from '../recaptcha/recaptcha.service';
import { PasswordResetService } from "../password-reset/password-reset.service";
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { Response } from 'express';
import { Res } from '@nestjs/common';
import { RateLimitGuard } from './guards/rate-limit.guard';
import type { AuthRequest } from 'src/common/interfaces/auth-request.interface';
import { VerifiedGuard } from './guards/verified.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from "../auth/decorators/roles.decorator";

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly recaptcha: RecaptchaService,
    private readonly resetService: PasswordResetService,
  ) {}

  // -------------------------
  // REGISTER
  // -------------------------
  @Post('register')
  @UseGuards(new RateLimitGuard(60, 60_000))
   async register(@Body() body: RegisterDto,
   @Res({ passthrough: true }) res: Response
  ) {

    const result = await this.authService.register(body);

     // ⛔ No enviar refreshToken al front
    const { refreshToken, accessToken, user } = result;
  
    // ⭐ Guardar refresh token en cookie HttpOnly segura
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: false, // true en producción (HTTPS)
      sameSite: 'lax',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 días
    });
  
    return {
      message: "Usuario creado y sesión iniciada",
      accessToken, // El front lo guardará solo en memoria
      user,
    };
  }

  // -------------------------
  // LOGIN
  // -------------------------
  @Post('login')
  @UseGuards(new RateLimitGuard(60, 60_000))
  async login(@Res({ passthrough: true }) res: Response, @Body() body: LoginDto) {
    if (!body.recaptchaToken)
      throw new BadRequestException('Falta token de reCAPTCHA');
  
    const ok = await this.recaptcha.verifyToken(body.recaptchaToken);
    if (!ok) throw new BadRequestException('reCAPTCHA inválido');
  
    return await this.authService.login(body.emailOrUser, body.password, res);
  }


  // -------------------------
  // REFRESH TOKEN
  // -------------------------
  @Post('refresh')
  async refresh(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) throw new UnauthorizedException();
  
    const data = await this.authService.refresh(refreshToken);

    const cookieOptions = {
      httpOnly: true,
      secure: false,
      sameSite: "strict" as const,
      path: "/",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 días
    };
   
    // si quieres rotar refresh:
     if (data.refreshToken) {
       res.cookie("refresh_token", data.refreshToken, cookieOptions);
     }
  
   return {
      accessToken: data.accessToken,
      user: data.user,
    };
  }
  
  @UseGuards(new RateLimitGuard(60, 60_000), JwtAuthGuard)
  @Post("logout")
  async logout(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response
  ) {
    const refreshToken = req.cookies?.refresh_token;
  
    // Limpia token almacenado en BD
    await this.authService.logoutFromRefreshToken(refreshToken);
  
    // Limpia la cookie del navegador
    res.clearCookie("refresh_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/", // ensure full deletion
    });
  
    return { message: "Sesión cerrada correctamente" };
  }


  @Get('verify')
  @UseGuards(new RateLimitGuard(60, 60_000))
  @Redirect()
   async verifyEmail(@Query('token') token: string) {
     if (!token) {
       return {
         url: `${process.env.FRONTEND_URL}/verificado?status=error&reason=missing_token`,
         statusCode: 302,
       };
     }
   
     try {
       await this.authService.verifyEmail(token);
   
       return {
         url: `${process.env.FRONTEND_URL}/verificado?status=success`,
         statusCode: 302,
       };
     } catch (error) {
       return {
         url: `${process.env.FRONTEND_URL}/verificado?status=error`,
         statusCode: 302,
       };
     }
  }

  // -------------------------
  // REQUEST PASSWORD RESET
  // -------------------------
  @Post("request-password-reset")
  @UseGuards(new RateLimitGuard(60, 60_000))
  async requestPasswordReset(
    @Body("email") email: string, 
    @Body("recaptchaToken") recaptchaToken: string,
  ) {

  if (!email || !recaptchaToken)
    throw new BadRequestException("Datos incompletos");

  const ok = await this.recaptcha.verifyToken(recaptchaToken);
  if (!ok) throw new UnauthorizedException("Captcha inválido");

    return await this.resetService.requestPasswordReset(email);
  }

  // -------------------------
  // RESET PASSWORD
  // -------------------------
  @Post("reset-password")
  @UseGuards(new RateLimitGuard(60, 60_000))
  async resetPassword(
    @Body("token") token: string,
    @Body("password") password: string,
  ) {
    if (!token || !password)
      throw new BadRequestException("Datos incompletos");

    return await this.resetService.resetPassword(token, password);
  }

  @UseGuards(JwtAuthGuard)
  @Post('resend-verification')
  async resendVerification(@Req() req: any) {
    const userEmail = req.user.email; // viene del JWT
  
    return await this.authService.resendVerification(userEmail);
  }
  
  @UseGuards(JwtAuthGuard)
  @Get("me")
  async me(@Req() req: AuthRequest) {
    const userId = req.user.sub;
    const type = req.user.type;
    return this.authService.getProfile(userId, type);
  }

  @UseGuards(JwtAuthGuard)
  @Get('session-info')
  getSessionInfo(@Req() req: AuthRequest) {
    const userId = req.user.sub;
    const type = req.user.type;
    return this.authService.getSessionInfo(userId, type);
  }

  @Patch('omit')
  @UseGuards(new RateLimitGuard(30, 60_000), JwtAuthGuard, VerifiedGuard)
  async omitOnboarding(@Req() req: AuthRequest) {
    const userId = req.user?.sub;
    return this.authService.omitOnboarding(userId);
  }

  @Post('google')
  @UseGuards(new RateLimitGuard(60, 60_000))
  async googleLogin(
    @Body('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    // 🔐 Aquí NO pedimos reCAPTCHA, Google ya valida el usuario
    return this.authService.googleLogin(token, res);
  }

  @Post("google/setup")
  @UseGuards(new RateLimitGuard(100, 60_000),JwtAuthGuard)
  async googleSetup(@Req() req: AuthRequest, @Body() body) {
    return this.authService.setGoogleAccountType(req.user.sub, body);
  }

    // auth/auth.controller.ts
  @Patch("update-profile")
  @UseGuards(new RateLimitGuard(60, 60_000),JwtAuthGuard, VerifiedGuard, RolesGuard)
  @Roles("owner")
  async updateProfile(
    @Req() req: AuthRequest,
    @Body() body: {
      nombre?: string;
      telefono?: string;
      email?: string;
      passwordConfirm: string;
    }
  ) {
    return this.authService.updateProfile(req.user.sub, body);
  }

  @Post("change-password")
  @UseGuards(new RateLimitGuard(60, 60_000), JwtAuthGuard, VerifiedGuard, RolesGuard)
  @Roles("owner")
  async changePassword(
    @Req() req: AuthRequest,
    @Body() body: { oldPassword: string; newPassword: string }
  ) {
    return this.authService.changePassword(req.user.sub, body);
  }


}
