import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('clientes')
export class Cliente {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nombre: string;

  @Column({ unique: true })
  rfc: string;

  @Column({ nullable: true })
  fiel: string;

  @Column({ nullable: true })
  key_path: string;

  @Column({ nullable: true })
  cer_path: string;

  @Column({ nullable: true })
  user_id_relacionado: number; 

  @Column({ type: 'timestamp', nullable: true })
  lastCertificatesUpdate: Date | null;

  @Column({
    type: "enum",
    enum: ["activo", "inactivo", "error"],
    default: "activo"
  })
  syncStatus: "activo" | "inactivo" | "error";

  @Column({ type: "timestamp", nullable: true })
  lastSync: Date | null;

  @Column({ default: false })
  syncPaused: boolean;  // ⬅ NUEVO
  
  @Column({ default: false })
  scraper_lock: boolean;  // ⬅ NUEVO

  @Column({ default: true })
  scraper_available: boolean;  // ⬅ NUEVO

  @Column({ type: "timestamp", nullable: true })
  scraper_last_run: Date | null;
}
