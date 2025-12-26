// src/users/users.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  findById(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }

  findByUsername(username: string) {
    return this.repo.findOne({ where: { username } });
  }

  async create(user: Partial<User>) {
    const entity = this.repo.create(user);
    return this.repo.save(entity);
  }

  async update(id: number, data: Partial<User>) {
    await this.repo.update({ id }, data);
    console.log(this.findById(id));
    return this.findById(id);
  }
  
    // users.service.ts
  async setGuestAccess(userId: number, rfc: string, type: string = "user") {
    if (!rfc) {
      throw new BadRequestException("Debe enviarse un RFC válido para activar acceso invitado.");
    }
  
    // Verificar que el usuario existe
    const user = await this.repo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Usuario no encontrado.");
    }
  
    // Guardar datos de acceso invitado
    user.guestRfc = rfc;
    user.updatedAt = new Date();
  
    // Opcional: si quieres resetear accesos previos
    // user.someOtherField = null;
  
    await this.repo.save(user);
  
    return {
      success: true,
      guestRfc: rfc,
      message: "Acceso invitado activado correctamente."
    };
  }

}
