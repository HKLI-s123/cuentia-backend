import { Column, Entity, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity()
export class VerificationToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  token: string;

  @Column()
  userId: number;

  @ManyToOne(() => User, (user) => user.verificationTokens, {
    eager: true,
  })
  user: User;

  @Column({ default: false })
  used: boolean;

  @Column()
  expiresAt: Date;
}

