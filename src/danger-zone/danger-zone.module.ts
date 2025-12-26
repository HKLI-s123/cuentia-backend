import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { DangerZoneController } from "./danger-zone.controller";
import { DangerZoneService } from "./danger-zone.service";

import { User } from "../users/entities/user.entity";
import { UsersModule } from "src/users/users.module";
import { BillingModule } from "src/billing/billing.module";
import { BillingPaymentModule } from "src/billing-payment/billing-payment.module";
import { Cliente } from "src/clientes/entities/cliente.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Cliente,
    ]),
    UsersModule,
    BillingModule,
    BillingPaymentModule,
  ],
  controllers: [DangerZoneController],
  providers: [DangerZoneService],
  exports: [DangerZoneService],
})
export class DangerZoneModule {}
