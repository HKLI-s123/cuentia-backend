import { Injectable, InternalServerErrorException, BadRequestException, ForbiddenException} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Cfdi } from './entities/cfdi.entity';
import { CreateCfdiDto } from './dto/create-cfdi.dto';
import { PagosCfdi } from './entities/pagos-cfdi.entity';
import { NotasCreditoCfdi } from './entities/notas-credito.entity';
import { ConceptosCfdi } from './entities/conceptos_cfdis.entity';
import { AnalisisFacturasIa } from "./entities/factura-ia-analisis.entity";
import { Cliente } from "../clientes/entities/cliente.entity";
import { EmployeeUser } from "../employee-user/entities/employee-user.entity";
import { EmployeeRfcAccess } from "../employee-user/entities/employee_rfc_access.entity";
import { startOfWeek, endOfWeek, addWeeks, differenceInCalendarWeeks } from 'date-fns';
import OpenAI from 'openai'; 
import { Factura } from './common/types/factura.type';
import { BillingFeaturesService } from 'src/billing/billing-features.service';

export const PLAN_LIMITS = {
  cuentia_plan_test_daily: {
    cfdi_ai: 5,
  },
  cuentia_plan_individual: {
    cfdi_ai: 25,
  },
  cuentia_plan_profesional: {
    cfdi_ai: 50,
  },
  cuentia_plan_empresa: {
    cfdi_ai: 100,
  },
  cuentia_plan_despacho: {
    cfdi_ai: 200,
  },
};


@Injectable()
export class CfdiService {
  constructor(
    @InjectRepository(PagosCfdi)
    private pagosCfdiRepository: Repository<PagosCfdi>,

    @InjectRepository(NotasCreditoCfdi)
    private notasCreditoCfdiRepository: Repository<NotasCreditoCfdi>,

    @InjectRepository(Cfdi)
    private cfdiRepository: Repository<Cfdi>,

    @InjectRepository(ConceptosCfdi)
    private conceptosCfdiRepository: Repository<ConceptosCfdi>,

    @InjectRepository(AnalisisFacturasIa)
    private readonly facturaIAAnalisisRepo: Repository<AnalisisFacturasIa>,
    
    @InjectRepository(Cliente)
    private readonly clientesRepo : Repository<Cliente>,

    @InjectRepository(EmployeeUser)
    private readonly employeeRepo : Repository<EmployeeUser>,

    @InjectRepository(EmployeeRfcAccess)
    private readonly employeeRfcRepo : Repository<EmployeeRfcAccess>,

    private readonly billingFeaturesService: BillingFeaturesService,
  ) {}

  async findFacturas(userId: number, rfcRelacionado?: string, startDate?: string, endDate?: string, type: string = "user"){

    let listaRFCs: string[] = [];

    console.log("loooog", type);
  
    // 🟦 Caso EMPLEADO → usar RFCs asignados
    if (type === "employee") {
      // 1️⃣ Buscar empleado activo
      const employee = await this.employeeRepo.findOne({
        where: { id: userId, isActive: true },
      });
  
      if (!employee) {
        throw new ForbiddenException("Empleado no encontrado o inactivo.");
      }
  
      // 2️⃣ RFCs asignados en la tabla employee_rfc_access
      const assigned = await this.employeeRfcRepo.find({
        where: { employeeId: employee.id, ownerId: employee.ownerId },
        select: ["rfc"],
      });
  
      listaRFCs = assigned.map((a) => a.rfc);

      console.log("loooog", listaRFCs);
      console.log("loooog2", type);
  
      if (listaRFCs.length === 0) {
        throw new BadRequestException(
          "No tienes RFCs asignados. Consulta a tu administrador."
        );
      }
    } else {
     const clientes = await this.clientesRepo.find({
     where: { user_id_relacionado: userId },
     select: ['rfc'],
     });
   
     listaRFCs = clientes.map(c => c.rfc);
   
     if (listaRFCs.length === 0) {
       throw new BadRequestException("No tienes clientes asociados. Agrega uno primero. 4");
     }
   
     // 2️⃣ Validar que el rfcRelacionado enviado pertenece a ese usuario
     if (rfcRelacionado && !listaRFCs.includes(rfcRelacionado)) {
       throw new ForbiddenException("No tienes permiso para consultar facturas para este RFC.");
     }
   
     // 3️⃣ RFC por default: el primero del usuario
    }

    const rfcFinal = rfcRelacionado ?? listaRFCs[0];

    const qb = this.cfdiRepository.createQueryBuilder("cfdi")
    .select([
      "cfdi.uuid AS uuid",
      "cfdi.folio AS folio",
      "cfdi.total AS total",
      "cfdi.subtotal AS subtotal",
      "cfdi.status AS status",
      "cfdi.fecha AS fecha",
      "cfdi.rfc_emisor AS rfc_emisor",
      "cfdi.razonsocialemisor AS razonsocialemisor",
      "cfdi.rfc_receptor AS rfc_receptor",
      "cfdi.razonsocialreceptor AS razonsocialreceptor",
      "cfdi.movimiento AS movimiento",
      "cfdi.tipocomprobante AS tipocomprobante",
      "cfdi.tipocambio AS tipocambio",
      "cfdi.totalretenidos AS totalretenidos",
      "cfdi.totaltrasladoivaocho AS iva8",
      "cfdi.totaltrasladoivadieciseis AS iva16",
      "cfdi.totaltrasladoivaexento AS ivaexento",
      "cfdi.totaltrasladoivacero AS iva0",
      "cfdi.totaltraslado AS totaltraslado",
      "cfdi.totalretenidoisr AS retencionisr",
      "cfdi.totalretenidoiva AS retencioniva",
      "cfdi.totalretenidoieps AS retencionieps",
      "cfdi.regimenfiscal AS regimenfiscal",
      "cfdi.regimenfiscalreceptor AS regimenfiscalreceptor",
      "cfdi.moneda AS moneda",
      "cfdi.tipopago AS tipopago",
      "cfdi.metodopago AS metodopago",
      "cfdi.usocfdi AS usocfdi",
      "cfdi.descuento AS descuento",
    ])
    .orderBy("cfdi.fecha", "DESC");
    qb.andWhere("cfdi.rfc_relacionado = :rfcFinal", { rfcFinal });

  
    if (startDate) qb.andWhere("cfdi.fecha >= :startDate", { startDate });
    if (endDate) qb.andWhere("cfdi.fecha <= :endDate", { endDate });
  
    return qb.getRawMany();
  }

  // Servicio específico para fetch dinámico por UUIDs
  async findFacturasByUUIDs(uuids: string[]) {
    if (!uuids || uuids.length === 0) {
      return [];
    }
  
    const qb = this.cfdiRepository.createQueryBuilder("cfdi")
      .select([
        "cfdi.uuid AS uuid",
        "cfdi.folio AS folio",
        "cfdi.total AS total",
        "cfdi.subtotal AS subtotal",
        "cfdi.status AS status",
        "cfdi.fecha AS fecha",
        "cfdi.rfc_emisor AS rfc_emisor",
        "cfdi.razonsocialemisor AS razonsocialemisor",
        "cfdi.rfc_receptor AS rfc_receptor",
        "cfdi.razonsocialreceptor AS razonsocialreceptor",
        "cfdi.movimiento AS movimiento",
        "cfdi.tipocomprobante AS tipocomprobante",
        "cfdi.tipocambio AS tipocambio",
        "cfdi.totalretenidos AS totalretenidos",
        "cfdi.totaltrasladoivaocho AS iva8",
        "cfdi.totaltrasladoivadieciseis AS iva16",
        "cfdi.totaltrasladoivaexento AS ivaexento",
        "cfdi.totaltrasladoivacero AS iva0",
        "cfdi.totaltrasladosiva AS totaltrasladosiva",
        "cfdi.totalretenidoisr AS retencionisr",
        "cfdi.totalretenidoiva AS retencioniva",
        "cfdi.totalretenidoieps AS retencionieps",
        "cfdi.regimenfiscal AS regimenfiscal",
        "cfdi.regimenfiscalreceptor AS regimenfiscalreceptor",
        "cfdi.moneda AS moneda",
        "cfdi.tipopago AS tipopago",
        "cfdi.metodopago AS metodopago",
        "cfdi.usocfdi AS usocfdi",
        "cfdi.descuento AS descuento",
      ])
      .where("cfdi.uuid IN (:...uuids)", { uuids })
      .orderBy("cfdi.fecha", "DESC");
  
    return qb.getRawMany();
  }


