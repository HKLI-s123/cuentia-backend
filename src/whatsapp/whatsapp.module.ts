// src/whatsapp/whatsapp.module.ts
import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientSession } from './entities/client-session.entity';
import { ClientQrLog } from './entities/client-qr-log.entity';
import { AiModule } from './ai/ai.module';
import { ComprobanteModule } from './comprobantes/comprobante.module'
import { ComprobanteDigitalModule } from './comprobantes-digitales/comprobante-digital.module'
import { ClientesModule } from '../clientes/clientes.module'; 
import { UsersModule } from 'src/users/users.module';
import { BillingSubscription } from 'src/billing-payment/entities/billing-subscriptions.entity';
import { BillingSubscriptionItem } from 'src/billing-payment/entities/billing-subscription-items.entity';
import { User } from 'src/users/entities/user.entity';
import { BillingFeaturesService } from 'src/billing/billing-features.service';
import { BillingInvoiceStripe } from 'src/billing-payment/entities/billing-invoice-stripe.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClientSession, ClientQrLog, BillingSubscription, BillingSubscriptionItem, User, BillingInvoiceStripe]), 
    AiModule,
    ComprobanteModule,
    ComprobanteDigitalModule,
    UsersModule,
    ClientesModule,
  ],
  controllers: [WhatsappController],
  providers: [WhatsappService, BillingFeaturesService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
