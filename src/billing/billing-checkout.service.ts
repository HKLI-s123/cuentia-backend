// billing/billing-checkout.service.ts
import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { StripeService } from '../stripe/stripe.service';
import { BillingCustomerService } from './billing-customer.service';

@Injectable()
export class BillingCheckoutService {
  constructor(
    private readonly stripeService: StripeService,
    private readonly billingCustomerService: BillingCustomerService,
  ) {}

  async createCheckoutSession(
    userId: number,
    dto: { priceIds: string[]; mode?: string },
  ) {
    const stripe = this.stripeService.stripe;

    // ===============================
    // 1️⃣ Obtener / crear customer
    // ===============================
    const customer =
      await this.billingCustomerService.getOrCreateCustomer(
        userId,
      );

    // ===============================
    // 2️⃣ Construir line items
    // ===============================
    const lineItems = dto.priceIds.map((priceId) => ({
      price: priceId,
      quantity: 1,
    }));

    // ===============================
    // 3️⃣ Crear checkout
    // ===============================
    const mode: Stripe.Checkout.SessionCreateParams.Mode = 'subscription';
    
    const params: Stripe.Checkout.SessionCreateParams = {
      mode,
      customer: customer.stripeCustomerId!,
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: `${process.env.FRONTEND_URL}/billing/success`,
      cancel_url: `${process.env.FRONTEND_URL}/plans`,
      metadata: {
        userId: String(userId),
      },
    };
    
    const session = await stripe.checkout.sessions.create(params);

    return { url: session.url };
  }
}
