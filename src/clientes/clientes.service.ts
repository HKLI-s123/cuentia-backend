import { Injectable, NotFoundException, ForbiddenException, BadRequestException} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Cliente } from './entities/cliente.entity';
import { EmployeeUser } from '../employee-user/entities/employee-user.entity';
import { EmployeeRfcAccess } from '../employee-user/entities/employee_rfc_access.entity';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { UsersService } from '../users/users.service';
import { promises as fs } from 'fs';
import { join } from 'path';
import { User } from 'src/users/entities/user.entity';
import { BillingFeaturesService } from 'src/billing/billing-features.service';
import { Cfdi } from 'src/cfdi/entities/cfdi.entity';

export const PLAN_LIMITS = {
  cuentia_trial: { rfcs: 10 },
  cuentia_plan_individual: { rfcs: 5 },
  cuentia_plan_profesional: { rfcs: 10 },
  cuentia_plan_empresarial: { rfcs: 50 },
  cuentia_plan_despacho: { rfcs: 300 },
};

const now = new Date();
const startOfYear = new Date(now.getFullYear(), 0, 1); // 1 enero
const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59); // 31 dic


@Injectable()
export class ClientesService {
  constructor(
    @InjectRepository(Cliente)
    private clientesRepo: Repository<Cliente>,

    @InjectRepository(User)
    private readonly usersRepo : Repository<User>,

    @InjectRepository(EmployeeUser)
    private readonly employeeRepo : Repository<EmployeeUser>,

    @InjectRepository(EmployeeRfcAccess)
    private readonly rfcAccessRepo : Repository<EmployeeRfcAccess>,

    @InjectRepository(Cfdi)
    private readonly cfdisRepo: Repository<Cfdi>,

    private readonly usersService: UsersService,

    private readonly billingFeaturesService: BillingFeaturesService,
  ) {}

  async validateRfcLimit(userId: number) {
    const planInfo = await this.billingFeaturesService.getActivePlan(userId);
  
    const plan = planInfo.plan ?? "cuentia_trial";
    const limit = PLAN_LIMITS[plan]?.rfcs ?? 10;
  
    const current = await this.clientesRepo.count({
      where: { user_id_relacionado: userId },
    });

    console.log(limit);
  
    if (current >= limit) {
      throw new ForbiddenException(
        `Has alcanzado el límite de RFCs para tu plan (${limit}).`
      );
    }
  }

  async create(dto: CreateClienteDto, userId: number, userType: string = "user") {
    let employee: EmployeeUser | null = null;
    // 1️⃣ Si el usuario es empleado → obtener ownerId
    if (userType === "employee") {
      employee = await this.employeeRepo.findOne({
        where: { id: userId, isActive: true },
      });
  
      if (!employee) {
        throw new ForbiddenException("Empleado no encontrado o inactivo.");
      }
  
      // reemplazamos userId por el dueño
      userId = employee.ownerId;
    }

    await this.validateRfcLimit(userId);

    const user = await this.usersService.findById(userId);

    if (user?.tipo_cuenta !== 'empresarial') {
      throw new ForbiddenException(
        'Solo las cuentas empresariales pueden crear clientes.',
      );
    }

    const cliente = this.clientesRepo.create({
      ...dto,
      key_path: dto.key_path ?? undefined,
      cer_path: dto.cer_path ?? undefined,
      user_id_relacionado: userId,
    });

    const savedCliente = await this.clientesRepo.save(cliente);
  
    // 4️⃣ Si fue creado por un empleado → asignar acceso automáticamente
    if (employee) {
      await this.rfcAccessRepo.save({
        employeeId: employee.id,
        rfc: savedCliente.rfc,
        ownerId: employee.ownerId,
      });
    }
  
    return savedCliente;
  }

