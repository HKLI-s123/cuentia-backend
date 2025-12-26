// dto/create-employee.dto.ts
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";
import type { EmployeeRole } from "../../employee-user/entities/employee-user.entity";

export class CreateEmployeeDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(3)
  nombre: string;

  @IsIn(["admin", "finanzas", "operaciones", "consulta"])
  role: EmployeeRole;

  @IsString()
  @MinLength(8)
  password: string;
}

