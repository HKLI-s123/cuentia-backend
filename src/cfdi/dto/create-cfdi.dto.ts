import { IsString, IsNotEmpty, IsNumber, IsOptional, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCfdiDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  UUID: string;

  @IsString()
  @IsOptional()
  Version?: string;

  @IsString()
  @IsOptional()
  RFC_Emisor?: string;

  @IsString()
  @IsOptional()
  RazonSocialEmisor?: string;

  @IsString()
  @IsOptional()
  RFC_Receptor?: string;

  @IsString()
  @IsOptional()
  RazonSocialReceptor?: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  Fecha?: Date;

  @IsString()
  @IsOptional()
  TipoComprobante?: string;

  @IsString()
  @IsOptional()
  Serie?: string;

  @IsString()
  @IsOptional()
  Folio?: string;

  @IsString()
  @IsOptional()
  Status?: string;

  @IsString()
  @IsOptional()
  MetodoPago?: string;

  @IsString()
  @IsOptional()
  TipoPago?: string;

  @IsString()
  @IsOptional()
  RegimenFiscal?: string;

  @IsString()
  @IsOptional()
  LugarExpedicion?: string;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  Subtotal?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  Descuento?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  Total?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  TotalRetenidoIVA?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  TotalRetenidoIEPS?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  TotalRetenidoISR?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  TotalRetenidos?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  TotalTrasladadoIVA?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  TotalTrasladadoIEPS?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  TotalTrasladado?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  TotalTrasladadoIVADieciseis?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  TotalTrasladadoIVAExento?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  TotalTrasladadoIVACero?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  TotalTrasladadoIVAOcho?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  baseiva0?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  baseiva8?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  baseiva16?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  baseIvaExento?: number;

  @IsString()
  @IsOptional()
  UsoCFDI?: string;

  @IsString()
  @IsOptional()
  Moneda?: string;

  @IsString()
  @IsOptional()
  Movimiento?: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  FechaProcesada?: Date;

  @IsString()
  @IsOptional()
  RegimenFiscalReceptor?: string;

  @IsString()
  @IsOptional()
  rfc_cliente?: string;

  @IsString()
  @IsOptional()
  fuente?: string;

  @IsString()
  @IsOptional()
  rfc_relacionado?: string;

  @IsString()
  @IsOptional()
  categoria?: string;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  tipocambio?: number;
}