  async findOne(id: number, userId: number, userType: string) {

    console.log("iddddd",userId);

    if (userType === "employee") {
      const employee = await this.employeeRepo.findOne({
        where: { id: userId },
      });
  
      if (!employee) throw new ForbiddenException("Empleado no encontrado 1");

      console.log("employeeeee",employee);
  
      // RFCs permitidos
      const assigned = await this.rfcAccessRepo.find({
        where: { employeeId: userId },
      });
  
      const allowedRfcs = assigned.map(a => a.rfc);
  
      if (allowedRfcs.length === 0)
        throw new ForbiddenException("No tienes acceso a ningún RFC");
  
      const cliente = await this.clientesRepo.findOne({
        where: {
          id,
          user_id_relacionado: employee.ownerId,
          rfc: In(allowedRfcs),
        },
      });
  
      if (!cliente)
        throw new ForbiddenException("No tienes acceso a este cliente");

      console.log(cliente);
  
      return cliente;
    }

    const user = await this.usersService.findById(userId);

    if (user?.tipo_cuenta === "invitado") {
      throw new ForbiddenException(
        'Solo las cuentas empresariales pueden ver clientes.',
      );
    }

    const cliente = await this.clientesRepo.findOne({ where: {id, user_id_relacionado: userId}, });
    if (!cliente) throw new NotFoundException(`Cliente ${id} no encontrado`);
    return cliente;
  }

  async update(id: number, dto: UpdateClienteDto, userId: number, userType: string) {
    let realOwnerId = userId;   // ✔ guardamos el dueño REAL
    // 1️⃣ Si el usuario es empleado → obtener ownerId
    if (userType === "employee") {
      const employee = await this.employeeRepo.findOne({
        where: { id: userId, isActive: true },
      });
  
      if (!employee) {
        throw new ForbiddenException("Empleado no encontrado o inactivo.");
      }
  
      // reemplazamos userId por el dueño
      realOwnerId = employee.ownerId;
    }

    const user = await this.usersService.findById(realOwnerId);

    if (user?.tipo_cuenta !== 'empresarial') {
      throw new ForbiddenException(
        'Solo las cuentas empresariales pueden actualizar clientes.',
      );
    }
    
    const cliente = await this.findOne(id, userId, userType);

    if (cliente?.lastCertificatesUpdate) {
      const diffHours =
        (Date.now() - new Date(cliente?.lastCertificatesUpdate).getTime()) / (1000 * 60 * 60);
  
      if (diffHours < 24) {
        const horasRestantes = (24 - diffHours).toFixed(1);
        throw new BadRequestException(
          `Solo puedes actualizar certificados de un cliente una vez al día. Intenta nuevamente en ${horasRestantes} horas.`
        );
      }
    }
  
    // Convertimos null a undefined para los paths
    const safeDto = {
      ...dto,
      key_path: dto.key_path ?? undefined,
      cer_path: dto.cer_path ?? undefined,
    };
  
    Object.assign(cliente, safeDto);
  
    return this.clientesRepo.save(cliente);
  }

  async remove(id: number, userId: number, userType: string) {
    // 1️⃣ Si el usuario es empleado → obtener ownerId
    let realOwnerId = userId;   // ✔ guardamos el dueño REAL
    console.log("idddd2",userId);
    if (userType === "employee") {
      const employee = await this.employeeRepo.findOne({
        where: { id: userId, isActive: true },
      });
  
      if (!employee) {
        throw new ForbiddenException("Empleado no encontrado o inactivo.");
      }
  
      // reemplazamos userId por el dueño
      realOwnerId = employee.ownerId;
      console.log(userId);
      console.log(employee);
    }

    const user = await this.usersService.findById(realOwnerId);

    if (user?.tipo_cuenta !== 'empresarial') {
      throw new ForbiddenException(
        'Solo las cuentas empresariales pueden eliminar clientes.',
      );
    }

    const cliente = await this.findOne(id, userId, userType);
    return this.clientesRepo.remove(cliente);
  }

