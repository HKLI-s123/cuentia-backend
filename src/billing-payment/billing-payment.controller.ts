// billing.controller.ts
import { Controller, Get, Post, Body, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { VerifiedGuard } from "../auth/guards/verified.guard";
import type { AuthRequest } from "src/common/interfaces/auth-request.interface";
import { BillingPaymentService } from "./billing-payment.service";
import { UpdatePaymentMethodDto } from "./dto/payment-method.dto";
import { RateLimitGuard } from "src/auth/guards/rate-limit.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

@Controller("billing/payment")
@UseGuards(new RateLimitGuard(60, 60_000), JwtAuthGuard, VerifiedGuard, RolesGuard)
export class BillingPaymentController {

  constructor(private readonly billingPaymentService: BillingPaymentService) {}

  @Get("me")
  @Roles('owner') 
  async getPaymentMethod(@Req() req: AuthRequest) {
    return await this.billingPaymentService.getPaymentMethod(req.user.sub);
  }
  
  @Post("update-method")
  @Roles('owner')
  async updatePaymentMethod(
    @Req() req: AuthRequest,
    @Body() body: UpdatePaymentMethodDto,
  ) {

    Object.keys(body).forEach((key) => {
     if (body[key] === "" || body[key] === null) {
       delete body[key];
     }
   });

    const userId = req.user.sub;
    return this.billingPaymentService.updatePaymentMethod(userId, body);
  }
  
}
