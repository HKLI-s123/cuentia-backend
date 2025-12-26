import { IsString, IsNotEmpty, IsNumber, IsOptional, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateNotaCreditoDto {
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  id?: number;

  @IsString()
  @IsNotEmpty()
  uuid_nota: string; // UUID de la nota de crédito

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  fecha_emision: Date; // Fecha de emisión de la nota de crédito

  @IsString()
  @IsOptional()
  rfc_emisor?: string;

  @IsString()
  @IsOptional()
  nombre_emisor?: string;

  @IsString()
  @IsOptional()
  regimen_emisor?: string;

  @IsString()
  @IsOptional()
  rfc_receptor?: string;

  @IsString()
  @IsOptional()
  nombre_receptor?: string;

  @IsString()
  @IsOptional()
  regimen_receptor?: string;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  subtotal?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  iva_8?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  iva_16?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  total_trasladados?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  retencion_isr?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  retencion_iva?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  total_retenidos?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  descuento?: number;

  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty()
  total: number;

  @IsString()
  @IsOptional()
  forma_pago?: string;

  @IsString()
  @IsOptional()
  moneda?: string;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  tipo_cambio?: number;

  @IsString()
  @IsOptional()
  tipo_comprobante?: string; // normalmente 'E' (egreso)

  @IsString()
  @IsOptional()
  metodo_pago?: string;

  @IsString()
  @IsNotEmpty()
  rfc_relacionado: string; // RFC relacionado o del cliente/relación SAT

  @IsString()
  @IsOptional()
  uuid_factura_relacionada?: string; // UUID de la factura relacionada, si aplica
  
  @IsString()
  @IsOptional()
  estatus?: string; // Nuevo campo estatus
}