  async findAll(userId: number, userType: string) {

    if (userType === "employee") {
      // 1. Obtener employee completo
      const employee = await this.employeeRepo.findOne({
        where: { id: userId },
      });
  
      if (!employee) {
        throw new ForbiddenException("Empleado no encontrado 2");
      }
  
      // 2. RFCs asignados al empleado
      const assigned = await this.rfcAccessRepo.find({
        where: { employeeId: employee.id },
      });
  
      const allowedRfcs = assigned.map(a => a.rfc);
  
      if (allowedRfcs.length === 0) return [];
  
      const clientes = await this.clientesRepo.find({
         where: {
           user_id_relacionado: employee.ownerId,
           rfc: In(allowedRfcs),
         },
       });

      // 🔥 CONTAR CFDIs POR RFC (UNA SOLA CONSULTA)
      const cfdisCount = await this.cfdisRepo
        .createQueryBuilder('c')
        .select('c.rfc_relacionado', 'rfc')
        .addSelect('COUNT(*)', 'total')
        .where('c.rfc_relacionado IN (:...rfcs)', { rfcs: allowedRfcs })
        .andWhere('c.fecha BETWEEN :start AND :end', {
          start: startOfYear,
          end: endOfYear,
        })
        .groupBy('c.rfc_relacionado')
        .getRawMany();
  
      const cfdiMap = Object.fromEntries(
        cfdisCount.map(row => [row.rfc, Number(row.total)])
      );
     
       // ➕ Agregar key_url y cer_url igual que para empresarios
       const BACKEND_URL = 'http://localhost:3001';
     
       return clientes.map(c => ({
         ...c,
         cfdis: cfdiMap[c.rfc] ?? 0,
         key_url: c.key_path ? `${BACKEND_URL}${c.key_path}` : undefined,
         cer_url: c.cer_path ? `${BACKEND_URL}${c.cer_path}` : undefined,
       }));
    }

    const user = await this.usersService.findById(userId);

    if (user?.tipo_cuenta !== 'empresarial') {
      throw new ForbiddenException(
        'Solo las cuentas empresariales pueden buscar clientes.',
      );
    }

    const BACKEND_URL = 'http://localhost:3001'; // ajusta si tu backend está en otro host/puerto
    const clientes = await this.clientesRepo.find({where: { user_id_relacionado: userId },});

    const rfcs = clientes.map(c => c.rfc);
    if (rfcs.length === 0) return [];
    
    // 🔥 CONTAR CFDIs POR RFC
    const cfdisCount = await this.cfdisRepo
      .createQueryBuilder('c')
      .select('c.rfc_relacionado', 'rfc')
      .addSelect('COUNT(*)', 'total')
      .where('c.rfc_relacionado IN (:...rfcs)', { rfcs })
      .andWhere('c.fecha BETWEEN :start AND :end', {
        start: startOfYear,
        end: endOfYear,
      })
      .groupBy('c.rfc_relacionado')
      .getRawMany();
  
    const cfdiMap = Object.fromEntries(
      cfdisCount.map(row => [row.rfc, Number(row.total)])
    );
  
    return clientes.map(c => ({
      ...c,
      cfdis: cfdiMap[c.rfc] ?? 0,
      key_url: c.key_path ? `${BACKEND_URL}${c.key_path}` : undefined,
      cer_url: c.cer_path ? `${BACKEND_URL}${c.cer_path}` : undefined,
    }));
  }
  
  async findByUserOwnerId(userId: number, rfc?: string, userType?: string) {
    const user = await this.usersService.findById(userId);

    if (userType === "employee") {
      const employee = await this.employeeRepo.findOne({
        where: { id: userId },
      });
  
      if (!employee) throw new ForbiddenException("Empleado no encontrado 3");
  
      const assigned = await this.rfcAccessRepo.find({
        where: { employeeId: employee.id },
      });
  
      const allowed = assigned.map(a => a.rfc);
  
      if (allowed.length === 0) return null;
  
      return this.clientesRepo.findOne({
        where: {
          user_id_relacionado: employee.ownerId,
          rfc: rfc ? rfc : In(allowed),
        },
      });
    }

    if (user?.tipo_cuenta === "invitado") {
      throw new ForbiddenException(
        'Solo las cuentas empresariales pueden buscar clientes.',
      );
    }

    if (!userId) return null;
  
    const where: any = { user_id_relacionado: userId };
  
    if (rfc) {
      where.rfc = rfc;
    }
  
    return await this.clientesRepo.findOne({
      where,
      select: [
        'id',
        'nombre',
        'rfc',
        'user_id_relacionado',
        'key_path',
        'cer_path',
        'fiel',
      ],
    });
  }
  