  async findPagos( userId: number, rfcRelacionado?: string, startDate?: string, endDate?: string, type: string = "user") {
    let listaRFCs: string[] = [];

    console.log("loooog", type);
  
    // 🟦 Caso EMPLEADO → usar RFCs asignados
    if (type === "employee") {
      // 1️⃣ Buscar empleado activo
      const employee = await this.employeeRepo.findOne({
        where: { id: userId, isActive: true },
      });
  
      if (!employee) {
        throw new ForbiddenException("Empleado no encontrado o inactivo.");
      }
  
      // 2️⃣ RFCs asignados en la tabla employee_rfc_access
      const assigned = await this.employeeRfcRepo.find({
        where: { employeeId: employee.id, ownerId: employee.ownerId },
        select: ["rfc"],
      });
  
      listaRFCs = assigned.map((a) => a.rfc);

      console.log("loooog", listaRFCs);
      console.log("loooog2", type);
  
      if (listaRFCs.length === 0) {
        throw new BadRequestException(
          "No tienes RFCs asignados. Consulta a tu administrador."
        );
      }
    } else {
    // 1️⃣ Obtener todos los RFCs de clientes del usuario
    const clientes = await this.clientesRepo.find({
      where: { user_id_relacionado: userId },
      select: ['rfc'],
    });
  
     listaRFCs = clientes.map(c => c.rfc);
  
    if (listaRFCs.length === 0) {
      throw new BadRequestException("No tienes clientes asociados. Agrega uno primero. 5");
    }
  
    // 2️⃣ Validar que el rfcRelacionado enviado pertenece a ese usuario
    if (rfcRelacionado && !listaRFCs.includes(rfcRelacionado)) {
      throw new ForbiddenException("No tienes permiso para consultar pagos para este RFC.");
    }
  }
  
    // 3️⃣ RFC por default: el primero del usuario
  const rfcFinal = rfcRelacionado ?? listaRFCs[0];
  const qb = this.pagosCfdiRepository.createQueryBuilder("pago")
    .select([
      "pago.id AS id",
      "pago.uuid_complemento AS uuid_complemento",
      "pago.fecha_emision AS fecha_emision",
      "pago.fecha_pago AS fecha_pago",
      "pago.rfc_emisor AS rfc_emisor",
      "pago.nombre_emisor AS nombre_emisor",
      "pago.regimen_emisor AS regimen_emisor",
      "pago.rfc_receptor AS rfc_receptor",
      "pago.nombre_receptor AS nombre_receptor",
      "pago.regimen_receptor AS regimen_receptor",
      "pago.forma_pago AS forma_pago",
      "pago.moneda_pago AS moneda_pago",
      "pago.tipo_cambio_pago AS tipo_cambio_pago",
      "pago.monto AS monto",
      "pago.rfc_cta_ordenante AS rfc_cta_ordenante",
      "pago.banco_ordenante AS banco_ordenante",
      "pago.cta_ordenante AS cta_ordenante",
      "pago.rfc_cta_beneficiario AS rfc_cta_beneficiario",
      "pago.cta_beneficiario AS cta_beneficiario",
      "pago.uuid_factura AS uuid_factura",
      "pago.serie AS serie",
      "pago.folio AS folio",
      "pago.moneda_dr AS moneda_dr",
      "pago.equivalencia_dr AS equivalencia_dr",
      "pago.num_parcialidad AS num_parcialidad",
      "pago.imp_saldo_ant AS imp_saldo_ant",
      "pago.imp_pagado AS imp_pagado",
      "pago.imp_saldo_insoluto AS imp_saldo_insoluto",
      "pago.objeto_imp_dr AS objeto_imp_dr",
      "pago.metodo_pago_dr AS metodo_pago_dr",
      "pago.fecha_factura AS fecha_factura",
      "pago.subtotal AS subtotal",
      "pago.descuento AS descuento",
      "pago.moneda AS moneda",
      "pago.tipo_cambio AS tipo_cambio",
      "pago.total AS total",
      "pago.tipo_comprobante AS tipo_comprobante",
      "pago.exportacion AS exportacion",
      "pago.metodo_pago AS metodo_pago",
      "pago.total_imp_trasladados AS total_imp_trasladados",
      "pago.total_imp_retenidos AS total_imp_retenidos",
      "pago.base_16 AS base_16",
      "pago.importe_trasladado_16 AS importe_trasladado_16",
      "pago.base_8 AS base_8",
      "pago.importe_trasladado_8 AS importe_trasladado_8",
      "pago.base_exento AS base_exento",
      "pago.impuesto_retenido AS impuesto_retenido",
      "pago.importe_retenido AS importe_retenido",
    ])
    .orderBy("pago.fecha_pago", "DESC");
    qb.andWhere("pago.rfc_relacionado = :rfcFinal", { rfcFinal });

    // 🔹 Filtro por rango de fechas (fecha de pago)
    if (startDate) qb.andWhere("pago.fecha_pago >= :startDate", { startDate });
    if (endDate) qb.andWhere("pago.fecha_pago <= :endDate", { endDate });
  
    return qb.getRawMany();
  }

  async findNotasCredito(userId: number, rfcRelacionado?: string, startDate?: string, endDate?: string, type: string = "user") {
    let listaRFCs: string[] = [];

    console.log("loooog", type);
  
    // 🟦 Caso EMPLEADO → usar RFCs asignados
    if (type === "employee") {
        // 1️⃣ Buscar empleado activo
        const employee = await this.employeeRepo.findOne({
          where: { id: userId, isActive: true },
        });
    
        if (!employee) {
          throw new ForbiddenException("Empleado no encontrado o inactivo.");
        }
    
        // 2️⃣ RFCs asignados en la tabla employee_rfc_access
        const assigned = await this.employeeRfcRepo.find({
          where: { employeeId: employee.id, ownerId: employee.ownerId },
          select: ["rfc"],
        });
    
        listaRFCs = assigned.map((a) => a.rfc);
  
        console.log("loooog", listaRFCs);
        console.log("loooog2", type);
    
        if (listaRFCs.length === 0) {
          throw new BadRequestException(
            "No tienes RFCs asignados. Consulta a tu administrador."
          );
        }
      } else {
      // 1️⃣ Obtener todos los RFCs de clientes del usuario
      const clientes = await this.clientesRepo.find({
        where: { user_id_relacionado: userId },
        select: ['rfc'],
      });
    
      listaRFCs = clientes.map(c => c.rfc);
    
      if (listaRFCs.length === 0) {
        throw new BadRequestException("No tienes clientes asociados. Agrega uno primero. 6");
      }
    
      // 2️⃣ Validar que el rfcRelacionado enviado pertenece a ese usuario
      if (rfcRelacionado && !listaRFCs.includes(rfcRelacionado)) {
        throw new ForbiddenException("No tienes permiso para consultar pagos para este RFC.");
      }
    }
  
    // 3️⃣ RFC por default: el primero del usuario
    const rfcFinal = rfcRelacionado ?? listaRFCs[0];

    const qb = this.notasCreditoCfdiRepository.createQueryBuilder("nota")
      .select([
        "nota.id AS id",
        "nota.uuid_nota AS uuid",
        "nota.uuid_factura_relacionada AS uuid_factura_relacionada",
        "nota.fecha_emision AS fecha_emision",
        "nota.rfc_emisor AS rfc_emisor",
        "nota.nombre_emisor AS nombre_emisor",
        "nota.regimen_emisor AS regimen_emisor",
        "nota.rfc_receptor AS rfc_receptor",
        "nota.nombre_receptor AS nombre_receptor",
        "nota.regimen_receptor AS regimen_receptor",
        "nota.subtotal AS subtotal",
        "nota.total_trasladados AS total_imp_trasladados",
        "nota.retencion_isr AS retencion_isr",
        "nota.retencion_iva AS retencion_iva",
        "nota.total_retenidos AS total_retenidos",
        "nota.descuento AS descuento",
        "nota.total AS total",
        "nota.forma_pago AS forma_pago",
        "nota.moneda AS moneda",
        "nota.tipo_cambio AS tipo_cambio",
        "nota.tipo_comprobante AS tipo_comprobante",
        "nota.metodo_pago AS metodo_pago",
        "nota.rfc_relacionado AS rfc_relacionado",
        "nota.estatus AS estatus",
      ])
      .orderBy("nota.fecha_emision", "DESC");
      qb.andWhere("nota.rfc_relacionado = :rfcFinal", { rfcFinal });
    
  
    // 🔹 Filtro por rango de fechas (fecha de emisión)
    if (startDate) qb.andWhere("nota.fecha_emision >= :startDate", { startDate });
    if (endDate) qb.andWhere("nota.fecha_emision <= :endDate", { endDate });
  
    return qb.getRawMany();
  }

