import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("analisis_facturas_ia")
export class AnalisisFacturasIa {
  @PrimaryGeneratedColumn()
  id: number;

  // 🔹 UUID de la factura analizada
  @Column({ type: "char", length: 36 })
  uuid_factura: string;

  // 🔹 ID o identificador del usuario que ejecutó el análisis
  @Index() // Para búsquedas rápidas por usuario
  @Column({ type: "int" })
  user_id: number;

  // 🔹 Resultado completo del análisis (JSON serializado)
  @Column({ type: "text" })
  resultado_ia: string;

  // 🔹 Indica si el análisis se realizó correctamente o falló
  @Column({ type: "boolean", default: true })
  exito: boolean;

  // 🔹 Mensaje de error si aplica
  @Column({ type: "text", nullable: true })
  error?: string;

  // 🔹 Fecha y hora del análisis
  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  fecha_analisis: Date;

  // 🔹 Última actualización (por si el resultado se reanaliza)
  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  updated_at: Date;
}
