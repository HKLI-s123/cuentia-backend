import { IsString, IsEmail, IsOptional, IsNumber, Min} from "class-validator";
import { Type } from "class-transformer";

export class CustomPlanDto {
  @IsString()
  empresa: string;

  @IsString()
  rfc: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @Type(() => Number)
  @IsNumber()
  rfcs: number;

  @Type(() => Number)
  @IsNumber()
  cfdisMensuales: number;

  @Type(() => Number)
  @IsNumber()
  usuarios: number;

  @IsOptional()
  @IsString()
  botGastos?: string;

  @IsOptional()
  @IsString()
  botComprobantes?: string;

  @IsOptional()
  @IsString()
  integraciones?: string;

  // 🧠 Límites diarios de IA (NUEVO)
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limiteAnalisisCfdiIA: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limiteChatbotIA: number;

  @IsOptional()
  @IsString()
  detalles?: string;
}
