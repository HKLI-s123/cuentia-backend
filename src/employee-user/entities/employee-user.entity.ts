// employee-user.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

export type EmployeeRole = "admin" | "finanzas" | "operaciones" | "consulta";

@Entity("employee_users")
export class EmployeeUser {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  ownerId: number;

  @Column({ unique: true })
  email: string;

  @Column()
  nombre: string;

  @Column({ type: "varchar", length: 20 })
  role: EmployeeRole;

  @Column()
  hashedPassword: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: "timestamptz", nullable: true })
  lastLoginAt?: Date;

  @Column({ type: "varchar", nullable: true })
  currentHashedRefreshToken: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({type: 'timestamp', nullable: true})
  deletedAt: Date;
}
