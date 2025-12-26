import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CfdiController } from './cfdi.controller';
import { CfdiService } from './cfdi.service';
import { Cfdi } from './entities/cfdi.entity';
import { PagosCfdi } from './entities/pagos-cfdi.entity'; // <-- asegúrate de la ruta
import { NotasCreditoCfdi } from './entities/notas-credito.entity'; // <-- asegúrate de la ruta
import { ConceptosCfdi } from './entities/conceptos_cfdis.entity'; // <-- asegúrate de la ruta
import { AnalisisFacturasIa } from "./entities/factura-ia-analisis.entity";
import { Cliente } from "../clientes/entities/cliente.entity";
import { EmployeeUser } from "../employee-user/entities/employee-user.entity";
import { EmployeeRfcAccess } from "../employee-user/entities/employee_rfc_access.entity";
import { UsersModule } from 'src/users/users.module';
import { ClientesModule } from 'src/clientes/clientes.module';
import { BillingFeaturesService } from 'src/billing/billing-features.service';
import { BillingSubscription } from 'src/billing-payment/entities/billing-subscriptions.entity';
import { BillingSubscriptionItem } from 'src/billing-payment/entities/billing-subscription-items.entity';
import { BillingInvoiceStripe } from 'src/billing-payment/entities/billing-invoice-stripe.entity';

@Module({
  imports: [ClientesModule,UsersModule,TypeOrmModule.forFeature([Cfdi, PagosCfdi, NotasCreditoCfdi, ConceptosCfdi, AnalisisFacturasIa, Cliente, EmployeeUser, EmployeeRfcAccess, BillingSubscription, BillingSubscriptionItem, BillingInvoiceStripe])], // <-- agregar PagosCfdi aquí
  controllers: [CfdiController],
  providers: [CfdiService, BillingFeaturesService],
  exports: [CfdiService], // 👈 importante para que otros módulos lo usen
})
export class CfdiModule {}
