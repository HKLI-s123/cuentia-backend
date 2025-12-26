// billing/billing-features.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BillingSubscription } from '../billing-payment/entities/billing-subscriptions.entity';
import { BillingSubscriptionItem } from '../billing-payment/entities/billing-subscription-items.entity';
import { BillingInvoiceStripe } from 'src/billing-payment/entities/billing-invoice-stripe.entity';

@Injectable()
export class BillingFeaturesService {
  constructor(
    @InjectRepository(BillingSubscription)
    private readonly subscriptionRepo: Repository<BillingSubscription>,

    @InjectRepository(BillingSubscriptionItem)
    private readonly itemRepo: Repository<BillingSubscriptionItem>,

    @InjectRepository(BillingInvoiceStripe)
    private readonly invoicesStripeRepo: Repository<BillingInvoiceStripe>,
  ) {}

  private PLAN_RFC_LIMITS: Record<string, number> = {
    cuentia_plan_individual: 1,
    cuentia_plan_profesional: 10,
    cuentia_plan_empresarial: 50,
    cuentia_plan_despacho: 300,
  };

  async hasActiveSubscription(userId: number): Promise<boolean> {
    const sub = await this.subscriptionRepo.findOne({
      where: {
        userId,
        status: 'active',
      },
      order: { createdAt: "DESC" },
    });

    return !!sub;
  }

  async getActivePlan(userId: number) {
    const sub = await this.subscriptionRepo.findOne({
      where: { userId },
      order: { createdAt: "DESC" },
    });
  
    if (!sub) {
      return {
        plan: null,
        status: "none",
        currentPeriodEnd: null,
      };
    }
  
    const now = new Date();
    const expired = sub.currentPeriodEnd
      ? new Date(sub.currentPeriodEnd) < now
      : false;

      
    let status: "active" | "expired" | "canceled" | "past_due";
   
    if (sub.status === "canceled") {
      status = "canceled";
    }
    else if (sub.status === "past_due") {
      status = "past_due";
    }
    else if (expired) {
      status = "expired";
    }
    else {
      status = "active";
    }

    let paymentMethod: "card" | "transfer" | null = null;
    
    if (sub.status === "trialing" || sub.planProductId === "cuentia_trial") {
      paymentMethod = null; 
    } else if (sub.planPriceId === "manual_payment") {
      paymentMethod = "transfer";
    } else if (sub.planPriceId) {
      paymentMethod = "card";
    }


      // 🔹 Calcular meses pagados reales
    let paidMonths = 0;
  
    if (sub.stripeSubscriptionId) {
      paidMonths = await this.invoicesStripeRepo.count({
        where: {
          stripeSubscriptionId: sub.stripeSubscriptionId,
          status: "paid",
        },
      });
    }

    const bots = await this.getActiveBots(userId);
  
    return {
      plan: sub.planProductId ?? null,
      status,
      currentPeriodEnd: sub.currentPeriodEnd,
      paymentMethod,
      paidMonths,
      trialEndsAt: sub.trialEndsAt,
      bots,
      billingMode:
       sub.stripeSubscriptionId === 'manual_payment'
         ? 'manual'
         : 'stripe',
    };
  }

  async userHasBot(
    userId: number,
    botProductId: string,
  ): Promise<boolean> {

  const sub = await this.subscriptionRepo.findOne({
    where: { userId, status: 'active' },
    order: { createdAt: "DESC" },
  });


    if (!sub) return false;

    const bot = await this.itemRepo.findOne({
      where: {
        billingSubscriptionId: sub.id,
        productId: botProductId,
        itemType: 'bot',
        active: true,
      },
    });

    return !!bot;
  }

  async getActiveBots(userId: number): Promise<{ priceId: string | null; code: string | null }[]>{
    const sub = await this.subscriptionRepo.findOne({
      where: { userId, status: 'active' },
      order: { createdAt: "DESC" },
    });

    if (!sub) return [];

    const bots = await this.itemRepo.find({
      where: {
        billingSubscriptionId: sub.id,
        itemType: 'bot',
        active: true,
      },
    });

    return bots.map(b => ({
      priceId: b.priceId,
      code: b.code,
      stripeItemId: b.stripeItemId,
    }));  
  }

  async getRfcLimit(userId: number): Promise<number> {
    const sub = await this.subscriptionRepo.findOne({
      where: { userId, status: 'active' },
      order: { createdAt: "DESC" },
    });

    if (!sub || !sub.planProductId) return 0;

    const baseLimit =
      this.PLAN_RFC_LIMITS[sub.planProductId] ?? 0;

    // RFCs extra como addon
    const extras = await this.itemRepo.find({
      where: {
        billingSubscriptionId: sub.id,
        productId: 'cuentia_addon_rfc_extra',
        active: true,
      },
    });

    const extraCount = extras.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );

    return baseLimit + extraCount;
  }


}