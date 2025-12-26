// auth/decorators/roles.decorator.ts
import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";

// Tipos de rol alto nivel
export type AppRole =
  | "owner"
  | "employee-admin"
  | "employee-finanzas"
  | "employee-operaciones"
  | "employee-consulta";

export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
