import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('clients_sessions')
export class ClientSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  clientId: string;

  @Column({ default: 'disconnected' })
  status: string; // 'active' | 'disconnected'

  @Column({ length: 50, default: 'default' })
  botType: string; // 👈 AGREGA ESTE CAMPO

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  whatsappNumber: string;
  
  @Column({ nullable: true })
  pushName: string;
  
  @Column({ nullable: true })
  platform: string;
}
