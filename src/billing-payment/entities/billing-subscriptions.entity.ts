import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity('billing_subscriptions')
export class BillingSubscription {

  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column({ type: 'varchar', nullable: true })
  stripeSubscriptionId: string | null;

  @Column({ type: 'varchar' })
  status: 'active' | 'trialing' | 'past_due' | 'canceled';

  @Column({ type: 'varchar', nullable: true })
  planProductId: string | null; // ej: cuentia_plan_profesional

  @Column({ type: 'varchar', nullable: true })
  planPriceId: string | null;

  @Column({ type: 'boolean', default: false })
  isCustomEnterprise: boolean;

  @Column({ type: 'timestamp', nullable: true })
  currentPeriodEnd: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  trialEndsAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  canceledAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastPaymentAt: Date | null;

  @Column({ type: "timestamp", nullable: true })
  discountAt: Date | null;

  @Column({ type: "varchar", nullable: true })
  retentionReason: string | null;

  @Column({ type: "text", nullable: true })
  retentionReasonExtra: string | null;
}
