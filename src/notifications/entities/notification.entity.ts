import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn
} from "typeorm";

@Entity("notifications")
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  // 🔵 Tipo de notificación
  @Column({
    type: "varchar",
    length: 30,
  })
  type: string; // "EMAIL" | "INTERNAL" | "BOT" | "SMS" | "PUSH"

  // 🟣 Título corto
  @Column({ type: "varchar", length: 200 })
  title: string;

  // 🟡 Contenido / mensaje como texto largo
  @Column({ type: "text" })
  content: string;

  // 🔥 Nuevo: la factura se asocia directamente al usuario
  @Column()
  userId: number;

  // 📅 Fecha en que se creó la notificación
  @CreateDateColumn()
  createdAt: Date;

  // 📅 Última actualización
  @UpdateDateColumn()
  updatedAt: Date;
}
