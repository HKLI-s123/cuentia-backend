import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from '../../users/users.service';

@Injectable()
export class VerifiedGuard implements CanActivate {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  // 1️⃣ Rutas que NO deben pasar por este guard
  private excludedPaths = [
    '/auth/login',
    '/auth/register',
    '/auth/verify',
    '/auth/reset-password',
    '/auth/request-password-reset',
    '/auth/logout',
    '/auth/resend-verification',
    '/auth/session-info',
    '/guest/validate',
    '/guest/activate',
  ];

  private isExcluded(url: string) {
    const clean = url.split('?')[0];
    return this.excludedPaths.some(p => clean === p || clean.startsWith(p));
  }


  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    
    const user = req.user.sub;

    const userType = req.user.type;  // 👈 Agregado

    console.log("usuario", user)

    const url = req.url;

    // 🚫 Si es empleado → omitir completamente el OnboardingGuard
    if (userType === "employee") {
      return true; 
    }

    // 2️⃣ Rutas excluidas → continuar sin validar onboarding
    if (this.isExcluded(url)) {
      return true;
    }

    if (!user) return true; // JwtGuard se encarga de autenticar

    const usuario = await this.usersService.findById(user);

    if (!usuario) {
      throw new ForbiddenException('USER_NOT_FOUND');
    }

    console.log(usuario.verified, usuario.email, usuario.nombre)

    // 3️⃣ Primero validar si está verificado
    if (!usuario.verified) {
      console.log("no verificado")
      throw new ForbiddenException('ACCOUNT_NOT_VERIFIED');
    }

    return true;
  }
}
