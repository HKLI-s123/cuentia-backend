import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('bot_clients')
export class BotClient {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'UserId', type: 'varchar', unique: true, nullable: true })
  UserId: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  telefono: string;

  @Column({ type: 'varchar', nullable: true })
  tipo: string; // 'individual' | 'multi'

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
