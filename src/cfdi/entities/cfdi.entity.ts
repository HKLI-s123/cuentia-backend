import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { PagosCfdi } from "./pagos-cfdi.entity";

@Entity('cfdis')
export class Cfdi {
  @PrimaryGeneratedColumn()
  id: string;

  @Column({ length: 100, name: 'uuid', unique:true })
  UUID: string;

  @Column({name: 'version', length: 10})
  Version: string;

  @Column({name: 'rfc_emisor', length: 20})
  RFC_Emisor: string;

  @Column({name: 'razonsocialemisor', length: 255})
  RazonSocialEmisor: string;

  @Column({name: 'rfc_receptor', length: 20})
  RFC_Receptor: string;

  @Column({name: 'razonsocialreceptor', length: 255})
  RazonSocialReceptor: string;

  @Column({ type: 'timestamp', name: 'fecha' })
  Fecha: Date;

  @Column({name: 'tipocomprobante', length: 10})
  TipoComprobante: string;

  @Column({name: 'serie', length: 20})
  Serie: string;

  @Column({name: 'folio', length: 50})
  Folio: string;

  @Column({name: 'status', length: 20})
  Status: string;

  @Column({name: 'metodopago', length: 50})
  MetodoPago: string;

  @Column({name: 'tipopago', length: 50})
  TipoPago: string;

  @Column({name: 'regimenfiscal', length: 20})
  RegimenFiscal: string;

  @Column({name: 'lugarexpedicion', length: 100})
  LugarExpedicion: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, name: 'subtotal'})
  Subtotal: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, name: 'descuento'})
  Descuento: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, name: 'total'})
  Total: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, name: 'totalretenidoiva'})
  TotalRetenidoIVA: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, name: 'totalretenidoieps'})
  TotalRetenidoIEPS: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, name: 'totalretenidoisr'})
  TotalRetenidoISR: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, name: 'totalretenidos'})
  TotalRetenidos: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, name: 'totaltrasladosiva'})
  TotalTrasladadoIVA: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, name: 'totaltrasladoieps'})
  TotalTrasladadoIEPS: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, name: 'totaltraslado'})
  TotalTrasladado: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, name: 'totaltrasladoivadieciseis'})
  TotalTrasladadoIVADieciseis: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, name: 'totaltrasladoivaexento'})
  TotalTrasladadoIVAExento: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, name: 'totaltrasladoivacero'})
  TotalTrasladadoIVACero: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, name: 'totaltrasladoivaocho'})
  TotalTrasladadoIVAOcho: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, name: 'baseiva0'})
  baseiva0: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, name: 'baseiva8'})
  baseiva8: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, name: 'baseiva16'})
  baseiva16: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, name: 'baseivaexento'})
  baseIvaExento: number;

  @Column({name: 'usocfdi', length: 50})
  UsoCFDI: string;

  @Column({name: 'moneda', length: 10})
  Moneda: string;

  @Column({name: 'movimiento', length: 100})
  Movimiento: string;

  @Column({ type: 'timestamp', name: 'fechaprocesada' })
  FechaProcesada: Date;

  @Column({name: 'regimenfiscalreceptor', length: 20})
  RegimenFiscalReceptor: string;

  @Column({name: 'rfc_cliente', length: 20})
  rfc_cliente: string;

  @Column({name: 'fuente', length: 100})
  fuente: string;

  @Column({ type: 'varchar', length: 20, name: 'rfc_relacionado' })
  rfc_relacionado: string;

  @Column({ type: 'varchar', length: 100, name: 'categoria' })
  categoria: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0, name: 'tipocambio'})
  tipocambio: number;
}
