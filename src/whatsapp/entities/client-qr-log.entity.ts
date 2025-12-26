// src/whatsapp/entities/client-qr-log.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('client_qr_log')
export class ClientQrLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  clientId: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @Column({ length: 50, default: 'default' })
  botType: string; // 👈 NUEVO CAMPO
}