  async generarDiot(userId: number, rfc: string, inicio: string, fin: string, type: string = "user") {
    let listaRFCs: string[] = [];

    console.log("loooog", type);

    // 🟦 Caso EMPLEADO → usar RFCs asignados
    if (type === "employee") {
      // 1️⃣ Buscar empleado activo
      const employee = await this.employeeRepo.findOne({
        where: { id: userId, isActive: true },
      });
  
        if (!employee) {
          throw new ForbiddenException("Empleado no encontrado o inactivo.");
        }
    
        // 2️⃣ RFCs asignados en la tabla employee_rfc_access
        const assigned = await this.employeeRfcRepo.find({
          where: { employeeId: employee.id, ownerId: employee.ownerId },
          select: ["rfc"],
        });
    
        listaRFCs = assigned.map((a) => a.rfc);
  
        console.log("loooog", listaRFCs);
        console.log("loooog2", type);
    
        if (listaRFCs.length === 0) {
          throw new BadRequestException(
            "No tienes RFCs asignados. Consulta a tu administrador."
          );
        }
      } else {
     // 1️⃣ Obtener todos los RFCs de clientes del usuario
      const clientes = await this.clientesRepo.find({
        where: { user_id_relacionado: userId },
        select: ['rfc'],
      });
    
      listaRFCs = clientes.map(c => c.rfc);
    
      if (listaRFCs.length === 0) {
        throw new BadRequestException("No tienes clientes asociados. Agrega uno primero. 7");
      }
    
      // 2️⃣ Validar que el rfcRelacionado enviado pertenece a ese usuario
      if (rfc && !listaRFCs.includes(rfc)) {
        throw new ForbiddenException("No tienes permiso para consultar pagos para este RFC.");
      }
    }
  
    // 3️⃣ RFC por default: el primero del usuario
    const rfcFinal = rfc ?? listaRFCs[0];

    // 🔹 Validar fechas
    const fromDate = new Date(inicio);
    const toDate = new Date(fin);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new Error(`Formato de fecha inválido: ${inicio} o ${fin}`);
    }
  
    const fromDateSql = fromDate.toISOString().split("T")[0];
    const toDateSql = toDate.toISOString().split("T")[0];
  
    // 🔹 Construir query SQL (PostgreSQL compatible)
    const query = `
      WITH cfdi_converted AS (
        SELECT
          "rfc_emisor",
          CASE WHEN moneda = 'USD' THEN subtotal * tipocambio ELSE subtotal END AS subtotal_mxn,
          CASE WHEN moneda = 'USD' THEN total * tipocambio ELSE total END AS total_mxn,
          CASE WHEN moneda = 'USD' THEN totaltrasladoivadieciseis * tipocambio ELSE totaltrasladoivadieciseis END AS iva16mxn,
          CASE WHEN moneda = 'USD' THEN totaltrasladoivaocho * tipocambio ELSE totaltrasladoivaocho END AS iva8mxn,
          CASE WHEN moneda = 'USD' THEN baseiva8 * tipocambio ELSE baseiva8 END AS base_iva8,
          CASE WHEN moneda = 'USD' THEN baseiva16 * tipocambio ELSE baseiva16 END AS base_iva16,
          CASE WHEN moneda = 'USD' THEN baseiva0 * tipocambio ELSE baseiva0 END AS base_iva0,
          CASE WHEN moneda = 'USD' THEN baseivaexento * tipocambio ELSE baseivaexento END AS base_iva_exento,
          rfc_relacionado
        FROM cfdis
        WHERE movimiento = 'Egreso'
          AND fecha BETWEEN '${fromDateSql}' AND '${toDateSql}'
          AND rfc_relacionado = '${rfcFinal}'
          AND tipocomprobante = 'I'
          AND status = 'Vigente'
      )
      SELECT
        rfc_emisor,
        SUM(base_iva8) AS base_iva_8,
        SUM(iva8mxn)   AS iva_8,
        SUM(base_iva16) AS base_iva_16,
        SUM(iva16mxn)   AS iva_16,
        SUM(base_iva0)  AS base_iva_0,
        SUM(base_iva_exento) AS base_iva_exento
      FROM cfdi_converted
      GROUP BY rfc_emisor;
    `;
  
