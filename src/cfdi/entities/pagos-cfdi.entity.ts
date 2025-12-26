import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Cfdi } from "./cfdi.entity";

@Entity("pagos_cfdi")
export class PagosCfdi {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "date" })
  fecha_emision: Date;

  @Column({ type: "char", length: 36 })
  uuid_complemento: string;

  @Column({ length: 20 })
  rfc_emisor: string;

  @Column({ length: 255, nullable: true })
  nombre_emisor?: string;

  @Column({ length: 10, nullable: true })
  regimen_emisor?: string;

  @Column({ length: 20 })
  rfc_receptor: string;

  @Column({ length: 255, nullable: true })
  nombre_receptor?: string;

  @Column({ length: 10, nullable: true })
  regimen_receptor?: string;

  @Column({ type: "date" })
  fecha_pago: Date;

  @Column({ length: 100, nullable: true })
  forma_pago?: string;

  @Column({ length: 10, nullable: true })
  moneda_pago?: string;

  @Column({ type: "decimal", precision: 18, scale: 6, nullable: true })
  tipo_cambio_pago?: number;

  @Column({ type: "decimal", precision: 18, scale: 2 })
  monto: number;

  @Column({ length: 100, nullable: true })
  no_operacion?: string;

  @Column({ length: 20, nullable: true })
  rfc_cta_ordenante?: string;

  @Column({ length: 255, nullable: true })
  banco_ordenante?: string;

  @Column({ length: 100, nullable: true })
  cta_ordenante?: string;

  @Column({ length: 20, nullable: true })
  rfc_cta_beneficiario?: string;

  @Column({ length: 100, nullable: true })
  cta_beneficiario?: string;

  @Column({ type: "char", length: 36, nullable: true })
  uuid_factura?: string;

  @Column({ length: 10, nullable: true })
  serie?: string;

  @Column({ length: 20, nullable: true })
  folio?: string;

  @Column({ length: 10, nullable: true })
  moneda_dr?: string;

  @Column({ type: "decimal", precision: 18, scale: 6, nullable: true })
  equivalencia_dr?: number;

  @Column({ type: "int", nullable: true })
  num_parcialidad?: number;

  @Column({ type: "decimal", precision: 18, scale: 2, nullable: true })
  imp_saldo_ant?: number;

  @Column({ type: "decimal", precision: 18, scale: 2, nullable: true })
  imp_pagado?: number;

  @Column({ type: "decimal", precision: 18, scale: 2, nullable: true })
  imp_saldo_insoluto?: number;

  @Column({ length: 10, nullable: true })
  objeto_imp_dr?: string;

  @Column({ length: 10, nullable: true })
  metodo_pago_dr?: string;

  @Column({ type: "date", nullable: true })
  fecha_factura?: Date;

  @Column({ length: 50, nullable: true })
  forma_pago_factura?: string;

  @Column({ length: 255, nullable: true })
  condiciones_pago?: string;

  @Column({ type: "decimal", precision: 18, scale: 2, nullable: true })
  subtotal?: number;

  @Column({ type: "decimal", precision: 18, scale: 2, nullable: true })
  descuento?: number;

  @Column({ length: 10, nullable: true })
  moneda?: string;

  @Column({ type: "decimal", precision: 18, scale: 6, nullable: true })
  tipo_cambio?: number;

  @Column({ type: "decimal", precision: 18, scale: 2, nullable: true })
  total?: number;

  @Column({ length: 1, nullable: true })
  tipo_comprobante?: string;

  @Column({ length: 10, nullable: true })
  metodo_pago?: string;

  @Column({ length: 10, nullable: true })
  exportacion?: string;

  @Column({ type: "decimal", precision: 18, scale: 2, nullable: true })
  total_imp_trasladados?: number;

  @Column({ type: "decimal", precision: 18, scale: 2, nullable: true })
  total_imp_retenidos?: number;

  @Column({ type: "decimal", precision: 18, scale: 2, nullable: true })
  base_16?: number;

  @Column({ type: "decimal", precision: 18, scale: 2, nullable: true })
  importe_trasladado_16?: number;

  @Column({ length: 10, nullable: true })
  tipo_factor_16?: string;

  @Column({ type: "decimal", precision: 10, scale: 6, nullable: true })
  tasa_cuota_16?: number;

  @Column({ length: 10, nullable: true })
  impuesto_retenido?: string;

  @Column({ type: "decimal", precision: 18, scale: 2, nullable: true })
  importe_retenido?: number;

  @Column({ type: "decimal", precision: 18, scale: 2, nullable: true })
  base_8?: number;

  @Column({ type: "decimal", precision: 18, scale: 2, nullable: true })
  importe_trasladado_8?: number;

  @Column({ length: 10, nullable: true })
  tipo_factor_8?: string;

  @Column({ type: "decimal", precision: 10, scale: 6, nullable: true })
  tasa_cuota_8?: number;

  @Column({ type: "decimal", precision: 18, scale: 2, nullable: true })
  base_exento?: number;

  @Column({ length: 10, nullable: true })
  impuesto_exento?: string;

  @Column({ length: 10, nullable: true })
  tipo_exento?: string;

  @Column({ length: 100, nullable: true })
  rfc_relacionado?: string;

  @Column({ length: 20, default: 'Vigente' })
  estatus: string;
}
