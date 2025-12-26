import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn
} from "typeorm";

@Entity("billing_invoice")
export class BillingInvoice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({nullable: true})
  uuid: string;

  @Column({nullable: true})
  folio: string;

  @Column({nullable: true})
  total: number;

  @Column({nullable: true})
  fecha: Date;

  // 🔥 Nuevo: la factura se asocia directamente al usuario
  @Column({nullable: true})
  userId: number;

  @CreateDateColumn({nullable: true})
  createdAt: Date;
}
