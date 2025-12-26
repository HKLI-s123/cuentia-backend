// team.service.ts (o employees.service.ts)
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcryptjs";
import { EmployeeUser } from "./entities/employee-user.entity";
import { EmployeeRfcAccess } from "./entities/employee_rfc_access.entity";
import { User } from "../users/entities/user.entity";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";

@Injectable()
export class EmployeeService {
  constructor(
    @InjectRepository(EmployeeUser)
    private readonly employeeRepo: Repository<EmployeeUser>,
    @InjectRepository(EmployeeRfcAccess)
    private readonly rfcRepo: Repository<EmployeeRfcAccess>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  // 🟦 Solo cuentas empresariales pueden crear empleados
  private async ensureOwnerIsBusiness(ownerId: number) {
    const owner = await this.usersRepo.findOne({
      where: { id: ownerId },
    });

    if (!owner) {
      throw new ForbiddenException("Usuario no encontrado");
    }

    if (owner.tipo_cuenta !== "empresarial") {
      throw new ForbiddenException(
        "Solo cuentas empresariales pueden gestionar empleados",
      );
    }

    return owner;
  }

  async createEmployee(ownerId: number, dto: CreateEmployeeDto) {
    await this.ensureOwnerIsBusiness(ownerId);

    const emailLower = dto.email.toLowerCase();

    const existing = await this.employeeRepo.findOne({
      where: { email: emailLower },
    });

    if (existing) {
      throw new BadRequestException(
        "Ya existe un empleado con ese correo electrónico",
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const employee = this.employeeRepo.create({
      ownerId,
      email: emailLower,
      nombre: dto.nombre,
      role: dto.role,
      hashedPassword,
      isActive: true,
    });

    const saved = await this.employeeRepo.save(employee);

    // No regresamos datos sensibles
    const { hashedPassword: _ph, currentHashedRefreshToken, ...safe } = saved;
    return safe;
  }

  async listEmployees(ownerId: number) {
    await this.ensureOwnerIsBusiness(ownerId);

    const employees = await this.employeeRepo.find({
      where: { 
        ownerId,
        isActive: true,   // 👈 agregar esta condición
      },
      order: { createdAt: "DESC" },
    });

    return employees.map((e) => {
      const { hashedPassword, currentHashedRefreshToken, ...safe } = e;
      return safe;
    });
  }

  async getEmployee(ownerId: number, employeeId: number) {
    await this.ensureOwnerIsBusiness(ownerId);

    const employee = await this.employeeRepo.findOne({
      where: { id: employeeId, ownerId },
    });

    if (!employee) {
      throw new NotFoundException("Empleado no encontrado");
    }

    const { hashedPassword, currentHashedRefreshToken, ...safe } = employee;
    return safe;
  }

  async updateEmployee(
    ownerId: number,
    employeeId: number,
    dto: UpdateEmployeeDto,
  ) {
    await this.ensureOwnerIsBusiness(ownerId);

    const employee = await this.employeeRepo.findOne({
      where: { id: employeeId, ownerId },
    });

    if (!employee) {
      throw new NotFoundException("Empleado no encontrado");
    }

    if (dto.nombre) employee.nombre = dto.nombre;
    if (dto.email) employee.email = dto.email;
    if (dto.role) employee.role = dto.role;

    if (dto.password) {
      employee.hashedPassword = await bcrypt.hash(dto.password, 12);
    }

    const saved = await this.employeeRepo.save(employee);

    const { hashedPassword, currentHashedRefreshToken, ...safe } = saved;
    return safe;
  }

  async deactivateEmployee(ownerId: number, employeeId: number) {
    await this.ensureOwnerIsBusiness(ownerId);
  
    const employee = await this.employeeRepo.findOne({
      where: { id: employeeId, ownerId },
    });
  
    if (!employee) {
      throw new NotFoundException("Empleado no encontrado");
    }
  
    // 🔒 Desactivar
    employee.isActive = false;
  
    // 🧹 Anonimizar correo para evitar colisiones
    employee.email = `disabled_${employee.id}_${Date.now()}@deleted.local`;
  
    // 🧹 Anonimizar nombre visible
    employee.nombre = "Empleado desactivado";
  
    // 🕒 Guardar fecha de eliminación lógica
    employee.deletedAt = new Date();
  
    await this.employeeRepo.save(employee);
  
    return { success: true };
  }

  async saveEmployeeRfcAssignments(ownerId: number, employeeId: number, rfcList: string[]) {
    await this.ensureOwnerIsBusiness(ownerId);
  
    const employee = await this.employeeRepo.findOne({ where: { id: employeeId, ownerId } });
    if (!employee) throw new NotFoundException("Empleado no encontrado");
  
    // 1️⃣ Borrar asignaciones anteriores
    await this.rfcRepo.delete({ employeeId, ownerId });
  
    // 2️⃣ Crear nuevas
    const entries = rfcList.map(rfc => this.rfcRepo.create({
      rfc,
      ownerId,
      employeeId
    }));
  
    await this.rfcRepo.save(entries);
  
    return { success: true };
  }
  
  async listEmployeeRfc(ownerId: number, employeeId: number) {
    return this.rfcRepo.find({
      where: { ownerId, employeeId },
      order: { createdAt: "DESC" },
    });
  }

  async getEmployeeAssignedRfcs(employeeId: number) {
    return this.rfcRepo.find({
      where: { employeeId },
      select: ['rfc'],
    });
  }

}
