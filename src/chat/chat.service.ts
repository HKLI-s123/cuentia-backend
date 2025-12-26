import { Injectable, Logger, BadRequestException, ForbiddenException} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository} from 'typeorm';
import { SendMessageDto } from './dto/send-message.dto';
import { CfdiService } from '../cfdi/cfdi.service';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { analyzeAI } from "./common/openai.helper";
import { Cliente } from "../clientes/entities/cliente.entity";
import { EmployeeUser } from "../employee-user/entities/employee-user.entity";
import { EmployeeRfcAccess } from "../employee-user/entities/employee_rfc_access.entity";
import { BillingFeaturesService } from 'src/billing/billing-features.service';
import { UsageService } from 'src/billing/usage.service';

export const PLAN_LIMITS = {
  cuentia_plan_test_daily: {
    bot_message: 2,
  },
  cuentia_plan_individual: {
    bot_message: 50,
  },
  cuentia_plan_profesional: {
    bot_message: 100,
  },
  cuentia_plan_empresa: {
    bot_message: 200,
  },
  cuentia_plan_despacho: {
    bot_message: 400,
  },
};

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private readonly cfdisService: CfdiService,
    @InjectRepository(Cliente)
    private readonly clientesRepo : Repository<Cliente>,

    @InjectRepository(EmployeeUser)
    private readonly employeeRepo : Repository<EmployeeUser>,

    @InjectRepository(EmployeeRfcAccess)
    private readonly employeeRfcRepo : Repository<EmployeeRfcAccess>,

    private readonly billingFeaturesService: BillingFeaturesService,

    private readonly usageService: UsageService, // 👈 NUEVO
  ) {}
  
  async validateUsage(
    userId: number,
    feature: 'cfdi_ai' | 'bot_message'
  ) {
    const plan = await this.billingFeaturesService.getActivePlan(userId);
  
    if (!plan || plan.status === 'cancelado') {
      throw new ForbiddenException('Plan inactivo');
    }
  
    const limits = PLAN_LIMITS[plan.plan || ""];
  
    if (!limits) {
      throw new ForbiddenException('Plan no soportado');
    }
  
    const used = await this.usageService.getUsage(userId, feature);
  
    if (used >= limits[feature]) {
      throw new ForbiddenException(
        'Has alcanzado el límite de tu plan'
      );
    }
  }

  async processMessage(data: SendMessageDto, userId: number, type: string = "user"): Promise<{ reply: string; raw: any }> {
    const { message, rfc, semanas } = data;

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
 
      listaRFCs = assigned.map(a => a.rfc);
 
       if (!listaRFCs.includes(rfc)) {
         throw new ForbiddenException(
           "No tienes permiso para generar una key para este RFC."
         );
       }
     }else{
      const clientes = await this.clientesRepo.find({
        where: { user_id_relacionado: userId },
        select: ['rfc'],
      });
    
       listaRFCs = clientes.map(c => c.rfc);
    
      if (listaRFCs.length === 0) {
        throw new BadRequestException("No tienes clientes asociados. Agrega uno primero.");
      }
    
      // 2️⃣ Validar que el rfcRelacionado enviado pertenece a ese usuario
      if (rfc && !listaRFCs.includes(rfc)) {
        throw new ForbiddenException("No tienes permiso para este RFC.");
      }
     }
  
    // 3️⃣ RFC por default: el primero del usuario
    const rfcFinal = rfc ?? listaRFCs[0];

    if (!semanas || semanas.length === 0) {
      return { reply: '⚠️ No se seleccionaron semanas para analizar.', raw: null};
    }

    const facturasPorMes: Record<string, any[]> = {};

    // totales generales (MXN)
    let totalIngresos = 0;
    let totalEgresos = 0;
    let totalIvaPagado = 0;
    let totalIvaAPagar = 0;

    // totales por moneda original
    const detallesMoneda: Record<string, {
      ingresos: number,
      egresos: number,
      iva_pagado: number,
      iva_a_pagar: number
    }> = {};

    let totalFacturas = 0;

    for (const semana of semanas) {

      const fechaInicio = semana.inicio || parseLabelToDate(semana.label).inicio;
      const fechaFin = semana.fin || parseLabelToDate(semana.label).fin;

      const facturas = await this.cfdisService.findFacturas(userId, rfcFinal, fechaInicio, fechaFin, type);
      totalFacturas += facturas.length;

      for (const cfdi of facturas) {
        const conceptosLimitados = await this.cfdisService.findConceptos(
          userId,
          cfdi.uuid,
          rfcFinal,
          fechaInicio,
          fechaFin,
          type
        );
      
        // 🔹 Limitar a máximo 50 conceptos por factura
        const conceptos = conceptosLimitados.slice(0, 50);
      
        const mes = format(new Date(cfdi.fecha), 'MMMM', { locale: es });
        if (!facturasPorMes[mes]) facturasPorMes[mes] = [];

        facturasPorMes[mes].push({
          uuid: cfdi.uuid,
          fecha: cfdi.fecha,
          movimiento: cfdi.movimiento,
          total: cfdi.total,
          tipocambio: cfdi.tipocambio,
          moneda: cfdi.moneda,
          subtotal: cfdi.subtotal,
          rfc_emisor: cfdi.rfc_emisor,
          rfc_receptor: cfdi.rfc_receptor,
          total_retenido_IVA: cfdi.retencioniva, 
          total_retenido_IEPS: cfdi.retencionieps, 
          total_retenido_ISR: cfdi.retencionisr,
          total_iva_8: cfdi.iva8,
          total_iva_16: cfdi.iva16,
          total_iva_0: cfdi.iva0,
          total_iva_exento: cfdi.ivaexento,
          conceptos: conceptos.map(c => ({
            cantidad: c.concepto_cantidad,
            unidad: c.concepto_unidad,
            descripcion: c.concepto_descripcion,
            valorunitario: c.concepto_valorunitario,
            importe: c.concepto_importe,
            descuento: c.concepto_descuento,
            uuid_relacionado: c.concepto_uuid_relacionado,
            fecha: c.concepto_fecha,
            movimiento: c.concepto_movimiento
          }))
        });

        // ---------------------------
        // conversion MXN
        // ---------------------------
        const tc = Number(cfdi.tipocambio) || 1;
        const moneda = cfdi.moneda || 'MXN';
        const totalMXN = Number(cfdi.total) * (moneda !== 'MXN' ? tc : 1);
        const iva8 = Number(cfdi.iva8) || 0;
        const iva16 = Number(cfdi.iva16) || 0;
        const ivaTotalMXN = (iva8 + iva16) * (moneda !== 'MXN' ? tc : 1);

        if (!detallesMoneda[moneda]) {
          detallesMoneda[moneda] = {
            ingresos: 0,
            egresos: 0,
            iva_pagado: 0,
            iva_a_pagar: 0
          };
        }

        // totales por moneda ORIGINAL
        if (cfdi.movimiento === 'Ingreso') {
          detallesMoneda[moneda].ingresos += Number(cfdi.total) || 0;
          detallesMoneda[moneda].iva_a_pagar += iva8 + iva16;
        } else if (cfdi.movimiento === 'Egreso') {
          detallesMoneda[moneda].egresos += Number(cfdi.total) || 0;
          detallesMoneda[moneda].iva_pagado += iva8 + iva16;
        }

        // totales generales (SIEMPRE MXN)
        if (cfdi.movimiento === 'Ingreso') {
          totalIngresos += totalMXN;
          totalIvaAPagar += ivaTotalMXN;
        } else if (cfdi.movimiento === 'Egreso') {
          totalEgresos += totalMXN;
          totalIvaPagado += ivaTotalMXN;
        }

      } // for cfdi

    } // for semanas

    // json por mes
    const detallePorMes = Object.entries(facturasPorMes).map(([mes, cfdis]) => {

      let ingMes = 0;
      let egrMes = 0;
      let ivaPagMes = 0;
      let ivaAPagMes = 0;

      for (const c of cfdis) {
        const tc = Number(c.tipocambio) || 1;
        const moneda = c.moneda || 'MXN';
        const totalMXN = Number(c.total) * (moneda !== 'MXN' ? tc : 1);
        const iva8 = Number(c.total_iva_8) || 0;
        const iva16 = Number(c.total_iva_16) || 0;
        const ivaTotalMXN = (iva8 + iva16) * (c.moneda !== 'MXN' ? (Number(c.tipocambio)||1) : 1);

        if (c.movimiento === 'Ingreso') {
          ingMes += totalMXN;
          ivaAPagMes += ivaTotalMXN;
        } else {
          egrMes += totalMXN;
          ivaPagMes += ivaTotalMXN;
        }
      }

      return {
        mes,
        totales: {
          total_ingresos: ingMes,
          total_egresos: egrMes,
          total_iva_pagado: ivaPagMes,
          total_iva_a_pagar: ivaAPagMes
        },
        cfdis
      };
    });

    const jsonFinal = {
      totales_generales: {
        total_ingresos: totalIngresos,
        total_egresos: totalEgresos,
        total_iva_pagado: totalIvaPagado,
        total_iva_a_pagar: totalIvaAPagar
      },
      detalles_por_moneda: detallesMoneda,
      detalle_por_mes: detallePorMes
    };

    this.logger.log(JSON.stringify(jsonFinal, null, 2));

    const reply = `🤖 Se encontraron ${totalFacturas} facturas agrupadas y convertidas a MXN correctamente.\nTu consulta: "${message}".`;

    await this.validateUsage(userId, 'bot_message');

    const ai = await analyzeAI(jsonFinal, message);

    await this.usageService.increment(userId, 'bot_message');

    return {
      reply: ai.analysis_text,
      raw: ai.data   // <-- si quieres graficar en FE
    };

  }
}

function parseLabelToDate(label: string): { inicio: string; fin: string } {
  const [_, rango] = label.split(': ');
  const [inicioStr, finStr] = rango.split(' - ');

  const year = new Date().getFullYear();
  const meses: Record<string, string> = {
    ene: '01', feb: '02', mar: '03', abr: '04',
    may: '05', jun: '06', jul: '07', ago: '08',
    sep: '09', oct: '10', nov: '11', dic: '12'
  };

  const parseDate = (str: string) => {
    const [dia, mesAbrev] = str.trim().split(' ');
    return `${year}-${meses[mesAbrev.toLowerCase()]}-${dia.padStart(2, '0')}`;
  };

  return { inicio: parseDate(inicioStr), fin: parseDate(finStr) };
}
