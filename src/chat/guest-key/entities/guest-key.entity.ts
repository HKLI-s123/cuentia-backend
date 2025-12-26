// guest-key.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('guest_keys')
export class GuestKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: number;        // owner (multiusuario)

  @Column()
  keyHash: string;

  @Column()
  rfc: string;

  @Column({ default: 0 })
  attempts: number;

  @Column({ type: 'timestamp', nullable: true })
  blockedUntil: Date | null;

  @Column()
  shaPrefix: string; // ej. primeros 8 chars de sha256

  @Column({ default: true })
  isActive: boolean;
  
  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
