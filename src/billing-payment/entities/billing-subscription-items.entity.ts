import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity('billing_subscription_items')
export class BillingSubscriptionItem {

  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  billingSubscriptionId: number;

  @Column({ type: 'varchar' })
  stripeItemId: string;

  @Column({ type: 'varchar' })
  productId: string; // cuentia_bot_gastos, cuentia_plan_empresarial

  @Column({ type: 'varchar' })
  priceId: string;

  @Column({ type: 'varchar' })
  itemType: 'plan' | 'bot' | 'addon';

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({
    type: 'varchar',
    nullable: true,
  })
  code!: string | null; 

  @CreateDateColumn()
  createdAt: Date;
}
