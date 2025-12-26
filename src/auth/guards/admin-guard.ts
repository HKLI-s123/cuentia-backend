import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user) {
      throw new ForbiddenException("No estás autenticado");
    }

    console.log("admin guard",user.type);

    if (user.type !== "admin") {
      throw new ForbiddenException("No tienes permisos de administrador");
    }

    return true;
  }
}
