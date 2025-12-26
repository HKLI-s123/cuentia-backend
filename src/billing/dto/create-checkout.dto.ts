// billing/dto/create-checkout.dto.ts
import Stripe from 'stripe';

export class CreateCheckoutDto {
  priceIds: string[];

  mode?: Stripe.Checkout.SessionCreateParams.Mode;
}