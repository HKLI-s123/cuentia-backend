// user.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany} from 'typeorm';
import { VerificationToken } from '../../verification-token/entities/verification-token.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 120, default: '' })
  nombre: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  telefono: string;
  
  @Column({ unique: true })
  email: string;

  @Column({ nullable: true, unique: true })
  username: string;

  @Column({default: '' })
  passwordHash: string;

  @Column({ type: 'varchar', nullable: true })
  empresa: string;

  @Column({ default: 'pending' }) // 'pending' | 'verified' | 'active'
  status: string;

  @Column({ default: false })
  verified: boolean;

  @Column({ type: 'varchar', nullable: true })
  currentHashedRefreshToken: string | null; // hashed refresh token for logout/rotation

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({type: 'timestamp', nullable: true})
  deletedAt: Date;

  @Column({
    type: 'enum',
    enum: ['invitado', 'individual', 'empresarial', 'admin', null],
    nullable: true
  })
  tipo_cuenta: 'invitado' | 'individual' | 'empresarial' | null;

  @OneToMany(() => VerificationToken, (vt) => vt.user)
  verificationTokens: VerificationToken[];

  @Column({ type: 'timestamp', nullable: true })
  lastVerificationSent: Date | null;
  
  @Column({ type: 'int', default: 0 })
  verificationAttempts: number;

  @Column({ type: 'int', default: 0 })
  loginAttempts: number;
  
  @Column({ type: 'timestamp', nullable: true })
  lastLoginAttempt: Date | null;
  
  @Column({ type: 'timestamp', nullable: true })
  lockedUntil: Date | null;

  @Column({ type: "timestamp", nullable: true })
  lastPasswordResetSent: Date | null;
  
  @Column({ type: "int", default: 0 })
  passwordResetAttempts: number;

  @Column({ type: 'varchar', length: 13, nullable: true })
  guestRfc: string | null;

  @Column({ type: 'varchar', length: 15, nullable: true })
  propioRfc: string | null;

  @Column({ type: 'boolean', default: false })
  omitOnboarding: boolean;

  @Column({ type: "varchar", nullable: true })
  googleId: string | null;
  
  @Column({ type: "varchar", nullable: true })
  avatarUrl: string | null;
  
  @Column({ type: "varchar", default: "local" })
  provider: string;   // 'local' | 'google'

  @Column({ type: 'boolean', default: false })
  accepted_terms: boolean;
  
  @Column({ type: 'timestamp', nullable: true })
  accepted_terms_at: Date | null;
}
