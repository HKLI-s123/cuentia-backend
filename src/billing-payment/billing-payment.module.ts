import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BillingPaymentMethod } from "./entities/payments.entity";
import { BillingPaymentService } from "./billing-payment.service";
import { BillingPaymentController } from "./billing-payment.controller";
import { UsersModule } from "src/users/users.module";

@Module({
  imports: [TypeOrmModule.forFeature([BillingPaymentMethod]), UsersModule],
  providers: [BillingPaymentService],
  controllers: [BillingPaymentController],
  exports: [BillingPaymentService]
})
export class BillingPaymentModule {}
