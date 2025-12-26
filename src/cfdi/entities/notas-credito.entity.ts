import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("notas_credito_cfdi")
export class NotasCreditoCfdi {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "char", length: 36, unique: true })
  uuid_nota: string;

  @Column({ type: "char", length: 36, nullable: true })
  uuid_factura_relacionada?: string;

  @Column({ type: "timestamp", nullable: false })
  fecha_emision: Date;

  @Column({ length: 20, nullable: true })
  rfc_emisor?: string;

  @Column({ length: 255, nullable: true })
  nombre_emisor?: string;

  @Column({ length: 10, nullable: true })
  regimen_emisor?: string;

  @Column({ length: 20, nullable: true })
  rfc_receptor?: string;

  @Column({ length: 255, nullable: true })
  nombre_receptor?: string;

  @Column({ length: 10, nullable: true })
  regimen_receptor?: string;

  @Column({ type: "decimal", precision: 18, scale: 2, nullable: true })
  subtotal?: number;

  @Column({ type: "decimal", precision: 18, scale: 2, nullable: true })
  iva_8?: number;

  @Column({ type: "decimal", precision: 18, scale: 2, nullable: true })
  iva_16?: number;

  @Column({ type: "decimal", precision: 18, scale: 2, nullable: true })
  total_trasladados?: number;

  @Column({ type: "decimal", precision: 18, scale: 2, nullable: true })
  retencion_isr?: number;

  @Column({ type: "decimal", precision: 18, scale: 2, nullable: true })
  retencion_iva?: number;

  @Column({ type: "decimal", precision: 18, scale: 2, nullable: true })
  total_retenidos?: number;

  @Column({ type: "decimal", precision: 18, scale: 2, nullable: true })
  descuento?: number;

  @Column({ type: "decimal", precision: 18, scale: 2 })
  total: number;

  @Column({ length: 100, nullable: true })
  forma_pago?: string;

  @Column({ length: 10, nullable: true })
  moneda?: string;

  @Column({ type: "decimal", precision: 18, scale: 6, nullable: true })
  tipo_cambio?: number;

  @Column({ length: 1, nullable: true })
  tipo_comprobante?: string;

  @Column({ length: 10, nullable: true })
  metodo_pago?: string;

  @Column({ length: 100 })
  rfc_relacionado: string;

  @Column({ length: 20, default: 'Vigente' })
  estatus: string;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  updated_at: Date;
}
