// guest-key.service.ts
import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { GuestKey } from './entities/guest-key.entity';
import { Cliente } from '../../clientes/entities/cliente.entity';
import { User } from 'src/users/entities/user.entity';
import { EmployeeUser } from "../../employee-user/entities/employee-user.entity";
import { EmployeeRfcAccess } from "../../employee-user/entities/employee_rfc_access.entity";

@Injectable()
export class GuestKeyService {
  constructor(
    @InjectRepository(GuestKey)
    private repo: Repository<GuestKey>,

    @InjectRepository(Cliente)
    private readonly clientesRepo : Repository<Cliente>,

    @InjectRepository(User)
    private readonly usersRepo : Repository<User>,

    @InjectRepository(EmployeeUser)
    private readonly employeeRepo : Repository<EmployeeUser>,

    @InjectRepository(EmployeeRfcAccess)
    private readonly employeeRfcRepo : Repository<EmployeeRfcAccess>,
  ) {}

  async validateKey(rawKey: string): Promise<{ rfc: string } | null> {
    // 1) calculamos sha256 prefix del key en texto plano
    const sha = crypto.createHash('sha256').update(rawKey).digest('hex');
    const prefix = sha.substring(0, 12);

    // 2) buscamos SOLO keys que tengan ese prefix
    const candidates = await this.repo.find({
      where: { shaPrefix: prefix, isActive: true },
    });

    // 3) si no hay ni una candidata → devolver null sin tocar nada
    if (!candidates.length) {
      return null;
    }

    // 4) intentamos bcrypt a cada candidata no bloqueada
    for (const k of candidates) {
      // skip si bloqueada
      if (k.blockedUntil && k.blockedUntil > new Date()) {
        continue;
      }

      const ok = await bcrypt.compare(rawKey, k.keyHash);
      if (ok && k.isActive) {
        // reseteamos contador
        await this.repo.update(k.id, {
          attempts: 0,
          blockedUntil: null,
        });

        return { rfc: k.rfc };
      }
    }

    // 5) en este punto → hubo candidatas, pero NINGUNA matcheó
    //   por lo tanto, incrementamos attempts SOLO para estas candidatas

    for (const k of candidates) {
      // si ya está bloqueada → no tocar
      if (k.blockedUntil && k.blockedUntil > new Date()) continue;

      const newAttempts = k.attempts + 1;

      if (newAttempts >= 5) {
        // bloquéala SOLO a ella
        await this.repo.update(k.id, {
          attempts: 0, // reset porque empieza nueva “ventana” de bloqueo
          blockedUntil: new Date(Date.now() + 15 * 60 * 1000), // 15 minutos
        });
      } else {
        // solo +1 attempt
        await this.repo.update(k.id, { attempts: newAttempts });
      }
    }

    return null;
  }

  async createKey(rfc: string, userId: number, type: string = "user") {

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

      userId = employee.ownerId ; 
      listaRFCs = assigned.map(a => a.rfc);

      if (!listaRFCs.includes(rfc)) {
        throw new ForbiddenException(
          "No tienes permiso para generar una key para este RFC. 1"
        );
      }
    } else{
      const clientes = await this.clientesRepo.find({
        where: { user_id_relacionado: userId },
        select: ['rfc'],
      });
    
      listaRFCs = clientes.map(c => c.rfc);
    
      // 2️⃣ Validar que el rfcRelacionado enviado pertenece a ese usuario
      if (rfc && !listaRFCs.includes(rfc)) {
        throw new ForbiddenException("No tienes permiso para generar una key para este RFC. 2");
      }
    }

    // 1) generar raw key (tú ajustas como quieras formato)
    const raw = crypto.randomBytes(16).toString('hex'); // ej: 32 chars

    // 2) hash sha256 y extraer prefix
    const sha = crypto.createHash('sha256').update(raw).digest('hex');
    const prefix = sha.substring(0, 12);

    // 3) bcrypt
    const hash = await bcrypt.hash(raw, 11);

    await this.repo.update(
      { userId, rfc, isActive: true },
      { isActive: false, revokedAt: new Date() }
    );

   const invited = await this.usersRepo.findOne({
     where: { guestRfc: rfc, tipo_cuenta: 'invitado' }
   });
   
   if (invited) {
     await this.usersRepo.update(
       { id: invited.id },
       { guestRfc: null }
     );
   }

    // 4) persistimos
    const row = this.repo.create({
      shaPrefix: prefix,
      keyHash: hash,
      rfc,
      userId,
      attempts: 0,
      blockedUntil: null,
      isActive: true,
      revokedAt: null,
    });

    await this.repo.save(row);

    console.log('RAW KEY GENERATED:', raw, 'owner:', userId, 'rfc:', rfc);
    // 5) devolvemos raw key al front
    return {
      key: raw,
      rfc,
    };
  }
}
