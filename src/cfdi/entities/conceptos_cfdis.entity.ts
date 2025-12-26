import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('conceptos_cfdis')
export class ConceptosCfdi {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50 })
  claveproductoservicio: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  cantidad: number;

  @Column({ type: 'varchar', length: 20 })
  claveunidad: string;

  @Column({ type: 'varchar', length: 50 })
  unidad: string;

  @Column({ type: 'varchar', length: 255 })
  descripcion: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  valorunitario: number;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  importe: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  descuento: number;

  @Column({ type: 'varchar', length: 36 })
  uuid_relacionado: string;

  @Column({ type: 'varchar', length: 13 })
  rfc_relacionado: string;

  @Column({ type: 'date' })
  fecha: string;

  @Column({ type: 'varchar', length: 10 })
  movimiento: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
