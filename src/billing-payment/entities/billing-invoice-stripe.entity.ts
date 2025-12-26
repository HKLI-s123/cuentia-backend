import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("billing_invoice_stripe")
export class BillingInvoiceStripe {

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", unique: true})
  invoiceId: string; // 👈 CLAVE ÚNICA REAL

  @Column({ type: "varchar", nullable: true })
  stripeSubscriptionId: string | null;

  @Column({ type: "int", nullable: true })
  amount: number | null;

  @Column({ type: "varchar", nullable: true })
  currency: string | null;

  @Column({ type: "timestamp", nullable: true })
  periodEnd: Date | null;

  @Column({
    type: "varchar",
    enum: ["paid", "failed"],
    nullable: true,
  })
  status: "paid" | "failed";

  @CreateDateColumn()
  createdAt: Date;
}

