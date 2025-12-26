import { IsEmail, IsOptional, IsString, MinLength, IsIn } from "class-validator";

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsIn(["admin", "consulta"])
  role?: "admin" | "consulta";

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