  async uploadOwnFirma(data: {
    userId: number;
    cerFile: Express.Multer.File;
    keyFile: Express.Multer.File;
    fielPass: string;
    rfc: string;
  }) {
    const { userId, cerFile, keyFile, fielPass, rfc } = data;
    const rfcRegex = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i;
  
    // 1️⃣ Validar que no exista ya un propioRFC
    const user = await this.usersRepo.findOne({ where: { id: userId } });
  
    if (!user) throw new NotFoundException('Usuario no encontrado');
  
    if (user.propioRfc) {
      throw new BadRequestException('Ya completaste el Onboarding anteriormente.');
    }

    if (user.tipo_cuenta === "invitado"){
      throw new BadRequestException('Solo cuentas empresariales pueden subir FIEL.');
    }

    if (!rfcRegex.test(rfc)) {
      throw new BadRequestException('El RFC proporcionado no tiene un formato válido.');
    }
  
    // 2️⃣ Crear carpeta dedicada
    const folder = join('./uploads/own-firma', rfc);
    await fs.mkdir(folder, { recursive: true });
  
    // 3️⃣ Mover archivos desde /temp
    const newCerPath = join(folder, cerFile.filename);
    await fs.rename(cerFile.path, newCerPath);
  
    const newKeyPath = join(folder, keyFile.filename);
    await fs.rename(keyFile.path, newKeyPath);
  
    // 4️⃣ Guardar contraseña de llave en archivo .txt
    const fielTxtPath = join(folder, 'fiel.txt');
    const cleanPass = fielPass.replace(/\s+/g, '');
    await fs.writeFile(fielTxtPath, cleanPass, 'utf-8');
  
    // 5️⃣ Crear CLIENTE especial de “YO”
    const clienteYo = this.clientesRepo.create({
      nombre: "Yo",
      rfc,
      user_id_relacionado: userId,
      key_path: '/' + newKeyPath.replace(/\\/g, '/'),
      cer_path: '/' + newCerPath.replace(/\\/g, '/'),
      fiel: cleanPass,
    });
  
    await this.clientesRepo.save(clienteYo);
  
    // 6️⃣ Marcar onboarding completo
    user.propioRfc = rfc;
    await this.usersRepo.save(user);
  
    return {
      message: 'FIEL subida correctamente',
      rfc,
      clienteId: clienteYo.id,
    };
  }

