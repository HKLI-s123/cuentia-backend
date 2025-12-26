// auth/guards/roles.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY, AppRole } from "../decorators/roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

    // Si el endpoint no tiene @Roles → se permite el paso
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    console.log("🟦 RolesGuard → required:", requiredRoles);
    console.log("🟩 RolesGuard → request.user:", user);

    if (!user) return false;

    // type viene del JWT: "user" o "employee"
    const { type, role } = user;

    // Rol "owner" = cuenta principal (user)
    if (requiredRoles.includes("owner") || type === "user") {
      return true;
    }

    // Empleados
    if (type === "employee") {
      if (
        requiredRoles.includes("employee-admin") &&
        role === "admin"
      ) {
        return true;
      }

      if (
        requiredRoles.includes("employee-consulta") &&
        role === "consulta"
      ) {
        return true;
      }
    }

    return false;
  }
}
