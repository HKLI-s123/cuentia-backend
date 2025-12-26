// src/common/types/factura.type.ts

export type Factura = {
  id: number;
  uuid: string;
  cliente: {
    id: number;
    nombre: string;
  };
  rfc_emisor: string;
  rfc_receptor: string;
  total: number;
  status: string;
  fecha_emision: string;
  movimiento: string;
  tipocomprobante: string;
  totalretenidos: number;
  folio: string;
  regimenfiscal: string;
  regimenfiscalreceptor: string;
  subtotal: number;
  iva8: number;
  iva16: number;
  totaltrasladado: number;
  retencionisr: number;
  retencionieps: number;
  retencioniva: number;
  descuento: number;
  moneda: string;
  tipocambio: number;
  tipopago: string;
  metodopago: string;
  usocfdi: string;
};
