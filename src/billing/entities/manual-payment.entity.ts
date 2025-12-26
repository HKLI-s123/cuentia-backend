import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("manual_payments")
export class ManualPayment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  // 🔑 Qué se paga
  @Column()
  code: string; // cuentia_plan_individual | cuentia_bot_gastos

  @Column()
  kind: 'plan' | 'bot';

  // 🔑 Cómo se aplicará
  @Column()
  role: 'plan' | 'addon';

  // 📆 Periodo
  @Column({ type: 'date', nullable: true })
  periodStart: Date;

  @Column({ type: 'date', nullable: true })
  periodEnd: Date;

  // 🧾 Referencia
  @Column({ nullable: true })
  reference: string;

  // 📌 Estado
  @Column({ default: 'pending' })
  status: 'pending' | 'approved' | 'rejected';

  // 👤 Auditoría
  @Column({ nullable: true })
  approvedBy: number;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  approvedAt: Date;

  // 📝 Observaciones
  @Column({ type: 'text', nullable: true })
  notes: string;
}

