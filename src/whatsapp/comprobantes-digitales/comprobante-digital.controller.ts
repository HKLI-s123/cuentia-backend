import { Controller, Get, Query, Res, Patch, Param, Body, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ComprobanteDigitalService } from './comprobante-digital.service';
import type { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { RateLimitGuard } from 'src/auth/guards/rate-limit.guard';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import type { AuthRequest } from 'src/common/interfaces/auth-request.interface';
import { EmployeeUser } from "../../employee-user/entities/employee-user.entity";
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

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

@Controller('comprobantes-digitales')
export class ComprobantesDigitalesController {
  constructor(
    private readonly comprobanteService: ComprobanteDigitalService,

    @InjectRepository(EmployeeUser)
    private readonly employeeRepo : Repository<EmployeeUser>,
  ) {}

  @UseGuards(new RateLimitGuard(60, 60_000), JwtAuthGuard) // 20 por minuto
  @Get()
  async listarComprobantes(
    @Req() req: AuthRequest,
    @Query('fechaInicio') fechaInicio: string,
    @Query('fechaFin') fechaFin: string,
  ) {
    let userId = req.user.sub;
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

  // ✅ Exportar comprobantes digitales a Excel
  @UseGuards(new RateLimitGuard(60, 60_000), JwtAuthGuard) // 20 por minuto
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

    const comprobantes = await this.comprobanteService.findByUserAndDate(
      userId,
      fechaInicio,
      fechaFin,
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Comprobantes Digitales');

    // 👇 Encabezados con estilo
    const header = [
      'ID',
      'Nombre Remitente',
      'Teléfono Remitente',
      'Banco Emisor',
      'Banco Receptor',
      'Titular Emisor',
      'Titular Receptor',
      'Fecha Operación',
      'Monto',
      'Clave Rastreo',
      'Concepto o Referencia',
      'Folio Interno',
      'Tipo Operación',
      'Moneda',
      'Fecha Registro',
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

    // 👇 Datos
    comprobantes.forEach((c) => {
      const row = sheet.addRow([
        c.id,
        c.nombre_remitente || '',
        c.telefono_remitente || '',
        c.banco_emisor || '',
        c.banco_receptor || '',
        c.titular_emisor || '',
        c.titular_receptor || '',
        c.fecha_operacion || '',
        sanitizeAmount(c.monto),
        c.clave_rastreo || '',
        c.concepto_o_referencia || '',
        c.folio_interno || '',
        c.tipo_operacion || '',
        c.moneda || '',
        c.createdAt ? new Date(c.createdAt).toLocaleString('es-MX') : '',
      ]);

      // Formato moneda
      row.getCell(7).numFmt = '"$"#,##0.00;[Red]-"$"#,##0.00';
    });

    // ==========================================
    // TOTALES (solo Monto)
    // ==========================================
    const totalMonto = comprobantes.reduce(
      (sum, c) => sum + sanitizeAmount(c.monto),
      0
    );
    
    // Fila vacía de separación
    sheet.addRow([]);
    
    // Fila de total
    const totalRow = sheet.addRow([
      '', '', '', '', '', '', '', 'TOTAL:',
      totalMonto,
      '', '', '', '', ''
    ]);
    
    // Estilos de la fila TOTAL
    totalRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true };
    
      // Fondo gris
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEEEEEE' },
      };
    
      // Alinear label TOTAL
      if (colNumber === 9) {
        cell.alignment = { horizontal: 'right' };
      }
    
      // Formato moneda en columna de Monto (columna 10 porque Excel empieza en 1)
      if (colNumber === 10) {
        cell.numFmt = '"$"#,##0.00;[Red]-"$"#,##0.00';
        cell.alignment = { horizontal: 'right' };
      }
    });

    // 👇 Auto-ajustar columnas
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

    // 👇 Cabecera de respuesta
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="comprobantes_digitales_${fechaInicio}_a_${fechaFin}.xlsx"`,
    );

    await workbook.xlsx.write(res);
    res.end();
  }

  @UseGuards(new RateLimitGuard(60, 60_000), JwtAuthGuard) // 20 por minuto
  @Patch(':id/tipo-movimiento')
  async actualizarTipoMovimiento(
    @Param('id') id: number,
    @Body('tipo_movimiento') tipoMovimiento: 'ingreso' | 'egreso',
  ) {
    if (!['ingreso', 'egreso'].includes(tipoMovimiento)) {
      return { success: false, message: 'Tipo de movimiento inválido' };
    }

    await this.comprobanteService.actualizarTipoMovimiento(id, tipoMovimiento);
    return { success: true, message: 'Tipo de movimiento actualizado correctamente' };
  }

}
