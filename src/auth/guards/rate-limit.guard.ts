import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

const memoryStore = new Map<string, { count: number; expires: number }>();

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private limit = 5,      // límite de intentos
    private ttl = 60_000,   // tiempo en milisegundos
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip || request.headers['x-forwarded-for'];

    const key = `rate-${ip}`;
    const now = Date.now();

    const entry = memoryStore.get(key);

    // Si no existe entrada o expiró, iniciar ventana nueva
    if (!entry || entry.expires < now) {
      memoryStore.set(key, { count: 1, expires: now + this.ttl });
      return true;
    }

    // Si excede el límite → lanzar 429 manual
    if (entry.count >= this.limit) {
      throw new HttpException(
        `Demasiadas solicitudes. Intenta de nuevo en ${Math.ceil((entry.expires - now) / 1000)} segundos.`,
        HttpStatus.TOO_MANY_REQUESTS, // 429
      );
    }

    // Incrementar contador
    entry.count++;
    memoryStore.set(key, entry);

    return true;
  }
}
