// billing-info.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm";
import { BillingInvoice } from "./billing-invoice.entity";

@Entity("billing_info")
export class BillingInfo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number; // FK hacia tu tabla Users

  @Column({ nullable: true })
  rfc: string;

  @Column({ nullable: true })
  razonSocial: string;

  @Column({ nullable: true })
  usoCfdi: string;

  @Column({ nullable: true })
  telefono: string;

  @Column({ nullable: true })
  calle: string;

  @Column({ nullable: true })
  numero: string;

  @Column({ nullable: true })
  cp: string;

  @Column({ nullable: true })
  estado: string;

  @Column({ nullable: true })
  municipio: string;

  @Column({ nullable: true })
  pais: string;

  @Column({ nullable: true })
  regimenFiscal: string; // IMPORTANTE para emitir factura

  @Column({ nullable: true })
  metodoPago: string; // CREDITO, DEBITO, SPEI, PAYPAL, etc.

  @Column({ nullable: true })
  plan: string; // Free, Pro, Empresa

  @Column({ type: "date", nullable: true })
  renovacion: Date;

  @Column({ default: true })
  renovacionActiva: boolean;

  @Column({ type: "timestamp", nullable: true })
  fechaCancelacion: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}