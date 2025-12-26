import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Comprobante } from './entities/comprobante.entity';

@Injectable()
export class ComprobanteService {
  constructor(
    @InjectRepository(Comprobante)
    private readonly repo: Repository<Comprobante>,
  ) {}

  create(data: Partial<Comprobante>) {
    const comprobante = this.repo.create(data);
    return this.repo.save(comprobante);
  }

  findAll() {
    return this.repo.find();
  }

  findById(id: number) {
    return this.repo.findOneBy({ id });
  }

  async findByUserAndDate(userId: number, fechaInicio?: string, fechaFin?: string) {
    const where: any = { userId };

    console.log(where);
  
    if (fechaInicio && fechaFin) {
      where.createdAt = Between(new Date(fechaInicio), new Date(fechaFin + 'T23:59:59'));
    }
  
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

}