  async updateCertificates(data: {
    userId: number;
    cerFile: Express.Multer.File;
    keyFile: Express.Multer.File;
    fielPass: string;
    rfc?: string; // opcional
  }) {
    const { userId, cerFile, keyFile, fielPass, rfc } = data;
  
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

        // ---- Actualizar/crear cliente “Yo”
    let clienteYo = await this.clientesRepo.findOne({
      where: { user_id_relacionado: userId },
    });

    if (clienteYo?.lastCertificatesUpdate) {
      const diffHours =
        (Date.now() - new Date(clienteYo?.lastCertificatesUpdate).getTime()) / (1000 * 60 * 60);
  
      if (diffHours < 24) {
        const horasRestantes = (24 - diffHours).toFixed(1);
        throw new BadRequestException(
          `Solo puedes actualizar tus certificados una vez al día. Intenta nuevamente en ${horasRestantes} horas.`
        );
      }
    }
  
    // Solo invitados NO pueden tener certificados
    if (user.tipo_cuenta === 'invitado') {
      throw new BadRequestException('Las cuentas invitado no pueden usar FIEL');
    }
  
    const finalRFC = rfc || user.propioRfc; // Si no envían uno nuevo, usamos el existente
    if (!finalRFC) {
      throw new BadRequestException('Se requiere un RFC válido');
    }
  
    const rfcRegex = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i;
    if (!rfcRegex.test(finalRFC)) {
      throw new BadRequestException('El RFC proporcionado no es válido');
    }
  
    // ---- Crear carpeta raíz para este RFC
    const folder = join('./uploads/own-firma', finalRFC);
    await fs.mkdir(folder, { recursive: true });
  
    // ---- Eliminar archivos anteriores
    try {
      const oldFiles = await fs.readdir(folder);
      for (const f of oldFiles) {
        await fs.unlink(join(folder, f));
      }
    } catch {}
  
    // ---- Guardar nuevos archivos
    const newCerPath = join(folder, cerFile.filename);
    await fs.rename(cerFile.path, newCerPath);
  
    const newKeyPath = join(folder, keyFile.filename);
    await fs.rename(keyFile.path, newKeyPath);
  
    // ---- Guardar contraseña en .txt
    const cleanPass = fielPass.replace(/\s+/g, '');
    const fielTxtPath = join(folder, 'fiel.txt');
    await fs.writeFile(fielTxtPath, cleanPass, 'utf-8');
  
  
    if (clienteYo) {
      clienteYo.rfc = finalRFC;
      clienteYo.key_path = '/' + newKeyPath.replace(/\\/g, '/');
      clienteYo.cer_path = '/' + newCerPath.replace(/\\/g, '/');
      clienteYo.fiel = cleanPass;
      clienteYo.lastCertificatesUpdate = new Date();
  
      await this.clientesRepo.save(clienteYo);
    } else {
      clienteYo = this.clientesRepo.create({
        nombre: 'Yo',
        rfc: finalRFC,
        user_id_relacionado: userId,
        key_path: '/' + newKeyPath.replace(/\\/g, '/'),
        cer_path: '/' + newCerPath.replace(/\\/g, '/'),
        fiel: cleanPass,
      });

      await this.clientesRepo.save(clienteYo);
    }
  
    // ---- Actualizar RFC principal si cambió o no existía
    if (!user.propioRfc || user.propioRfc !== finalRFC) {
      user.propioRfc = finalRFC;
      await this.usersRepo.save(user);
    }
  
    return {
      message: 'Certificados actualizados correctamente',
      rfc: finalRFC,
      clienteId: clienteYo.id,
      createdAt: clienteYo.lastCertificatesUpdate,
    };
  }

