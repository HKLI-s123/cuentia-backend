import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('comprobantes_digitales')
export class ComprobanteDigital {
  @PrimaryGeneratedColumn()
  id: number;

  // Datos principales del comprobante digital
  @Column({ nullable: true })
  banco_emisor: string;

  @Column({ nullable: true })
  banco_receptor: string;

  @Column({ nullable: true })
  titular_emisor: string;

  @Column({ nullable: true })
  titular_receptor: string;

  @Column({ nullable: true })
  fecha_operacion: string;

  @Column({ nullable: true })
  monto: string;

  @Column({ nullable: true })
  clave_rastreo: string;

  @Column({ nullable: true })
  concepto_o_referencia: string;

  @Column({ nullable: true })
  folio_interno: string;

  @Column({ nullable: true })
  tipo_operacion: string;

  @Column({ nullable: true })
  moneda: string;

  // Datos del remitente
  @Column({ nullable: true })
  nombre_remitente: string;

  @Column({ nullable: true })
  telefono_remitente: string;

  // Usuario asociado
  @Column({ name: 'user_id', nullable: false })
  userId: string;

  @Column({
    name: 'tipo_movimiento',
    length: 20,
    nullable: true,
    default: 'ingreso',
  })
  tipo_movimiento?: 'ingreso' | 'egreso';

  @CreateDateColumn()
  createdAt: Date;
}
