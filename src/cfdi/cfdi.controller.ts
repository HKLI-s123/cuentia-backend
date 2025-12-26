import { Controller, Get, Post, Body, Query, BadRequestException, Res, ForbiddenException, UseGuards, Req} from '@nestjs/common';
import type { Response } from 'express';
import type { Factura } from './common/types/factura.type';
import * as ExcelJS from 'exceljs';
import { CfdiService } from './cfdi.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimitGuard } from '../auth/guards/rate-limit.guard';
import type { AuthRequest } from 'src/common/interfaces/auth-request.interface';
import { OnboardingGuard } from 'src/auth/guards/onboarding.guard';

@Controller('cfdis')
export class CfdiController {
  constructor(private readonly cfdiService: CfdiService
  ) {}

  @Get('finance-report')
  @UseGuards(new RateLimitGuard(300, 60_000), JwtAuthGuard, OnboardingGuard)
  async getFinanceReport(
    @Req() req: AuthRequest,
    @Query('rfc') rfc: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: Response
  ) {
    const userId = req.user.sub;
    const type = req.user.type;
    console.log("tipo del controlador", type);
    const data = await this.cfdiService.getFinanceReport(userId, rfc, startDate, endDate, type);
  
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Reporte');
  
    // 🔹 Encabezado
    sheet.addRow([`Reporte financiero de ${rfc}`]);
    sheet.mergeCells('A1:D1');
    sheet.getCell('A1').font = { bold: true, size: 14 };
  
    sheet.addRow([`Periodo: ${startDate} → ${endDate}`]);
    sheet.mergeCells('A2:D2');
    sheet.addRow([]);
  
    // 🔹 Resumen financiero
    sheet.addRow(['Resumen Financiero']);
    sheet.getCell('A4').font = { bold: true };
  
    sheet.addRow(['Ingresos', data.ingresos]);
    sheet.addRow(['Egresos', data.egresos]);
    sheet.addRow(['Utilidad', data.utilidad]);
    sheet.addRow([]);
  
    // 🔹 CFDIs
    sheet.addRow(['CFDIs']);
    sheet.getCell('A9').font = { bold: true };
  
    sheet.addRow(['Total CFDIs', data.trends.cfdisRecibidos]);
    sheet.addRow(['Vigentes', data.trends.cfdisVigentes]);
    sheet.addRow(['Cancelados', data.trends.cfdisCancelados]);
    sheet.addRow([]);
  
    // 🔹 Detalle Ingresos
    sheet.addRow(['Detalle de Ingresos']);
    sheet.getCell(`A${sheet.rowCount}`).font = { bold: true };
  
    sheet.addRow(['UUID', 'Fecha', 'Cliente', 'RFC Receptor', 'Total','Moneda']);
    sheet.getRow(sheet.rowCount).font = { bold: true };
  
    data.detalleIngresos.forEach((ing) => {
      sheet.addRow([ing.uuid, ing.fecha, ing.razonsocialreceptor, ing.rfc_receptor, ing.total, ing.moneda]);
    });
    sheet.addRow([]);
  
    // 🔹 Detalle Egresos
    sheet.addRow(['Detalle de Egresos']);
    sheet.getCell(`A${sheet.rowCount}`).font = { bold: true };
  
    sheet.addRow(['UUID', 'Fecha', 'Proveedor', 'RFC Emisor', 'Total','Moneda']);
    sheet.getRow(sheet.rowCount).font = { bold: true };
  
    data.detalleEgresos.forEach((egr) => {
      sheet.addRow([egr.uuid, egr.fecha, egr.razonsocialemisor, egr.rfc_emisor, egr.total, egr.moneda]);
    });
  
    // 🔹 Configuración de descarga
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Reporte-${rfc}-${startDate}_${endDate}.xlsx`
    );
  
    await workbook.xlsx.write(res);
    res.end();
  }


  @Get('main-revenue')
  @UseGuards(new RateLimitGuard(300, 60_000), JwtAuthGuard, OnboardingGuard)
  async getMainRevenue(
    @Req() req: AuthRequest,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('rfc') rfc?: string,
  ) {
    const userId = req.user.sub;
    const type = req.user.type;
    return this.cfdiService.getMainRevenue(userId, startDate, endDate, rfc, type);
  }

  @Get('main-expenses')
  @UseGuards(new RateLimitGuard(300, 60_000), JwtAuthGuard, OnboardingGuard)
  async getMainExpenses(
    @Req() req: AuthRequest,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('rfc') rfc?: string,
  ) {
    const userId = req.user.sub;
    const type = req.user.type;
    return this.cfdiService.getMainExpenses(userId, startDate, endDate, rfc, type);
  }

  @Get('finance-stats-chart')
  @UseGuards(new RateLimitGuard(300, 60_000), JwtAuthGuard, OnboardingGuard)
  async getFinanceStatsChart(
    @Req() req: AuthRequest,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('rfc') rfc?: string, // rfc_relacionado
  ) {
    if (!rfc) {
      throw new BadRequestException('El RFC es obligatorio');
    }
    const userId = req.user.sub;
    const type = req.user.type;
    return this.cfdiService.getFinanceStatsChart(userId, rfc, startDate, endDate, type);
  }

  @Get('finance-trends')
  @UseGuards(new RateLimitGuard(300, 60_000), JwtAuthGuard, OnboardingGuard)
  async getFinanceTrends(
    @Req() req: AuthRequest,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('rfc') rfc?: string, // rfc_relacionado
  ) {
    if (!rfc) {
      throw new BadRequestException('El RFC es obligatorio');
    }
    const userId = req.user.sub;
    const type = req.user.type;
    return this.cfdiService.getFinanceTrends(userId, rfc, startDate, endDate, type);
  }


  @Get('finance-stats')
  @UseGuards(new RateLimitGuard(300, 60_000), JwtAuthGuard, OnboardingGuard)
  async getFinanceStats(
    @Req() req: AuthRequest,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('rfc') rfc?: string, // rfc_relacionado
  ) {
    if (!rfc) {
      throw new BadRequestException('El RFC es obligatorio');
    }
    const userId = req.user.sub;
    const type = req.user.type;
    return this.cfdiService.getFinanceStatsByRfc(userId, rfc, startDate, endDate, type);
  }
  

  @Get('expenses-by-provider')
  @UseGuards(new RateLimitGuard(300, 60_000), JwtAuthGuard, OnboardingGuard)
  async getExpensesByProvider(
    @Req() req: AuthRequest,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('rfc') rfc?: string, // rfc_relacionado
  ) {
    const userId = req.user.sub;
    const type = req.user.type;
    return this.cfdiService.getExpensesByProvider(userId, startDate, endDate, rfc, type);
  }

  @Get('income-by-client')
  @UseGuards(new RateLimitGuard(300, 60_000), JwtAuthGuard, OnboardingGuard)
  async getIncomeByClient(
    @Req() req: AuthRequest,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('rfc') rfc?: string, // rfc_relacionado
  ) {
    const userId = req.user.sub;
    const type = req.user.type;
    return this.cfdiService.getIncomeByClient(userId, startDate, endDate, rfc, type);
  }

  @Get()
  @UseGuards(new RateLimitGuard(300, 60_000), JwtAuthGuard, OnboardingGuard)
  async getFacturas(
    @Req() req: AuthRequest,
    @Query('rfc') rfc?: string,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
  ) {
    const userId = req.user.sub;
    const type = req.user.type;
    console.log("loog3",type);
    return this.cfdiService.findFacturas(userId, rfc, fechaInicio, fechaFin, type);
  }

  @Get('by-uuid')
  @UseGuards(new RateLimitGuard(300, 60_000), JwtAuthGuard, OnboardingGuard)
  async getFacturasByUUIDs(
    @Query('uuids') uuids?: string | string[],
  ) {
    // Normalizar uuids a array de strings
    const uuidsArray = uuids
      ? Array.isArray(uuids)
        ? uuids
        : [uuids]
      : [];
  
    return this.cfdiService.findFacturasByUUIDs(uuidsArray);
  }


  @Get('pagos')
  @UseGuards(new RateLimitGuard(300, 60_000), JwtAuthGuard, OnboardingGuard)
  async getPagos(
    @Req() req: AuthRequest,
    @Query('rfc') rfc?: string,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
  ) {
    const userId = req.user.sub;
    const type = req.user.type;
    return this.cfdiService.findPagos(userId, rfc, fechaInicio, fechaFin, type);
  }

  @Get('notas-credito')
  @UseGuards(new RateLimitGuard(300, 60_000), JwtAuthGuard, OnboardingGuard)
  async getNotasCredito(
    @Req() req: AuthRequest,
    @Query('rfc') rfc?: string,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
  ) {
    const userId = req.user.sub;
    const type = req.user.type;
    return this.cfdiService.findNotasCredito(userId, rfc, fechaInicio, fechaFin, type);
  }

  @Get('cantidad-por-semana')
  @UseGuards(new RateLimitGuard(300, 60_000), JwtAuthGuard, OnboardingGuard)
  async getCantidadPorSemana(
    @Query('rfc') rfc?: string,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
  ) {
    // Retorna un array de objetos por semana: { semanaLabel, cantidad }
    return this.cfdiService.countCfdisPorSemana(rfc, fechaInicio, fechaFin);
  }

  @Post('generar-diot')
  @UseGuards(new RateLimitGuard(500, 60_000), JwtAuthGuard, OnboardingGuard)
  async generarDiot(
    @Req() req: AuthRequest,
    @Body('rfc') rfc: string,
    @Body('startDate') startDate: string,
    @Body('endDate') endDate: string,
  ) {
    if (!rfc) throw new BadRequestException('El RFC es obligatorio');
    if (!startDate || !endDate) throw new BadRequestException('Debe especificar el rango de fechas');
    
    const userId = req.user.sub;
    const type = req.user.type;
    return this.cfdiService.generarDiot(userId, rfc, startDate, endDate, type);
  }

  @Get('conceptos')
   @UseGuards(new RateLimitGuard(300, 60_000), JwtAuthGuard, OnboardingGuard)
   async getConceptos(
     @Req() req: AuthRequest,
     @Query('uuid') uuid?: string,
     @Query('rfc') rfc?: string,
     @Query('fechaInicio') fechaInicio?: string,
     @Query('fechaFin') fechaFin?: string,
  ) {
     const userId = req.user.sub;
     const type = req.user.type;
     return this.cfdiService.findConceptos(userId, uuid, rfc, fechaInicio, fechaFin, type);
  }

  @Post('ia-factura')
  @UseGuards(new RateLimitGuard(100, 60_000), JwtAuthGuard, OnboardingGuard)
  async analizarFacturaConIA(@Body() body: {factura: Factura}, @Req() req: AuthRequest ) {
     
    const userId = req.user.sub;
    const type = req.user.type;

    const { factura } = body;

    if (!factura || !factura.uuid) {
      throw new BadRequestException('Se requiere una factura válida con UUID.');
    }

    if (!userId) {
      throw new BadRequestException('Falta el ID del usuario.');
    }


    const resultado = await this.cfdiService.analizarFacturaConIA(factura, userId, type);

    return { resultado };
  }

  @Get('ia-factura/contador')
  @UseGuards(new RateLimitGuard(100, 60_000), JwtAuthGuard, OnboardingGuard)
    async obtenerContadorIA(@Req() req: AuthRequest) {
      const userId = req.user.sub;
      const type = req.user.type;
    
      if (!userId) {
        throw new BadRequestException('Se requiere el usuario autenticado.');
      }
    
      return this.cfdiService.obtenerContadorIA(userId, type);
  }
}
