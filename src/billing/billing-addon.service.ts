import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { StripeService } from '../stripe/stripe.service';
import { InjectRepository } from '@nestjs/typeorm';
import { BillingSubscription } from 'src/billing-payment/entities/billing-subscriptions.entity';
import { Repository } from 'typeorm';
import { BillingSubscriptionItem } from 'src/billing-payment/entities/billing-subscription-items.entity';

@Injectable()
export class BillingAddonService {
  constructor(
    private readonly stripeService: StripeService,

    @InjectRepository(BillingSubscription)
    private readonly subscriptionRepo: Repository<BillingSubscription>,

    @InjectRepository(BillingSubscriptionItem)
    private readonly itemRepo: Repository<BillingSubscriptionItem>,
  ) {}

  async addAddonToSubscription(userId: number, priceId: string) {
    const stripe = this.stripeService.stripe;

    // 1️⃣ Obtener sub activa del usuario
    const sub = await this.subscriptionRepo.findOne({
      where: {
        userId,
        status: 'active',
      },
      order: { createdAt: "DESC" },
    });

    if (!sub) {
      throw new BadRequestException(
        'No tienes una suscripción activa para agregar addons',
      );
    }

    // 2️⃣ Agregar item a Stripe
    const item = await stripe.subscriptionItems.create({
      subscription: String(sub.stripeSubscriptionId),
      price: priceId,
      quantity: 1,
    });

    return item;
  }

  async removeAddon(userId: number, stripeItemId: string) {
    const stripe = this.stripeService.stripe;

    console.log("stripeitemid",stripeItemId)

    // 1️⃣ Buscar el item en BD (seguridad)
    const item = await this.itemRepo.findOne({
      where: {
        stripeItemId,
        itemType: 'bot',
        active: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Addon no encontrado o ya cancelado');
    }

    // 2️⃣ Buscar la suscripción dueña
    const subscription = await this.subscriptionRepo.findOne({
      where: {
        id: item.billingSubscriptionId,
      },
    });
  
    if (!subscription) {
      throw new NotFoundException('Suscripción no encontrada');
    }
  
    // 3️⃣ Seguridad: validar dueño
    if (subscription.userId !== userId) {
      throw new ForbiddenException('No autorizado');
    }

    // 2️⃣ Eliminar item en Stripe
    await stripe.subscriptionItems.del(stripeItemId);

    // 3️⃣ Marcar como inactivo en BD
    item.active = false;
    await this.itemRepo.save(item);

    return { ok: true };
  }
}

