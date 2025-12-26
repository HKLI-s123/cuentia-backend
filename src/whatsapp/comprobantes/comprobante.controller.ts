import { Controller, Get, Query, Res, UseGuards, Req, ForbiddenException} from '@nestjs/common';
import { ComprobanteService } from './comprobante.service';
import type { Response} from 'express';
import * as ExcelJS from 'exceljs';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RateLimitGuard } from 'src/auth/guards/rate-limit.guard';
import type { AuthRequest } from 'src/common/interfaces/auth-request.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeUser } from "../../employee-user/entities/employee-user.entity";

function sanitizeAmount(value: any): number {
  if (!value) return 0;

  // Convertir a string
  let str = value.toString();

  // 1️⃣ Quitar símbolos, letras, espacios, comas, MXN, $
  str = str.replace(/[^0-9.-]/g, "");

  // 2️⃣ Convertir a número
  const num = parseFloat(str);

  // Si no es número válido, regresar 0
  return isNaN(num) ? 0 : num;
}

@Controller('comprobantes')
export class ComprobantesController {
  constructor(
    private readonly comprobanteService: ComprobanteService,

    @InjectRepository(EmployeeUser)
    private readonly employeeRepo : Repository<EmployeeUser>,
  ) {}

  @UseGuards(new RateLimitGuard(60, 60_000), JwtAuthGuard) 
  @Get()
  async listarComprobantes(
    @Req() req: AuthRequest,
    @Query('fechaInicio') fechaInicio: string,
    @Query('fechaFin') fechaFin: string,
  ) {
    let userId = req.user.sub; // ID del que está logueado
    const type = req.user.type; // viene del JWT (asumo que ya lo agregaste)
  
    // 🟥 Si es empleado, entonces debemos usar el ownerId
    if (type === "employee") {
      const employee = await this.employeeRepo.findOne({
        where: { id: userId, isActive: true },
      });
  
      if (!employee) {
        throw new ForbiddenException("Empleado no encontrado o inactivo.");
      }
  
      userId = employee.ownerId; // ahora sí, el dueño real
    }
  
    if (!userId) return { comprobantes: [] };
  
    const comprobantes = await this.comprobanteService.findByUserAndDate(
      userId,
      fechaInicio,
      fechaFin,
    );
  
    return { comprobantes };
  }


  @UseGuards(new RateLimitGuard(60, 60_000), JwtAuthGuard)
  @Get('exportar')
  async exportarExcel(
    @Req() req: AuthRequest,
    @Query('fechaInicio') fechaInicio: string,
    @Query('fechaFin') fechaFin: string,
    @Res() res: Response,
  ) {
    let userId = req.user.sub;
    const tipoCuenta = req.user.type;
  
    // 🟥 Si es empleado, usar ownerId
    if (tipoCuenta === "employee") {
      const employee = await this.employeeRepo.findOne({
        where: { id: userId, isActive: true },
      });
  
      if (!employee) {
        throw new ForbiddenException("Empleado no encontrado o inactivo.");
      }
  
      userId = employee.ownerId;
    }
  
    if (!userId) return res.status(400).send('Falta userId');
  
    // 🟦 Obtener comprobantes del usuario dueño
    const comprobantes = await this.comprobanteService.findByUserAndDate(
      userId,
      fechaInicio,
      fechaFin,
    );
  
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Comprobantes');
  
    // ==========================================
    // ENCABEZADOS
    // ==========================================
    const header = [
      'ID',
      'Fecha',
      'Nombre del Emisor',
      'RFC',
      'Número Ticket',
      'Total',
      'IVA 8%',
      'IVA 16%',
      'Fecha Registro',
      'Remitente',
      'Teléfono',
    ];
  
    const headerRow = sheet.addRow(header);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4CAF50' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
  
    // ==========================================
    // DATOS
    // ==========================================
    comprobantes.forEach((c) => {
      const row = sheet.addRow([
        c.id,
        c.Fecha || '',
        c.Nombre_del_emisor_del_ticket || '',
        c.rfc || '',
        c.Numero_de_ticket || '',
        sanitizeAmount(c.Total),
        sanitizeAmount(c.Iva8),
        sanitizeAmount(c.Iva16),
        c.createdAt ? new Date(c.createdAt).toLocaleString('es-MX') : '',
        c.remitente_nombre || '',
        c.remitente_telefono || '',
      ]);
  
      row.getCell(6).numFmt = '"$"#,##0.00;[Red]-"$"#,##0.00';
      row.getCell(7).numFmt = '"$"#,##0.00;[Red]-"$"#,##0.00';
      row.getCell(8).numFmt = '"$"#,##0.00;[Red]-"$"#,##0.00';
    });

    const totalGeneral = comprobantes.reduce((sum, c) => sum + sanitizeAmount(c.Total), 0);
    const totalIva8 = comprobantes.reduce((sum, c) => sum + sanitizeAmount(c.Iva8), 0);
    const totalIva16 = comprobantes.reduce((sum, c) => sum + sanitizeAmount(c.Iva16), 0);
    
    sheet.addRow([]); // fila vacía
    
    const totalRow = sheet.addRow([
      '', '', '', '', 'TOTAL GENERAL:',
      totalGeneral,
      totalIva8,
      totalIva16,
      '', '', ''
    ]);

    // 🟦 Estilos de la fila de totales
    totalRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true };
    
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEEEEEE' },
      };
    
      if (colNumber === 5) {
        cell.alignment = { horizontal: 'right' };
      }
    
      if (colNumber === 6 || colNumber === 7 || colNumber === 8) {
        cell.numFmt = '"$"#,##0.00;[Red]-"$"#,##0.00';
        cell.alignment = { horizontal: 'right' };
      }
    });

    // ==========================================
    // AJUSTAR COLUMNAS
    // ==========================================
    sheet.columns
      .filter((col): col is ExcelJS.Column => col !== undefined)
      .forEach((col) => {
        let maxLength = 10;
        col.eachCell({ includeEmpty: true }, (cell) => {
          const length = cell.value ? cell.value.toString().length : 0;
          if (length > maxLength) maxLength = length;
        });
        col.width = maxLength + 2;
      });
  
    // ==========================================
    // RESPUESTA
    // ==========================================
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="comprobantes_${fechaInicio}_a_${fechaFin}.xlsx"`,
    );
  
    await workbook.xlsx.write(res);
    res.end();
  }
  
}
