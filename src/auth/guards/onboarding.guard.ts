import {
  CanActivate,
  ExecutionContext,
  Injectable,
  PreconditionFailedException,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { ClientesService } from '../../clientes/clientes.service';

@Injectable()
export class OnboardingGuard implements CanActivate {
  constructor(
    private readonly usersService: UsersService,
    private readonly clientesService: ClientesService,
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

    // 🟩 Invitado no pasa por onboarding
    if (usuario?.tipo_cuenta === 'invitado') {
      return true;
    }

    // 🟦 Empresa / Individual → buscar si YA tiene cliente propio
    const clientePropio = await this.clientesService.findByUserOwnerId(
      usuario?.id,
    );

    console.log("cliente propio",clientePropio);

    // Si no existe el cliente → todavía no ha configurado nada
    if (!clientePropio) {
      if (usuario?.tipo_cuenta === 'individual') {
        throw new PreconditionFailedException('ONBOARDING_REQUIRED');
      }

      // Empresa puede omitir
      req.onboardingRequired = true;
      return true;
    }

    // Validar archivos obligatorios
    const missingFiles =
      !clientePropio.key_path ||
      !clientePropio.cer_path ||
      !clientePropio.fiel;

    if (missingFiles) {
      if (usuario?.tipo_cuenta === 'individual') {
        throw new PreconditionFailedException('ONBOARDING_REQUIRED');
      }

      // Empresa → permitir pero notificar
      req.onboardingRequired = true;
      return true;
    }

    return true;
  }
}
