import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { ComprobanteDigital } from './entities/comprobante-digital.entity';

@Injectable()
export class ComprobanteDigitalService {
  constructor(
    @InjectRepository(ComprobanteDigital)
    private readonly repo: Repository<ComprobanteDigital>,
  ) {}

  create(data: Partial<ComprobanteDigital>) {
    const comprobante = this.repo.create(data);
    return this.repo.save(comprobante);
  }

  findAll() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  findById(id: number) {
    return this.repo.findOneBy({ id });
  }

  async actualizarTipoMovimiento(id: number, tipo_movimiento: 'ingreso' | 'egreso') {
    await this.repo.update(id, { tipo_movimiento });
    return { message: 'Tipo de movimiento actualizado correctamente' };
  }

  async findByUserAndDate(userId: number, fechaInicio?: string, fechaFin?: string) {
    const where: any = { userId };

    if (fechaInicio && fechaFin) {
      where.createdAt = Between(
        new Date(fechaInicio),
        new Date(fechaFin + 'T23:59:59')
      );
    }

    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }
}
