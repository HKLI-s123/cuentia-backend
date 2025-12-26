// billing.service.ts
import {
    Injectable,
    NotFoundException,
  } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingPaymentMethod } from './entities/payments.entity';
import { UpdatePaymentMethodDto } from './dto/payment-method.dto';

@Injectable()
export class BillingPaymentService {
  constructor(
    @InjectRepository(BillingPaymentMethod)
    private paymentRepo: Repository<BillingPaymentMethod>
  ) {}

  async getPaymentMethod(userId: number) {
    const pm = await this.paymentRepo.findOne({ where: { userId } });
    return pm ?? null;
  }

  async updatePaymentMethod(userId: number, dto: UpdatePaymentMethodDto) {
    const method = await this.paymentRepo.findOne({ where: { userId } });
  
    if (!method) throw new NotFoundException("Método no encontrado");

    method.metodoPago = dto.metodoPago;
    method.updatedAt = new Date();

    if (dto.metodoPago === "TARJETA") {
    method.stripeCustomerId = dto.stripeCustomerId || null;
    method.stripePaymentMethodId = dto.stripePaymentMethodId || null;
    method.last4 = dto.last4 || null;
    method.brand = dto.brand || null;
    method.expMonth = dto.expMonth || null;
    method.expYear = dto.expYear || null;

    // limpiar transferencia
    method.banco = null;
    method.clabe = null;
    method.referencia = null;
  }

  // ======================
  // CAMBIO A TRANSFERENCIA
  // ======================
  if (dto.metodoPago === "TRANSFERENCIA") {
    method.banco = dto.banco || null;
    method.clabe = dto.clabe || null;
    method.referencia = dto.referencia || null;

    // limpiar tarjeta
    method.stripeCustomerId = null;
    method.stripePaymentMethodId = null;
    method.last4 = null;
    method.brand = null;
    method.expMonth = null;
    method.expYear = null;
  }

  return this.paymentRepo.save(method);
  }

  async deleteUserBilling(userId: number) {
    await this.paymentRepo.delete({ userId });
  }

}
