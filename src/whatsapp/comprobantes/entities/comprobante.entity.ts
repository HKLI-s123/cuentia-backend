import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('comprobantes')
export class Comprobante {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  remitente_nombre: string;

  @Column({ nullable: true })
  remitente_telefono: string;

  @Column({ nullable: true })
  Nombre_del_emisor_del_ticket: string;

  @Column({ nullable: true })
  rfc: string;

  @Column({ nullable: true })
  Fecha: string;

  @Column({ nullable: true })
  Numero_de_ticket: string;

  @Column({ nullable: true })
  Total: string;

  @Column({ nullable: true })
  Iva8: string;

  @Column({ nullable: true })
  Iva16: string;

  @Column({ name: 'user_id', nullable: false })
  userId: string;

  @CreateDateColumn()
  createdAt: Date;
}
