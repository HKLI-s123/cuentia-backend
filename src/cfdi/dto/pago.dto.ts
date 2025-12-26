import { IsString, IsNotEmpty, IsNumber, IsOptional, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePagoDto {
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  id?: number;

  @IsString()
  @IsNotEmpty()
  uuid_complemento: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  fecha_emision?: Date;

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

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  fecha_pago?: Date;

  @IsString()
  @IsOptional()
  forma_pago?: string;

  @IsString()
  @IsOptional()
  moneda_pago?: string;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  tipo_cambio_pago?: number;

  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty()
  monto: number;

  @IsString()
  @IsOptional()
  rfc_cta_ordenante?: string;

  @IsString()
  @IsOptional()
  banco_ordenante?: string;

  @IsString()
  @IsOptional()
  cta_ordenante?: string;

  @IsString()
  @IsOptional()
  rfc_cta_beneficiario?: string;

  @IsString()
  @IsOptional()
  cta_beneficiario?: string;

  @IsString()
  @IsOptional()
  uuid_factura?: string;

  @IsString()
  @IsOptional()
  serie?: string;

  @IsString()
  @IsOptional()
  folio?: string;

  @IsString()
  @IsOptional()
  moneda_dr?: string;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  equivalencia_dr?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  num_parcialidad?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  imp_saldo_ant?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  imp_pagado?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  imp_saldo_insoluto?: number;

  @IsString()
  @IsOptional()
  objeto_imp_dr?: string;

  @IsString()
  @IsOptional()
  metodo_pago_dr?: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  fecha_factura?: Date;

  @IsString()
  @IsOptional()
  forma_pago_factura?: string;

  @IsString()
  @IsOptional()
  condiciones_pago?: string;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  subtotal?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  descuento?: number;

  @IsString()
  @IsOptional()
  moneda?: string;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  tipo_cambio?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  total?: number;

  @IsString()
  @IsOptional()
  tipo_comprobante?: string;

  @IsString()
  @IsOptional()
  exportacion?: string;

  @IsString()
  @IsOptional()
  metodo_pago?: string;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  total_imp_trasladados?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  total_imp_retenidos?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  base_16?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  importe_trasladado_16?: number;

  @IsString()
  @IsOptional()
  tipo_factor_16?: string;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  tasa_cuota_16?: number;

  @IsString()
  @IsOptional()
  impuesto_retenido?: string;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  importe_retenido?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  base_8?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  importe_trasladado_8?: number;

  @IsString()
  @IsOptional()
  tipo_factor_8?: string;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  tasa_cuota_8?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  base_exento?: number;

  @IsString()
  @IsOptional()
  impuesto_exento?: string;

  @IsString()
  @IsOptional()
  tipo_exento?: string;

  @IsString()
  @IsNotEmpty()
  rfc_relacionado: string;
}
