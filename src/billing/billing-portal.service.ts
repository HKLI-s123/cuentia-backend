// billing/billing-portal.service.ts
import { Injectable, ForbiddenException } from '@nestjs/common';
import { StripeService } from '../stripe/stripe.service';
import { BillingCustomerService } from './billing-customer.service';

@Injectable()
export class BillingPortalService {
  constructor(
    private readonly stripeService: StripeService,
    private readonly billingCustomerService: BillingCustomerService,
  ) {}

  async createPortalSession(userId: number) {
    const customer =
      await this.billingCustomerService.getOrCreateCustomer(
        userId,
      );

    if (!customer.stripeCustomerId) {
      throw new ForbiddenException(
        'No tienes una suscripción activa',
      );
    }

    const session =
      await this.stripeService.stripe.billingPortal.sessions.create({
        customer: customer.stripeCustomerId,
        return_url: `${process.env.FRONTEND_URL}/configuracion/billing`,
      });

    return { url: session.url };
  }

}
