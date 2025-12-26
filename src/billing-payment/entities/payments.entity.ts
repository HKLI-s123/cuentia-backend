import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity('billing_payment_methods')
export class BillingPaymentMethod {
  
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number; // Relación 1:1 con usuario

  // 🔘 TRANSFERENCIA | TARJETA | PAYPAL | etc
  @Column({type: "varchar", nullable: true })
  metodoPago!: string | null;

  // ================================
  // 🔵 CAMPOS PARA STRIPE (FUTURO)
  // ================================
  @Column({type: "varchar", nullable: true })
  stripeCustomerId!: string | null;

  @Column({type: "varchar", nullable: true })
  stripePaymentMethodId!: string | null;

  @Column({type: "varchar", nullable: true })
  last4!: string | null;  // Ultimos 4 dígitos (que Stripe devuelve)

  @Column({type: "varchar", nullable: true })
  brand!: string | null;  // VISA / Mastercard

  @Column({type: "varchar", nullable: true })
  expMonth!: string | null;

  @Column({type: "varchar", nullable: true })
  expYear!: string | null;

  // ================================
  // 🟢 CAMPOS PARA TRANSFERENCIA SPEI
  // ================================
  @Column({type: "varchar", nullable: true })
  banco!: string | null;

  @Column({type: "varchar", nullable: true })
  clabe!: string | null;

  @Column({type: "varchar", nullable: true })
  referencia!: string | null;

  // ================================
  // 🕒 CONTROL DE CAMBIOS
  // ================================
  @CreateDateColumn()
  createdAt: Date;
  
  @UpdateDateColumn()
  updatedAt: Date;
}
