import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { ClientesService } from './clientes.service';
import { ClientesController } from './clientes.controller';
import { Cliente } from './entities/cliente.entity';
import { UsersModule } from 'src/users/users.module';
import { User } from "../users/entities/user.entity";
import { EmployeeUser } from "../employee-user/entities/employee-user.entity";
import { EmployeeRfcAccess } from "../employee-user/entities/employee_rfc_access.entity";
import { BillingFeaturesService } from 'src/billing/billing-features.service';
import { BillingSubscription } from 'src/billing-payment/entities/billing-subscriptions.entity';
import { BillingSubscriptionItem } from 'src/billing-payment/entities/billing-subscription-items.entity';
import { BillingInvoiceStripe } from 'src/billing-payment/entities/billing-invoice-stripe.entity';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([Cliente, User, EmployeeRfcAccess, EmployeeUser, BillingSubscription, BillingSubscriptionItem, BillingInvoiceStripe]),
    MulterModule.register({
      dest: './uploads/clientes', 
    }),
  ],
  controllers: [ClientesController],
  providers: [ClientesService, BillingFeaturesService],
  exports: [ClientesService], 
})
export class ClientesModule {}
