// billing/billing-customer.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';

import { BillingCustomer } from '../billing-payment/entities/billing-customer.entity';
import { StripeService } from '../stripe/stripe.service';

@Injectable()
export class BillingCustomerService {
  constructor(
    private readonly stripeService: StripeService,
    @InjectRepository(BillingCustomer)
    private readonly customerRepo: Repository<BillingCustomer>,
  ) {}

  async getOrCreateCustomer(userId: number) {
    let customer = await this.customerRepo.findOne({
      where: { userId },
    });

    if (customer?.stripeCustomerId) return customer;

    const stripeCustomer =
      await this.stripeService.stripe.customers.create({
        metadata: { userId: String(userId) },
      });

    if (!customer) {
      customer = this.customerRepo.create({
        userId,
        stripeCustomerId: stripeCustomer.id,
      });
    } else {
      customer.stripeCustomerId = stripeCustomer.id;
    }

    return this.customerRepo.save(customer);
  }
}