    try {
      const result = await this.cfdiRepository.query(query);
      return result;
    } catch (error) {
      console.error("Error al generar DIOT:", error);
      throw new Error("Error al ejecutar la consulta DIOT");
    }
  }


  findByDateRange(start: Date, end: Date): Promise<Cfdi[]> {
    return this.cfdiRepository.find({
      where: { Fecha: Between(start, end) },
    });
  }

  create(data: CreateCfdiDto): Promise<Cfdi> {
    const cfdi = this.cfdiRepository.create(data);
    return this.cfdiRepository.save(cfdi);
  }

  async remove(uuid: string): Promise<void> {
    await this.cfdiRepository.delete({ UUID: uuid });
  }

  // Ejemplo TypeORM
  async getFinanceStatsChart(
    userId: number,
    rfcRelacionado: string,
    startDate?: string,
    endDate?: string,
    type: string = "user"
  ) {

  let listaRFCs: string[] = [];

  // 🟦 Caso EMPLEADO → usar RFCs asignados
  if (type === "employee") {
    // 1️⃣ Buscar empleado activo
    const employee = await this.employeeRepo.findOne({
      where: { id: userId, isActive: true },
    });

    if (!employee) {
      throw new ForbiddenException("Empleado no encontrado o inactivo.");
    }

    // 2️⃣ RFCs asignados en la tabla employee_rfc_access
    const assigned = await this.employeeRfcRepo.find({
      where: { employeeId: employee.id, ownerId: employee.ownerId },
      select: ["rfc"],
    });

    listaRFCs = assigned.map((a) => a.rfc);

    if (listaRFCs.length === 0) {
      throw new BadRequestException(
        "No tienes RFCs asignados. Consulta a tu administrador."
      );
    }
  } else {
    // 1️⃣ Obtener todos los RFCs de clientes del usuario
    const clientes = await this.clientesRepo.find({
      where: { user_id_relacionado: userId },
      select: ['rfc'],
    });
  
    listaRFCs = clientes.map(c => c.rfc);
  
    if (listaRFCs.length === 0) {
      throw new BadRequestException("No tienes clientes asociados. Agrega uno primero. 8");
    }
  
    // 2️⃣ Validar que el rfcRelacionado enviado pertenece a ese usuario
    if (rfcRelacionado && !listaRFCs.includes(rfcRelacionado)) {
      throw new ForbiddenException("No tienes permiso para consultar pagos para este RFC.");
    }

  }
    // 3️⃣ RFC por default: el primero del usuario
    const rfcFinal = rfcRelacionado ?? listaRFCs[0];

    const qb = this.cfdiRepository.createQueryBuilder("cfdi")
      .select("DATE(cfdi.fecha)", "fecha")
      // 🔹 Ingresos con conversión de moneda
      .addSelect(`
        SUM(
          CASE 
            WHEN cfdi.movimiento = 'Ingreso' THEN 
              CASE 
                WHEN cfdi.moneda != 'MXN' THEN cfdi.total * COALESCE(cfdi.tipocambio, 1)
                ELSE cfdi.total
              END
            ELSE 0
          END
        )::numeric
      `, "ingresos")
      // 🔹 Egresos con conversión de moneda
      .addSelect(`
        SUM(
          CASE 
            WHEN cfdi.movimiento = 'Egreso' THEN 
              CASE 
                WHEN cfdi.moneda != 'MXN' THEN cfdi.total * COALESCE(cfdi.tipocambio, 1)
                ELSE cfdi.total
              END
            ELSE 0
          END
        )::numeric
      `, "egresos")
      .where("1 = 1")
      .groupBy("DATE(cfdi.fecha)")
      .orderBy("DATE(cfdi.fecha)", "ASC");
  
    // 🔹 Filtros dinámicos
    if (startDate) qb.andWhere("cfdi.fecha >= :startDate", { startDate });
    if (endDate) qb.andWhere("cfdi.fecha <= :endDate", { endDate });
    qb.andWhere("cfdi.rfc_relacionado = :rfcFinal", { rfcFinal });
  
    const result = await qb.getRawMany();

    console.log(result.map((r) => ({
      fecha: r.fecha,
      ingresos: Number(r.ingresos || 0),
      egresos: Number(r.egresos || 0)
    })));
  
    // 🔹 Normalizar salida: asegurar que siempre haya números
    return result.map((r) => ({
      fecha: r.fecha,
      ingresos: Number(r.ingresos || 0),
      egresos: Number(r.egresos || 0)
    }));
  }

  async getFinanceTrends(userId: number, rfcRelacionado: string, startDate?: string, endDate?: string, type: string = "user") {
   let listaRFCs: string[] = [];
 
   // 🟦 Caso EMPLEADO → usar RFCs asignados
   if (type === "employee") {
     // 1️⃣ Buscar empleado activo
     const employee = await this.employeeRepo.findOne({
       where: { id: userId, isActive: true },
     });
 
     if (!employee) {
       throw new ForbiddenException("Empleado no encontrado o inactivo.");
     }
 
     // 2️⃣ RFCs asignados en la tabla employee_rfc_access
     const assigned = await this.employeeRfcRepo.find({
       where: { employeeId: employee.id, ownerId: employee.ownerId },
       select: ["rfc"],
     });
 
     listaRFCs = assigned.map((a) => a.rfc);
 
     console.log("lista",listaRFCs[0]);
 
     if (listaRFCs.length === 0) {
       throw new BadRequestException(
         "No tienes RFCs asignados. Consulta a tu administrador."
       );
 
     }
 
   } else {
    // 1️⃣ Obtener todos los RFCs de clientes del usuario
    const clientes = await this.clientesRepo.find({
      where: { user_id_relacionado: userId },
      select: ['rfc'],
    });
  
    const listaRFCs = clientes.map(c => c.rfc);
  
    if (listaRFCs.length === 0) {
      throw new BadRequestException("No tienes clientes asociados. Agrega uno primero. 9");
    }
  
    // 2️⃣ Validar que el rfcRelacionado enviado pertenece a ese usuario
    if (rfcRelacionado && !listaRFCs.includes(rfcRelacionado)) {
      throw new ForbiddenException("No tienes permiso para consultar este RFC.");
    }

  }
    // 3️⃣ RFC por default: el primero del usuario
    const rfcFinal = rfcRelacionado ?? listaRFCs[0];

    console.log(rfcFinal)

    const qb = this.cfdiRepository.createQueryBuilder('cfdi')
      // Total de CFDIs recibidos
      .select('COUNT(*)', 'cfdisRecibidos')
      // CFDIs vigentes
      .addSelect('COUNT(*) FILTER (WHERE cfdi.status = \'Vigente\')', 'cfdisVigentes')
      // CFDIs cancelados
      .addSelect('COUNT(*) FILTER (WHERE cfdi.status = \'Cancelado\')', 'cfdisCancelados')
      .where('1=1');
  
    if (startDate) qb.andWhere('cfdi.fecha >= :startDate', { startDate });
    if (endDate) qb.andWhere('cfdi.fecha <= :endDate', { endDate });
    qb.andWhere('cfdi.rfc_relacionado = :rfcFinal', { rfcFinal });
  
    const result = await qb.getRawOne();
  
    return {
      cfdisRecibidos: Number(result.cfdisRecibidos || 0),
      cfdisVigentes: Number(result.cfdisVigentes || 0),
      cfdisCancelados: Number(result.cfdisCancelados || 0),
    };
  }


  async getExpensesByProvider(
    userId: number, 
    startDate?: string,
    endDate?: string,
    rfcRelacionado?: string,
    type: string = "user"
  ) {
 
   let listaRFCs: string[] = [];
 
   // 🟦 Caso EMPLEADO → usar RFCs asignados
   if (type === "employee") {
     // 1️⃣ Buscar empleado activo
     const employee = await this.employeeRepo.findOne({
       where: { id: userId, isActive: true },
     });
 
     if (!employee) {
       throw new ForbiddenException("Empleado no encontrado o inactivo.");
     }
 
     // 2️⃣ RFCs asignados en la tabla employee_rfc_access
     const assigned = await this.employeeRfcRepo.find({
       where: { employeeId: employee.id, ownerId: employee.ownerId },
       select: ["rfc"],
     });
 
     listaRFCs = assigned.map((a) => a.rfc);
 
     console.log("lista",listaRFCs[0]);
 
     if (listaRFCs.length === 0) {
       throw new BadRequestException(
         "No tienes RFCs asignados. Consulta a tu administrador."
       );
 
     }
 
   } else {
    // 1️⃣ Obtener todos los RFCs de clientes del usuario
    const clientes = await this.clientesRepo.find({
      where: { user_id_relacionado: userId },
      select: ['rfc'],
    });
  
    const listaRFCs = clientes.map(c => c.rfc);
  
    if (listaRFCs.length === 0) {
      throw new BadRequestException("No tienes clientes asociados. Agrega uno primero. 10");
    }
  
    // 2️⃣ Validar que el rfcRelacionado enviado pertenece a ese usuario
    if (rfcRelacionado && !listaRFCs.includes(rfcRelacionado)) {
      throw new ForbiddenException("No tienes permiso para consultar este RFC.");
    }
  }
    // 3️⃣ RFC por default: el primero del usuario
    const rfcFinal = rfcRelacionado ?? listaRFCs[0];

    console.log(rfcFinal);

    const qb = this.cfdiRepository.createQueryBuilder('cfdi')
      .select('cfdi.razonsocialemisor', 'name')
      .addSelect('cfdi.rfc_emisor', 'rfc')
      // 🔹 SUMA en MXN: si la moneda no es MXN, multiplica por tipo de cambio
      .addSelect(`
        SUM(
          CASE 
            WHEN cfdi.moneda != 'MXN' THEN cfdi.total * COALESCE(cfdi.tipocambio, 1)
            ELSE cfdi.total
          END
        )::numeric
      `, 'gastos')
      .where('cfdi.movimiento = :movimiento', { movimiento: 'Egreso' })
      .groupBy('cfdi.razonsocialemisor')
      .addGroupBy('cfdi.rfc_emisor');
  
    // 🔹 Filtros dinámicos
    if (startDate) qb.andWhere('cfdi.fecha >= :startDate', { startDate });
    if (endDate) qb.andWhere('cfdi.fecha <= :endDate', { endDate });
    qb.andWhere('cfdi.rfc_relacionado = :rfcFinal', { rfcFinal });
  
    const result = await qb.getRawMany();
  
    // 🔹 Total general de gastos (ya convertidos a MXN)
    const totalGastos = result.reduce((acc, r) => acc + Number(r.gastos || 0), 0);
  
    // 🔹 Resultado estructurado
    return result.map(r => ({
      id: r.rfc,
      name: r.name,
      rfc: r.rfc,
      gastos: Number(r.gastos || 0),
      porcentaje: totalGastos ? (Number(r.gastos || 0) / totalGastos) * 100 : 0,
      status: 'Activo',
      statusVariant: 'success'
    }));
  }


  async getIncomeByClient(
    userId: number,
    startDate?: string,
    endDate?: string,
    rfcRelacionado?: string,
    type: string = "user"
  ) {
 
   let listaRFCs: string[] = [];
 
   // 🟦 Caso EMPLEADO → usar RFCs asignados
   if (type === "employee") {
     // 1️⃣ Buscar empleado activo
     const employee = await this.employeeRepo.findOne({
       where: { id: userId, isActive: true },
     });
 
     if (!employee) {
       throw new ForbiddenException("Empleado no encontrado o inactivo.");
     }
 
     // 2️⃣ RFCs asignados en la tabla employee_rfc_access
     const assigned = await this.employeeRfcRepo.find({
       where: { employeeId: employee.id, ownerId: employee.ownerId },
       select: ["rfc"],
     });
 
     listaRFCs = assigned.map((a) => a.rfc);
 
     console.log("lista",listaRFCs[0]);
 
     if (listaRFCs.length === 0) {
       throw new BadRequestException(
         "No tienes RFCs asignados. Consulta a tu administrador."
       );
 
     }
 
   } else {
    // 1️⃣ Obtener todos los RFCs de clientes del usuario
    const clientes = await this.clientesRepo.find({
      where: { user_id_relacionado: userId },
      select: ['rfc'],
    });
  
    const listaRFCs = clientes.map(c => c.rfc);
  
    if (listaRFCs.length === 0) {
      throw new BadRequestException("No tienes clientes asociados. Agrega uno primero. 11");
    }
  
    // 2️⃣ Validar que el rfcRelacionado enviado pertenece a ese usuario
    if (rfcRelacionado && !listaRFCs.includes(rfcRelacionado)) {
      throw new ForbiddenException("No tienes permiso para consultar pagos para este RFC.");
    }
  }
    // 3️⃣ RFC por default: el primero del usuario
    const rfcFinal = rfcRelacionado ?? listaRFCs[0];

    console.log(rfcFinal);

    const qb = this.cfdiRepository.createQueryBuilder('cfdi')
      .select('cfdi.razonsocialreceptor', 'name')
      .addSelect('cfdi.rfc_receptor', 'rfc')
      // 🔹 SUMA en MXN: convierte si la moneda no es MXN
      .addSelect(`
        SUM(
          CASE 
            WHEN cfdi.moneda != 'MXN' THEN cfdi.total * COALESCE(cfdi.tipocambio, 1)
            ELSE cfdi.total
          END
        )::numeric
      `, 'ingresos')
      .where('cfdi.movimiento = :movimiento', { movimiento: 'Ingreso' })
      .groupBy('cfdi.razonsocialreceptor')
      .addGroupBy('cfdi.rfc_receptor');
  
    // 🔹 Filtros dinámicos
    if (startDate) qb.andWhere('cfdi.fecha >= :startDate', { startDate });
    if (endDate) qb.andWhere('cfdi.fecha <= :endDate', { endDate });
    qb.andWhere('cfdi.rfc_relacionado = :rfcFinal', { rfcFinal });
  
    const result = await qb.getRawMany();
  
    // 🔹 Total general de ingresos (ya convertidos a MXN)
    const totalIngresos = result.reduce((acc, r) => acc + Number(r.ingresos || 0), 0);
  
    // 🔹 Resultado estructurado
    return result.map(r => ({
      id: r.rfc,
      name: r.name,
      rfc: r.rfc,
      ingresos: Number(r.ingresos || 0),
      porcentaje: totalIngresos ? (Number(r.ingresos || 0) / totalIngresos) * 100 : 0,
      status: 'Activo',
      statusVariant: 'success'
    }));
  }


  async getFinanceStatsByRfc(
    userId: number,
    rfcRelacionado: string,
    startDate?: string,
    endDate?: string,
    type: string = "user"
  ) {

  let listaRFCs: string[] = [];

  // 🟦 Caso EMPLEADO → usar RFCs asignados
  if (type === "employee") {
    // 1️⃣ Buscar empleado activo
    const employee = await this.employeeRepo.findOne({
      where: { id: userId, isActive: true },
    });

    if (!employee) {
      throw new ForbiddenException("Empleado no encontrado o inactivo.");
    }

    // 2️⃣ RFCs asignados en la tabla employee_rfc_access
    const assigned = await this.employeeRfcRepo.find({
      where: { employeeId: employee.id, ownerId: employee.ownerId },
      select: ["rfc"],
    });

    listaRFCs = assigned.map((a) => a.rfc);

    console.log("lista",listaRFCs[0]);

    if (listaRFCs.length === 0) {
      throw new BadRequestException(
        "No tienes RFCs asignados. Consulta a tu administrador."
      );

    }

  } else {
    // 1️⃣ Obtener todos los RFCs de clientes del usuario
    const clientes = await this.clientesRepo.find({
      where: { user_id_relacionado: userId },
      select: ['rfc'],
    });
  
    listaRFCs = clientes.map(c => c.rfc);
  
    if (listaRFCs.length === 0) {
      throw new BadRequestException("No tienes clientes asociados. Agrega uno primero. 12");
    }
  
    // 2️⃣ Validar que el rfcRelacionado enviado pertenece a ese usuario
    if (rfcRelacionado && !listaRFCs.includes(rfcRelacionado)) {
      throw new ForbiddenException("No tienes permiso para consultar pagos para este RFC.");
    }

    console.log("lista",listaRFCs[0]);
  }
  
    // 3️⃣ RFC por default: el primero del usuario
    const rfcFinal = rfcRelacionado ?? listaRFCs[0];

    const qb = this.cfdiRepository.createQueryBuilder('cfdi')
      // 🔹 INGRESOS
      .select(`
        SUM(
          CASE 
            WHEN cfdi.movimiento = 'Ingreso' 
              THEN 
                CASE 
                  WHEN cfdi.moneda != 'MXN' THEN cfdi.total * COALESCE(cfdi.tipocambio, 1)
                  ELSE cfdi.total
                END
            ELSE 0 
          END
        )::numeric
      `, 'ingresos')
  
      // 🔹 EGRESOS
      .addSelect(`
        SUM(
          CASE 
            WHEN cfdi.movimiento = 'Egreso' 
              THEN 
                CASE 
                  WHEN cfdi.moneda != 'MXN' THEN cfdi.total * COALESCE(cfdi.tipocambio, 1)
                  ELSE cfdi.total
                END
            ELSE 0 
          END
        )::numeric
      `, 'egresos')
  
      // 🔹 UTILIDAD = INGRESOS - EGRESOS (ya convertidos)
      .addSelect(`
        SUM(
          CASE 
            WHEN cfdi.movimiento = 'Ingreso' 
              THEN 
                CASE 
                  WHEN cfdi.moneda != 'MXN' THEN cfdi.total * COALESCE(cfdi.tipocambio, 1)
                  ELSE cfdi.total
                END
            ELSE 0 
          END
        )
        -
        SUM(
          CASE 
            WHEN cfdi.movimiento = 'Egreso' 
              THEN 
                CASE 
                  WHEN cfdi.moneda != 'MXN' THEN cfdi.total * COALESCE(cfdi.tipocambio, 1)
                  ELSE cfdi.total
                END
            ELSE 0 
          END
        )
      `, 'utilidad')  
      // IVA COBRADO (trasladado) = ingresos
      .addSelect(`
        SUM(
          CASE 
            WHEN cfdi.movimiento = 'Ingreso'
              THEN (CASE WHEN cfdi.moneda != 'MXN' THEN cfdi.totaltrasladosiva * COALESCE(cfdi.tipocambio,1) ELSE cfdi.totaltrasladosiva END)
            ELSE 0
          END
        )::numeric
      `, 'iva_trasladado')
      
      // IVA PAGADO (acreditado) = egresos
      .addSelect(`
        SUM(
          CASE 
            WHEN cfdi.movimiento = 'Egreso'
              THEN (CASE WHEN cfdi.moneda != 'MXN' THEN cfdi.totaltrasladosiva * COALESCE(cfdi.tipocambio,1) ELSE cfdi.totaltrasladosiva END)
            ELSE 0
          END
        )::numeric
      `, 'iva_acreditado')
      
      // IVA A PAGAR O A FAVOR
      .addSelect(`
        SUM(
          CASE 
            WHEN cfdi.movimiento = 'Ingreso'
              THEN (CASE WHEN cfdi.moneda != 'MXN' THEN cfdi.totaltrasladosiva * COALESCE(cfdi.tipocambio,1) ELSE cfdi.totaltrasladosiva END)
            ELSE 0
          END
        )
        -
        SUM(
          CASE 
            WHEN cfdi.movimiento = 'Egreso'
              THEN (CASE WHEN cfdi.moneda != 'MXN' THEN cfdi.totaltrasladosiva * COALESCE(cfdi.tipocambio,1) ELSE cfdi.totaltrasladosiva END)
            ELSE 0
          END
        )
      `, 'iva_saldo')

      .addSelect(`
        MAX(
          CASE 
            WHEN cfdi.movimiento = 'Ingreso'
              THEN cfdi.regimenfiscal
            ELSE NULL
          END
        )
      `, 'regimenfiscal')

  
      .where('1 = 1'); // permite añadir condiciones dinámicas
  
    // 🔹 Filtros dinámicos
    if (startDate) qb.andWhere('cfdi.fecha >= :startDate', { startDate });
    if (endDate) qb.andWhere('cfdi.fecha <= :endDate', { endDate });
    qb.andWhere('cfdi.rfc_relacionado = :rfcFinal', { rfcFinal });
  
    // 🔹 Sin agrupamiento: totales globales
    return qb.getRawOne();
  }

  async getMainExpenses(
    userId: number,
    startDate?: string,
    endDate?: string,
    rfcRelacionado?: string,
    type: string = "user"
  ) {
   let listaRFCs: string[] = [];
 
   // 🟦 Caso EMPLEADO → usar RFCs asignados
   if (type === "employee") {
     // 1️⃣ Buscar empleado activo
     const employee = await this.employeeRepo.findOne({
       where: { id: userId, isActive: true },
     });
 
     if (!employee) {
       throw new ForbiddenException("Empleado no encontrado o inactivo.");
     }
 
     // 2️⃣ RFCs asignados en la tabla employee_rfc_access
     const assigned = await this.employeeRfcRepo.find({
       where: { employeeId: employee.id, ownerId: employee.ownerId },
       select: ["rfc"],
     });
 
     listaRFCs = assigned.map((a) => a.rfc);
 
     console.log("lista",listaRFCs[0]);
 
     if (listaRFCs.length === 0) {
       throw new BadRequestException(
         "No tienes RFCs asignados. Consulta a tu administrador."
       );
 
     }
 
   } else {
     // 1️⃣ Obtener todos los RFCs de clientes del usuario
    const clientes = await this.clientesRepo.find({
      where: { user_id_relacionado: userId },
      select: ['rfc'],
    });
  
    const listaRFCs = clientes.map(c => c.rfc);
  
    if (listaRFCs.length === 0) {
      throw new BadRequestException("No tienes clientes asociados. Agrega uno primero. 13");
    }
  
    // 2️⃣ Validar que el rfcRelacionado enviado pertenece a ese usuario
    if (rfcRelacionado && !listaRFCs.includes(rfcRelacionado)) {
      throw new ForbiddenException("No tienes permiso para consultar pagos para este RFC.");
    }
  }
  
    // 3️⃣ RFC por default: el primero del usuario
    const rfcFinal = rfcRelacionado ?? listaRFCs[0];

    console.log(rfcFinal);

    const qb = this.conceptosCfdiRepository.createQueryBuilder('c')
      .innerJoin('cfdis', 'cfdi', 'cfdi.uuid = c.uuid_relacionado')
      .leftJoin('cat_clave_prod_serv', 'cat', 'cat.clave = c.claveproductoservicio')
      .select('c.claveproductoservicio', 'clave')
      .addSelect('cat.descripcion', 'descripcion')
      .addSelect(`
        SUM(
          CASE
            WHEN cfdi.moneda != 'MXN' THEN c.importe * COALESCE(cfdi.tipocambio, 1)
            ELSE c.importe
          END
        )::numeric
      `, 'gastos')
      .addSelect(`ARRAY_AGG(c.uuid_relacionado)`, 'uuids') // 👈 agregamos todos los UUIDs por categoría
      .where('cfdi.movimiento = :movimiento', { movimiento: 'Egreso' });
  
    if (startDate) qb.andWhere('cfdi.fecha >= :startDate', { startDate });
    if (endDate) qb.andWhere('cfdi.fecha <= :endDate', { endDate });
    qb.andWhere('cfdi.rfc_relacionado = :rfcFinal', { rfcFinal });
  
    qb.groupBy('c.claveproductoservicio')
      .addGroupBy('cat.descripcion')
      .orderBy('gastos', 'DESC');
  
    const result = await qb.getRawMany();
  
    return result.map(r => ({
      clave: r.clave,
      descripcion: r.descripcion,
      total: Number(r.gastos || 0),
      uuids: r.uuids, // 👈 devolvemos el array de UUIDs
    }));
  }

  async getMainRevenue(
    userId: number,
    startDate?: string,
    endDate?: string,
    rfcRelacionado?: string,
    type: string = "user"
  ) {

   let listaRFCs: string[] = [];
 
   // 🟦 Caso EMPLEADO → usar RFCs asignados
   if (type === "employee") {
     // 1️⃣ Buscar empleado activo
     const employee = await this.employeeRepo.findOne({
       where: { id: userId, isActive: true },
     });
 
     if (!employee) {
       throw new ForbiddenException("Empleado no encontrado o inactivo.");
     }
 
     // 2️⃣ RFCs asignados en la tabla employee_rfc_access
     const assigned = await this.employeeRfcRepo.find({
       where: { employeeId: employee.id, ownerId: employee.ownerId },
       select: ["rfc"],
     });
 
     listaRFCs = assigned.map((a) => a.rfc);
 
     console.log("lista",listaRFCs[0]);
 
     if (listaRFCs.length === 0) {
       throw new BadRequestException(
         "No tienes RFCs asignados. Consulta a tu administrador."
       );
 
     }
 
   } else {
     const clientes = await this.clientesRepo.find({
       where: { user_id_relacionado: userId },
       select: ['rfc'],
     });
   
    const listaRFCs = clientes.map(c => c.rfc);
  
    if (listaRFCs.length === 0) {
      throw new BadRequestException("No tienes clientes asociados. Agrega uno primero. 14");
    }
  
    // 2️⃣ Validar que el rfcRelacionado enviado pertenece a ese usuario
    if (rfcRelacionado && !listaRFCs.includes(rfcRelacionado)) {
      throw new ForbiddenException("No tienes permiso para consultar pagos para este RFC.");
    }
  }
    // 3️⃣ RFC por default: el primero del usuario
    const rfcFinal = rfcRelacionado ?? listaRFCs[0];

    console.log(rfcFinal);

    const qb = this.conceptosCfdiRepository.createQueryBuilder('c')
      .innerJoin('cfdis', 'cfdi', 'cfdi.uuid = c.uuid_relacionado')
      .leftJoin('cat_clave_prod_serv', 'cat', 'cat.clave = c.claveproductoservicio')
      .select('c.claveproductoservicio', 'clave')
      .addSelect('cat.descripcion', 'descripcion')
      .addSelect(`
        SUM(
          CASE
            WHEN cfdi.moneda != 'MXN' THEN c.importe * COALESCE(cfdi.tipocambio, 1)
            ELSE c.importe
          END
        )::numeric
      `, 'total')
      .addSelect(`ARRAY_AGG(c.uuid_relacionado)`, 'uuids') // igual que gastos
      .where('cfdi.movimiento = :movimiento', { movimiento: 'Ingreso' });
  
    if (startDate) qb.andWhere('cfdi.fecha >= :startDate', { startDate });
    if (endDate) qb.andWhere('cfdi.fecha <= :endDate', { endDate });
    qb.andWhere('cfdi.rfc_relacionado = :rfcFinal', { rfcFinal });
  
    qb.groupBy('c.claveproductoservicio')
      .addGroupBy('cat.descripcion')
      .orderBy('total', 'DESC');
  
    const result = await qb.getRawMany();
  
    return result.map(r => ({
      clave: r.clave,
      descripcion: r.descripcion,
      total: Number(r.total || 0),
      uuids: r.uuids
    }));
  }


  async getFinanceReport(userId: number, rfcRelacionado: string, startDate: string, endDate: string, type: string = "user") {
   let listaRFCs: string[] = [];
   // 🟦 Caso EMPLEADO → usar RFCs asignados
   if (type === "employee") {
     // 1️⃣ Buscar empleado activo
     const employee = await this.employeeRepo.findOne({
       where: { id: userId, isActive: true },
     });
 
     if (!employee) {
       throw new ForbiddenException("Empleado no encontrado o inactivo.");
     }
 
     // 2️⃣ RFCs asignados en la tabla employee_rfc_access
     const assigned = await this.employeeRfcRepo.find({
       where: { employeeId: employee.id, ownerId: employee.ownerId },
       select: ["rfc"],
     });
 
     listaRFCs = assigned.map((a) => a.rfc);
 
     console.log("lista",listaRFCs[0]);
     console.log(type);
 
     if (listaRFCs.length === 0) {
       throw new BadRequestException(
         "No tienes RFCs asignados. Consulta a tu administrador."
       );
     }
 
   } else {
    // 1️⃣ Obtener todos los RFCs de clientes del usuario
    const clientes = await this.clientesRepo.find({
      where: { user_id_relacionado: userId },
      select: ['rfc'],
    });
  
    listaRFCs = clientes.map(c => c.rfc);
  
    if (listaRFCs.length === 0) {
      throw new BadRequestException("No tienes clientes asociados. Agrega uno primero. 2");
    }
  
    // 2️⃣ Validar que el rfcRelacionado enviado pertenece a ese usuario
    if (rfcRelacionado && !listaRFCs.includes(rfcRelacionado)) {
      throw new ForbiddenException("No tienes permiso para consultar pagos para este RFC.");
    }
  }
  
    // 3️⃣ RFC por default: el primero del usuario
    const rfcFinal = rfcRelacionado ?? listaRFCs[0];
    console.log(rfcFinal);
    // 🔹 Ingresos
    const qbIngresos = this.cfdiRepository.createQueryBuilder('cfdi')
      .select('cfdi.uuid', 'uuid')
      .addSelect('cfdi.fecha', 'fecha')
      .addSelect('cfdi.total', 'total')
      .addSelect('cfdi.razonsocialreceptor', 'razonsocialreceptor')
      .addSelect('cfdi.rfc_receptor', 'rfc_receptor')
      .addSelect('cfdi.moneda', 'moneda')
      .where('cfdi.movimiento = :movimiento', { movimiento: 'Ingreso' });
  
    if (startDate) qbIngresos.andWhere('cfdi.fecha >= :startDate', { startDate });
    if (endDate) qbIngresos.andWhere('cfdi.fecha <= :endDate', { endDate });
    qbIngresos.andWhere('cfdi.rfc_relacionado = :rfcFinal', { rfcFinal });
  
    qbIngresos.orderBy('cfdi.fecha', 'ASC');
  
    const ingresos = await qbIngresos.getRawMany();
  
    // 🔹 Egresos
    const qbEgresos = this.cfdiRepository.createQueryBuilder('cfdi')
      .select('cfdi.uuid', 'uuid')
      .addSelect('cfdi.fecha', 'fecha')
      .addSelect('cfdi.total', 'total')
      .addSelect('cfdi.razonsocialemisor', 'razonsocialemisor')
      .addSelect('cfdi.rfc_emisor', 'rfc_emisor')
      .addSelect('cfdi.moneda', 'moneda')
      .where('cfdi.movimiento = :movimiento', { movimiento: 'Egreso' });
  
    if (startDate) qbEgresos.andWhere('cfdi.fecha >= :startDate', { startDate });
    if (endDate) qbEgresos.andWhere('cfdi.fecha <= :endDate', { endDate });
    qbEgresos.andWhere('cfdi.rfc_relacionado = :rfcFinal', { rfcFinal });
  
    qbEgresos.orderBy('cfdi.fecha', 'ASC');
  
    const egresos = await qbEgresos.getRawMany();
  
    // 🔹 Totales
    const totalIngresos = ingresos.reduce((acc, row) => acc + Number(row.total || 0), 0);
    const totalEgresos = egresos.reduce((acc, row) => acc + Number(row.total || 0), 0);
  
    // 🔹 Trends (reutilizas la función existente)
    const trends = await this.getFinanceTrends(userId, rfcRelacionado, startDate, endDate, type);
  
    return {
      ingresos: totalIngresos,
      egresos: totalEgresos,
      utilidad: totalIngresos - totalEgresos,
      detalleIngresos: ingresos.map(r => ({
        uuid: r.uuid,
        fecha: r.fecha,
        total: Number(r.total),
        razonsocialreceptor: r.razonsocialreceptor,
        rfc_receptor: r.rfc_receptor,
        moneda: r.moneda,
      })),
      detalleEgresos: egresos.map(r => ({
        uuid: r.uuid,
        fecha: r.fecha,
        total: Number(r.total),
        razonsocialemisor: r.razonsocialemisor,
        rfc_emisor: r.rfc_emisor,
        moneda: r.moneda,
      })),
      trends,
    };
  }

  async countCfdisPorSemana(
    rfcRelacionado?: string,
    fechaInicio?: string,
    fechaFin?: string,
  ): Promise<{ semana: string; cantidad: number }[]> {
    if (!fechaInicio || !fechaFin) return [];

    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    const numSemanas = differenceInCalendarWeeks(fin, inicio) + 1;

    const semanas: { semana: string; cantidad: number }[] = [];

    for (let i = 0; i < numSemanas; i++) {
      const iniSemana = startOfWeek(addWeeks(inicio, i), { weekStartsOn: 1 });
      const finSemana = endOfWeek(iniSemana, { weekStartsOn: 1 });

      const cantidad = await this.cfdiRepository
        .createQueryBuilder('cfdi')
        .where('cfdi.fecha BETWEEN :inicio AND :fin', { inicio: iniSemana, fin: finSemana })
        .andWhere('cfdi.rfc_relacionado = :rfc', { rfc: rfcRelacionado })
        .getCount();

      semanas.push({
        semana: `Semana ${i + 1}: ${iniSemana.toISOString().split('T')[0]} - ${finSemana.toISOString().split('T')[0]}`,
        cantidad,
      });
    }

    return semanas;
  }

  async findConceptos(userId: number, uuid?: string, rfc?: string, startDate?: string, endDate?: string, type: string = "user") {
    let listaRFCs: string[] = [];

    console.log("loooog", type);
  
    // 🟦 Caso EMPLEADO → usar RFCs asignados
    if (type === "employee") {
      // 1️⃣ Buscar empleado activo
      const employee = await this.employeeRepo.findOne({
        where: { id: userId, isActive: true },
      });
    
        if (!employee) {
          throw new ForbiddenException("Empleado no encontrado o inactivo.");
        }
    
        // 2️⃣ RFCs asignados en la tabla employee_rfc_access
        const assigned = await this.employeeRfcRepo.find({
          where: { employeeId: employee.id, ownerId: employee.ownerId },
          select: ["rfc"],
        });
    
        listaRFCs = assigned.map((a) => a.rfc);
  
        console.log("loooog", listaRFCs);
        console.log("loooog2", type);
    
        if (listaRFCs.length === 0) {
          throw new BadRequestException(
            "No tienes RFCs asignados. Consulta a tu administrador."
          );
        }
      } else {
         // 1️⃣ Obtener todos los RFCs de clientes del usuario
         const clientes = await this.clientesRepo.find({
           where: { user_id_relacionado: userId },
           select: ['rfc'],
         });
       
         listaRFCs = clientes.map(c => c.rfc);
       
         if (listaRFCs.length === 0) {
           throw new BadRequestException("No tienes clientes asociados. Agrega uno primero. 3");
         }
       
         // 2️⃣ Validar que el rfcRelacionado enviado pertenece a ese usuario
         if (rfc && !listaRFCs.includes(rfc)) {
           throw new ForbiddenException("No tienes permiso para consultar pagos para este RFC.");
         }
      }
    // 3️⃣ RFC por default: el primero del usuario
    const rfcFinal = rfc ?? listaRFCs[0];

    const qb = this.conceptosCfdiRepository.createQueryBuilder('concepto')
      .where('1=1');
  
    if (uuid) qb.andWhere('concepto.uuid_relacionado = :uuid', { uuid });
    if (rfc) qb.andWhere('concepto.rfc_relacionado = :rfcFinal', { rfcFinal });
    if (startDate) qb.andWhere('concepto.fecha >= :startDate', { startDate });
    if (endDate) qb.andWhere('concepto.fecha <= :endDate', { endDate });
  
    return qb.getRawMany();
  }

  async findConceptosPorUuid(uuidRelacionado: string) {
    if (!uuidRelacionado) return [];

    const qb = this.conceptosCfdiRepository.createQueryBuilder('concepto')
      .select([
        'concepto.claveproductoservicio AS claveprodserv',
        'concepto.descripcion AS descripcion',
        'concepto.cantidad AS cantidad',
        'concepto.unidad AS unidad',
        'concepto.valorunitario AS valorunitario',
        'concepto.importe AS importe',
        'concepto.descuento AS descuento',
      ])
      .where('concepto.uuid_relacionado = :uuidRelacionado', { uuidRelacionado })
      .orderBy('concepto.descripcion', 'ASC')
      .limit(100); // 🔹 Límite de seguridad

    return qb.getRawMany();
  }
    
  async findPagosPorUuid(uuidRelacionado: string) {
    if (!uuidRelacionado) return [];

    const qb = this.pagosCfdiRepository.createQueryBuilder('pago')
      .select([
        'pago.uuid_complemento AS uuid_complemento',
        'pago.uuid_factura AS uuid_factura',
        'pago.fecha_pago AS fecha_pago',
        'pago.monto AS monto',
        'pago.total AS total',
        'pago.forma_pago AS forma_pago',
        'pago.moneda_pago AS moneda_pago',
        'pago.tipo_cambio_pago AS tipo_cambio_pago',
        'pago.metodo_pago AS metodo_pago',
        'pago.num_parcialidad AS num_parcialidad',
        'pago.imp_pagado AS imp_pagado',
        'pago.imp_saldo_ant AS imp_saldo_ant',
        'pago.imp_saldo_insoluto AS imp_saldo_insoluto',
        'pago.total_imp_retenidos AS total_imp_retenidos',
        'pago.total_imp_trasladados AS total_imp_trasladados',
      ])
      .where('pago.uuid_factura = :uuidRelacionado', { uuidRelacionado })
      .orderBy('pago.fecha_pago', 'DESC')
      .limit(100); // 🔹 Opcional: limitar también a 100 complementos

    return qb.getRawMany();
  } 
  
  async analizarFacturaConIA(factura: Factura, userId: number, type: 'user' | 'employee' = 'user'): Promise<string> {
    // 🔒 VALIDACIÓN DE LÍMITE DIARIO POR PLAN
    // 🟦 Si es tipo empleado → usar ownerId
    if (type === "employee") {
      const employee = await this.employeeRepo.findOne({
        where: { id: userId, isActive: true },
      });
  
      if (!employee) {
        throw new ForbiddenException("Empleado no encontrado o inactivo.");
      }

      userId = employee.ownerId ;
    }

    const planInfo = await this.billingFeaturesService.getActivePlan(userId);
    
    if (!planInfo || planInfo.status === 'cancelado') {
      throw new ForbiddenException('Tu plan no está activo');
    }
    
    const limits = PLAN_LIMITS[planInfo.plan || ""];
    
    if (!limits || !limits.cfdi_ai) {
      throw new ForbiddenException('Tu plan no permite análisis con IA');
    }
    
    const usadosHoy = await this.contarAnalisisPorUsuarioHoy(userId);
    
    if (usadosHoy >= limits.cfdi_ai) {
      throw new ForbiddenException(
        `Has alcanzado el límite diario de ${limits.cfdi_ai} análisis de facturas`
      );
    }

    try {
      // 1️⃣ Obtener conceptos (limitando a 100)
      const conceptos = await this.findConceptosPorUuid(factura.uuid);
      const conceptosLimitados = conceptos.slice(0, 100).map(c => ({
        clave: c.claveprodserv,
        descripcion: c.descripcion,
        cantidad: c.cantidad,
        unidad: c.unidad,
        valorUnitario: c.valorunitario,
        importe: c.importe,
        descuento: c.descuento,
      }));

      // 2️⃣ Obtener complementos de pago (limitando también a 100)
      const complementosPago = await this.findPagosPorUuid(factura.uuid);
      const complementosLimitados = complementosPago.slice(0, 100).map(p => ({
        uuidComplemento: p.uuid_complemento,
        uuidFactura: p.uuid_factura,
        fechaPago: p.fecha_pago,
        monto: p.monto,
        total: p.total,
        formaPago: p.forma_pago,
        monedaPago: p.moneda_pago,
        tipoCambioPago: p.tipo_cambio_pago,
        metodoPago: p.metodo_pago,
        numParcialidad: p.num_parcialidad,
        importePagado: p.imp_pagado,
        impSaldoAnterior: p.imp_saldo_ant,
        impSaldoInsoluto: p.imp_saldo_insoluto,
        totalImpRetenidos: p.total_imp_retenidos,
        totalImpTrasladados: p.total_imp_trasladados,
      }));

      const totalComplementos = complementosLimitados.reduce(
        (acc, comp) => acc + (Number(comp.importePagado) || 0),
        0
      );

      // 3️⃣ Construir el JSON compacto para la IA
      const facturaIA = {
        id: factura.id,
        uuid: factura.uuid,
        folio: factura.folio,
        fecha_emision: factura.fecha_emision,
        cliente: factura.cliente?.nombre,
        rfc_emisor: factura.rfc_emisor,
        rfc_receptor: factura.rfc_receptor,
        status: factura.status,
        total: factura.total,
        moneda: factura.moneda,
        tipocambio: factura.tipocambio,
        impuestos: {
          iva8: factura.iva8,
          iva16: factura.iva16,
          totaltrasladado: factura.totaltrasladado,
          retencioniva: factura.retencioniva,
          retencionisr: factura.retencionisr,
        },
        tipocomprobante: factura.tipocomprobante,
        movimiento: factura.movimiento,
        regimenfiscal: factura.regimenfiscal,
        regimenfiscalreceptor: factura.regimenfiscalreceptor,
        metodopago: factura.metodopago,
        tipopago: factura.tipopago,
        usocfdi: factura.usocfdi,
        conceptos: conceptosLimitados,
        complementos_pago: complementosLimitados,
        total_complementos_pago: totalComplementos, // 🔹 campo agregado
      };

      // 4️⃣ Llamada a OpenAI con el JSON preparado
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY, // ✅ usa variable de entorno
      });

      console.log(JSON.stringify(facturaIA, null, 2));

      const prompt = `
        Eres un analista contable y fiscal especializado en CFDI 4.0 y sus complementos de pago.
        Analiza la siguiente factura (incluyendo conceptos y complementos de pago) y devuelve un análisis técnico, detallado y estructurado.
        Si el estatus de la factura es cancelada, mencionalo y tenlo en cuenta.

        Datos de entrada:
        ${JSON.stringify(facturaIA, null, 2)}
        
        Tu salida debe incluir las siguientes secciones:
        
        1. **Resumen general:**
           - UUID, folio, fecha, cliente y total.
           - Tipo de comprobante y régimen fiscal.
           - Método y forma de pago.
           - Estatus de la factura (cancelada/vigente).
           - Número de complementos de pago.
        
        2. **Clasificación contable:**
           - Lista los conceptos y asigna a cada uno una categoría contable sugerida (por ejemplo: “Gasto administrativo”, “Equipo de cómputo”, “Insumos”, “Servicios profesionales”).
           - Indica si es deducible fiscalmente y bajo qué concepto del SAT.
        
        3. **Análisis de pagos y flujos:**
           - Resume todos los complementos de pago (fecha, monto, importe pagado, tipo de cambio).
           - Detecta si hay pagos duplicados o inconsistentes.
           - verifica el total de los complementos con el total de la factura, si se excede, falta o coincide.
        
        4. **Validación fiscal:**
           - Valida coherencia entre tipo de comprobante, método de pago (PUE/PPD) y complementos.
           - Revisa si el régimen fiscal del emisor y receptor son compatibles.
           - Detecta si hay valores atípicos en IVA, retenciones o descuentos.
        
        5. **Observaciones y recomendaciones:**
           - Indica posibles errores, inconsistencias o puntos de atención (por ejemplo: "El total de complementos supera el total del CFDI original" o "El total de complementos no cumple con el total del CFDI original").
           - Sugiere correcciones o verificaciones que debería realizar el contador.
           - Resume si la factura parece correctamente emitida y pagada.
        
        6. **Índice de Salud Fiscal (0 a 100):**
           - Calcula una puntuación general basada en:
           - Correcta relación entre comprobante y método de pago (20 pts)
           - Coherencia entre totales, impuestos y complementos (25 pts)
           - Integridad de datos fiscales y RFCs (20 pts)
           - Claridad y deducibilidad de conceptos (20 pts)
           - Ausencia de anomalías o advertencias (15 pts)
           - Explica brevemente el motivo de la puntuación.
        
        7. **Conclusión final:**
           - Califica la factura globalmente:  Correcta,  Revisión sugerida o  Inconsistente.
           - Resume en una frase el diagnóstico general.
        
        Devuelve tu respuesta en formato JSON puro y sin texto adicional, sin usar bloques de código, ni triple comillas. Solo devuelve el objeto JSON válido:
        
        {
          "resumen_general": "",
          "clasificacion_contable": [],
          "analisis_pagos": "",
          "validacion_fiscal": "",
          "observaciones": "",
          "indice_salud_fiscal": {
            "puntuacion": 0,
            "justificacion": ""
          },
          "conclusion": ""
        }
      `;


      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'Eres un analista contable experto en CFDI y facturación mexicana. Explica de manera técnica, clara y resumida.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 2000,
      });

      //await this.registrarAnalisisIA(userId, factura.uuid, resultado);

      const resultado =
        completion.choices[0].message.content ||
        'No se pudo generar el análisis con IA.';
      
      // ✅ REGISTRAR USO SOLO SI TODO SALIÓ BIEN
      await this.registrarAnalisisIA(
        userId,
        factura.uuid,
        resultado,
      );
      
      return resultado;
    } catch (error) {
      console.error('Error en analizarFacturaConIA:', error);
      throw new InternalServerErrorException('Error al generar el análisis con IA.');
    }
  }

  
  async contarAnalisisPorUsuarioHoy(
    userId: number,
  ): Promise<number> {
  
    const hoy = new Date();
    const inicioDelDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0);
    const finDelDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59);
  
    // 🟩 Si es usuario normal → return directo
    return this.facturaIAAnalisisRepo.count({
      where: {
        user_id: userId,
        fecha_analisis: Between(inicioDelDia, finDelDia),
      },
    });
  }

  async registrarAnalisisIA(userId: number, uuidFactura: string, resultado: string) {
    const nuevo = this.facturaIAAnalisisRepo.create({
      user_id: userId,
      uuid_factura: uuidFactura,
      resultado_ia: resultado,
      exito: true,
    });
  
    return await this.facturaIAAnalisisRepo.save(nuevo);
  }

  async obtenerContadorIA(
    userId: number,
    type: 'user' | 'employee' = 'user'
  ) {
    // 🟦 Empleado → usar ownerId
    if (type === 'employee') {
      const employee = await this.employeeRepo.findOne({
        where: { id: userId, isActive: true },
      });
  
      if (!employee) {
        throw new ForbiddenException('Empleado no encontrado o inactivo.');
      }
  
      userId = employee.ownerId;
    }
  
    // 1️⃣ Plan activo
    const planInfo = await this.billingFeaturesService.getActivePlan(userId);
  
    if (!planInfo || planInfo.status === 'cancelado') {
      return {
        usados: 0,
        limite: 0,
        restantes: 0,
        plan: null,
      };
    }
  
    // 2️⃣ Límite por plan
    const limits = PLAN_LIMITS[planInfo.plan || ''];
  
    if (!limits || !limits.cfdi_ai) {
      return {
        usados: 0,
        limite: 0,
        restantes: 0,
        plan: planInfo.plan,
      };
    }
  
    // 3️⃣ Uso del día
    const usados = await this.contarAnalisisPorUsuarioHoy(userId);
  
    const limite = limits.cfdi_ai;
    const restantes = Math.max(limite - usados, 0);
  
    return {
      usados,
      limite,
      restantes,
      plan: planInfo.plan,
    };
  }
}