  async updateOwnCertificates(data: {
    userId: number;
    cerFile: Express.Multer.File;
    keyFile: Express.Multer.File;
    fielPass: string;
  }) {
    const { userId, cerFile, keyFile, fielPass } = data;
  
    // 1️⃣ Usuario
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
  
    // 2️⃣ Validaciones duras
    if (user.tipo_cuenta === 'invitado') {
      throw new BadRequestException('Las cuentas invitado no pueden usar FIEL');
    }
  
    if (!user.propioRfc) {
      throw new BadRequestException(
        'No existe un RFC propio registrado. Completa el onboarding primero.'
      );
    }
  
    const rfc = user.propioRfc;
  
    // 3️⃣ Buscar SOLO el cliente propio
    let clienteYo = await this.clientesRepo.findOne({
      where: {
        user_id_relacionado: userId,
        rfc,
      },
    });
  
    // 4️⃣ Rate limit de actualización (24h)
    if (clienteYo?.lastCertificatesUpdate) {
      const diffHours =
        (Date.now() - new Date(clienteYo.lastCertificatesUpdate).getTime()) /
        (1000 * 60 * 60);
  
      if (diffHours < 24) {
        const horasRestantes = (24 - diffHours).toFixed(1);
        throw new BadRequestException(
          `Solo puedes actualizar tus certificados una vez al día. Intenta nuevamente en ${horasRestantes} horas.`
        );
      }
    }
  
    // 5️⃣ Crear carpeta del RFC propio
    const folder = join('./uploads/own-firma', rfc);
    await fs.mkdir(folder, { recursive: true });
  
    // 6️⃣ Limpiar archivos anteriores
    try {
      const oldFiles = await fs.readdir(folder);
      for (const f of oldFiles) {
        await fs.unlink(join(folder, f));
      }
    } catch {}
  
    // 7️⃣ Mover archivos nuevos
    const newCerPath = join(folder, cerFile.filename);
    const newKeyPath = join(folder, keyFile.filename);
  
    await fs.rename(cerFile.path, newCerPath);
    await fs.rename(keyFile.path, newKeyPath);
  
    // 8️⃣ Guardar contraseña FIEL
    const cleanPass = fielPass.replace(/\s+/g, '');
    await fs.writeFile(join(folder, 'fiel.txt'), cleanPass, 'utf-8');
  
    // 9️⃣ Crear o actualizar cliente “Yo”
    if (clienteYo) {
      clienteYo.key_path = '/' + newKeyPath.replace(/\\/g, '/');
      clienteYo.cer_path = '/' + newCerPath.replace(/\\/g, '/');
      clienteYo.fiel = cleanPass;
      clienteYo.lastCertificatesUpdate = new Date();
  
      await this.clientesRepo.save(clienteYo);
    } else {
      clienteYo = this.clientesRepo.create({
        nombre: 'Yo',
        rfc,
        user_id_relacionado: userId,
        key_path: '/' + newKeyPath.replace(/\\/g, '/'),
        cer_path: '/' + newCerPath.replace(/\\/g, '/'),
        fiel: cleanPass,
        lastCertificatesUpdate: new Date(),
      });
  
      await this.clientesRepo.save(clienteYo);
    }
  
    return {
      message: 'Certificados propios actualizados correctamente',
      rfc,
      clienteId: clienteYo.id,
      updatedAt: clienteYo.lastCertificatesUpdate,
    };
  }


  async pauseSync(userId: number, rfc: string) {
    const cliente = await this.clientesRepo.findOne({
      where: { rfc, user_id_relacionado: userId },
    });
  
    if (!cliente) {
      throw new NotFoundException("RFC no encontrado");
    }
  
    cliente.syncPaused = true;
    cliente.syncStatus = "inactivo";
  
    await this.clientesRepo.save(cliente);
  
    return { message: "Descargas automáticas desactivadas", rfc };
  }

  async resumeSync(userId: number, rfc: string) {
    const cliente = await this.clientesRepo.findOne({
      where: { rfc, user_id_relacionado: userId },
    });
  
    if (!cliente) {
      throw new NotFoundException("RFC no encontrado");
    }
  
    cliente.syncPaused = false;
    cliente.syncStatus = "activo";
  
    await this.clientesRepo.save(cliente);
  
    return { message: "Descargas automáticas reactivadas", rfc };
  }

  async resumeSyncMe(userId: number) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
  
    if (!user) throw new NotFoundException("Usuario no encontrado");
  
    const rfc = user.propioRfc;
  
    if (!rfc) {
      throw new BadRequestException(
        "No se encontró un RFC asociado al usuario para sincronización."
      );
    }
  
    // Buscar cliente "Yo"
    const clienteYo = await this.clientesRepo.findOne({
      where: { user_id_relacionado: userId, rfc },
    });

    console.log(clienteYo);
  
    if (!clienteYo) {
      throw new NotFoundException("No se encontró el cliente principal para este usuario.");
    }
  
    // Alternar
    const newPausedState = !clienteYo.syncPaused;
  
    clienteYo.syncPaused = newPausedState;
    clienteYo.syncStatus = newPausedState ? "inactivo" : "activo";
  
    await this.clientesRepo.save(clienteYo);
  
    return {
      message: newPausedState
        ? "Descargas automáticas desactivadas"
        : "Descargas automáticas activadas",
      syncPaused: newPausedState,
      syncStatus: clienteYo.syncStatus,
    };
  }  
}


