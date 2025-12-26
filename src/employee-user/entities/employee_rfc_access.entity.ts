import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from "typeorm";
import { EmployeeUser } from "../../employee-user/entities/employee-user.entity";
import { User } from "../../users/entities/user.entity";

@Entity("employee_rfc_access")
export class EmployeeRfcAccess {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  rfc: string; // RFC asignado al empleado

  // 👇 Dueño de la cuenta (empresa principal)
  @Column()
  ownerId: number;

  @Column()
  employeeId: number;

  @CreateDateColumn()
  createdAt: Date;
}
