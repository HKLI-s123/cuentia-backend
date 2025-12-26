// stripe/stripe.module.ts
import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { StripeWebhookController } from './stripe-webhook-controller';
import { BillingService } from 'src/billing/billing.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingInfo } from 'src/billing/entities/billing-info.entity';
import { BillingInvoice } from 'src/billing/entities/billing-invoice.entity';
import { BillingCustomer } from 'src/billing-payment/entities/billing-customer.entity';
import { BillingSubscription } from 'src/billing-payment/entities/billing-subscriptions.entity';
import { BillingSubscriptionItem } from 'src/billing-payment/entities/billing-subscription-items.entity';
import { EnterpriseLead } from 'src/billing/entities/enterprise-lead.entity';
import { MailService } from 'src/mail/mail.service';
import { ManualPayment } from 'src/billing/entities/manual-payment.entity';
import { BillingInvoiceStripe } from 'src/billing-payment/entities/billing-invoice-stripe.entity';
import { User } from 'src/users/entities/user.entity';
import { BillingFeaturesService } from 'src/billing/billing-features.service';
import { NotificationService } from 'src/notifications/notification.service';
import { NotificationPreferences } from 'src/notifications/entities/notification-preferences.entity';
import { Notification } from 'src/notifications/entities/notification.entity';
import { EmployeeUser } from 'src/employee-user/entities/employee-user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BillingInfo,BillingInvoice, BillingCustomer, BillingSubscription, BillingSubscriptionItem, EnterpriseLead, ManualPayment, BillingInvoiceStripe, User, NotificationPreferences, Notification, EmployeeUser])], // <-- agregar PagosCfdi aquí
  controllers: [StripeWebhookController],
  providers: [StripeService, BillingService, MailService, BillingFeaturesService, NotificationService],
  exports: [StripeService],
})
export class StripeModule {}
