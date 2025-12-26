import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

@Entity("support_requests")
export class SupportRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column({ length: 150 })
  name: string;

  @Column({ length: 150 })
  email: string;

  @Column({ nullable: true, length: 200 })
  subject?: string;

  @Column({ nullable: true, length: 100 })
  category?: string;

  @Column({ type: "text" })
  message: string;

  @CreateDateColumn()
  createdAt: Date;
}
