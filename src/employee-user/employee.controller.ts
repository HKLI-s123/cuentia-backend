import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { EmployeeService } from "./employee.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { RateLimitGuard } from "src/auth/guards/rate-limit.guard";
import type { AuthRequest } from "src/common/interfaces/auth-request.interface";

@Controller("employee")
@UseGuards(new RateLimitGuard(120,60_000) ,JwtAuthGuard, RolesGuard)
export class EmployeeController {
  constructor(private readonly employeService: EmployeeService) {}

  // Solo el dueño de la cuenta empresarial
  @Get()
  @Roles("owner")
  async list(@Req() req: AuthRequest) {
    const ownerId = req.user.sub;
    return this.employeService.listEmployees(ownerId);
  }

  @Post()
  @Roles("owner")
  async create(@Req() req: AuthRequest, @Body() dto: CreateEmployeeDto) {
    const ownerId = req.user.sub;
    return this.employeService.createEmployee(ownerId, dto);
  }

  @Get(":id")
  @Roles("owner")
  async getOne(
    @Req() req: AuthRequest,
    @Param("id", ParseIntPipe) id: number,
  ) {
    const ownerId = req.user.sub;
    return this.employeService.getEmployee(ownerId, id);
  }

  @Patch(":id")
  @Roles("owner")
  async update(
    @Req() req: AuthRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateEmployeeDto,
  ) {
    const ownerId = req.user.sub;
    return this.employeService.updateEmployee(ownerId, id, dto);
  }

  @Delete(":id")
  @Roles("owner")
  async delete(
    @Req() req: AuthRequest,
    @Param("id", ParseIntPipe) id: number,
  ) {
    const ownerId = req.user.sub;
    return this.employeService.deactivateEmployee(ownerId, id);
  }
 
  // ===================================================
  // 📌 LISTAR RFCs ASIGNADOS A UN EMPLEADO
  // ===================================================
  @Get(":id/rfcs")
  @Roles("owner")
  async listEmployeeRfcs(
    @Req() req: AuthRequest,
    @Param("id", ParseIntPipe) employeeId: number,
  ) {
    const ownerId = req.user.sub;
    return this.employeService.listEmployeeRfc(ownerId, employeeId);
  }
  
  // ===================================================
  // 📌 ASIGNAR RFC A UN EMPLEADO
  // ===================================================
  // Guardar asignaciones
  @Post(":id/rfcs")
  @Roles("owner")
  async saveRfcAssignment(
    @Req() req: AuthRequest,
    @Param("id", ParseIntPipe) employeeId: number,
    @Body() body: { rfcList: string[] }
  ) {
    return this.employeService.saveEmployeeRfcAssignments(
      req.user.sub,
      employeeId,
      body.rfcList
    );
  }
  
}