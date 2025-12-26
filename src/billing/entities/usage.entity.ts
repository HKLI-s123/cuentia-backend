import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('usage')
@Index(['userId', 'feature', 'period'], { unique: true })
export class Usage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  feature: 'cfdi_ai' | 'bot_message';

  // formato YYYY-MM
  @Column()
  period: string;

  @Column({ default: 0 })
  count: number;

  @CreateDateColumn()
  createdAt: Date;
}
