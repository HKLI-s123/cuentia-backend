import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { CfdiModule } from '../cfdi/cfdi.module'; 
import { Cliente } from '../clientes/entities/cliente.entity'; 
import { UsersModule } from 'src/users/users.module';
import { ClientesModule } from 'src/clientes/clientes.module';
import { EmployeeUser } from "../employee-user/entities/employee-user.entity";
import { EmployeeRfcAccess } from "../employee-user/entities/employee_rfc_access.entity";
import { BillingFeaturesService } from 'src/billing/billing-features.service';
import { UsageService } from 'src/billing/usage.service';
import { BillingSubscription } from 'src/billing-payment/entities/billing-subscriptions.entity';
import { BillingSubscriptionItem } from 'src/billing-payment/entities/billing-subscription-items.entity';
import { BillingInvoiceStripe } from 'src/billing-payment/entities/billing-invoice-stripe.entity';
import { Usage } from 'src/billing/entities/usage.entity';

@Module({
  imports: [CfdiModule, UsersModule, ClientesModule ,TypeOrmModule.forFeature([Cliente, EmployeeRfcAccess, EmployeeUser, BillingSubscription, BillingSubscriptionItem, BillingInvoiceStripe, Usage])],
  controllers: [ChatController],
  providers: [ChatService, BillingFeaturesService, UsageService],
})
export class ChatModule {}
