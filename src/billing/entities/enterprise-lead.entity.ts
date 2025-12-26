import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("enterprise_leads")
export class EnterpriseLead {
  @PrimaryGeneratedColumn()
  id: number;

  // Información de la empresa
  @Column()
  empresa: string;

  @Column()
  rfc: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  telefono: string;

  // Necesidades técnicas
  @Column()
  rfcs: number;

  @Column()
  cfdisMensuales: number;

  @Column()
  usuarios: number;

  // Bots
  @Column({ default: false })
  botGastos: boolean;

  @Column({ default: false })
  botComprobantes: boolean;

  @Column({ default: false })
  integraciones: boolean;

  // Detalles adicionales
  @Column({ type: "text", nullable: true })
  detalles: string;

  // Límites personalizados de IA
  @Column({ type: "int" })
  limiteAnalisisCfdiIA: number;
  
  @Column({ type: "int" })
  limiteChatbotIA: number;

  // Registro
  @CreateDateColumn()
  createdAt: Date;
}
