// billing.module.ts

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BillingInfo } from "./entities/billing-info.entity";
import { BillingInvoice } from "./entities/billing-invoice.entity";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { UsersModule } from "src/users/users.module";
import { BillingCustomer } from "src/billing-payment/entities/billing-customer.entity";
import { BillingSubscriptionItem } from "src/billing-payment/entities/billing-subscription-items.entity";
import { BillingSubscription } from "src/billing-payment/entities/billing-subscriptions.entity";
import { StripeModule } from "src/stripe/stripe.module";
import { BillingCheckoutService } from "./billing-checkout.service";
import { BillingCustomerService } from "./billing-customer.service";
import { BillingFeaturesService } from "./billing-features.service";
import { EnterpriseLead } from "./entities/enterprise-lead.entity";
import { MailService } from "src/mail/mail.service";
import { ManualPayment } from "./entities/manual-payment.entity";
import { BillingPortalController } from "./billing-portal.controller";
import { BillingPortalService } from "./billing-portal.service";
import { BillingInvoiceStripe } from "src/billing-payment/entities/billing-invoice-stripe.entity";
import { StripeService } from "src/stripe/stripe.service";
import { BillingAddonService } from "./billing-addon.service";
import { User } from "src/users/entities/user.entity";
import { Usage } from "./entities/usage.entity";
import { UsageService } from "./usage.service";
import { NotificationService } from "src/notifications/notification.service";
import { NotificationPreferences } from "src/notifications/entities/notification-preferences.entity";
import { Notification } from "src/notifications/entities/notification.entity";
import { EmployeeUser } from "src/employee-user/entities/employee-user.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BillingInfo,
      BillingInvoice,
      BillingCustomer,
      BillingSubscriptionItem,
      BillingSubscription,
      EnterpriseLead,
      ManualPayment,
      BillingInvoiceStripe,
      Usage,
      NotificationPreferences,
      Notification,
      EmployeeUser,
    ]), 
    UsersModule,
    StripeModule,
  ],
  controllers: [BillingController, BillingPortalController],
  providers: [BillingAddonService,BillingService, BillingCheckoutService, BillingCustomerService, BillingFeaturesService, MailService, BillingPortalService, StripeService, User, UsageService, NotificationService],
  exports: [BillingService, UsageService],
})
export class BillingModule {}
