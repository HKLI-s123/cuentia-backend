// stripe/stripe-webhook.controller.ts
import {
  Controller,
  Post,
  Req,
  Res,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import Stripe from 'stripe';
import { StripeService } from './stripe.service';
import { BillingService } from '../billing/billing.service';

@Controller('stripe/webhook')
export class StripeWebhookController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly billingService: BillingService,
  ) {}

  @Post()
  async handleWebhook(@Req() req: Request, @Res() res: Response) {

    const sig = req.headers['stripe-signature'];
    let event: Stripe.Event;

    try {
      event = this.stripeService.stripe.webhooks.constructEvent(
        req.body,
        sig!,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch (err: any) {
      console.error('⚠️ Webhook signature failed.', err.message);
      return res.status(HttpStatus.BAD_REQUEST).send('Invalid signature');
    }

    console.log("📩 Evento recibido:", event.type);

    // 🔁 Manejo por tipo de evento
    try {
      switch (event.type) {

        case 'checkout.session.completed':
          await this.billingService.handleCheckoutCompleted(
            event.data.object as Stripe.Checkout.Session
          );
          break;

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.billingService.syncSubscription(
            event.data.object as Stripe.Subscription
          );
          break;

        case 'invoice.payment_succeeded':
          await this.billingService.handlePaymentSucceeded(
            event.data.object as Stripe.Invoice
          );
          break;

        case 'invoice.payment_failed':
          await this.billingService.handlePaymentFailed(
            event.data.object as Stripe.Invoice
          );
          break;

        default:
          console.log(`Unhandled event: ${event.type}`);
      }
    } catch (err) {
      console.error('🚨 Webhook handler error:', err);
      return res.status(500).send('Webhook error');
    }

    res.status(HttpStatus.OK).json({ received: true });
  }
}
