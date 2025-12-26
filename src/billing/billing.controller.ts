// billing.controller.ts
import { Controller, Get, Post, Body, Req, UseGuards, Patch, Param, BadRequestException, Delete } from "@nestjs/common";
import { BillingService } from "./billing.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { VerifiedGuard } from "../auth/guards/verified.guard";
import { RateLimitGuard } from "src/auth/guards/rate-limit.guard";
import type { AuthRequest } from "src/common/interfaces/auth-request.interface";
import { UpdateBillingDto } from "./dto/update-billing.dto";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { BillingCheckoutService } from "./billing-checkout.service";
import { BillingFeaturesService } from "./billing-features.service";
import { CustomPlanDto } from "./dto/custom-plan.dto";
import { AdminGuard } from "src/auth/guards/admin-guard";
import { BillingAddonService } from "./billing-addon.service";

@Controller("billing")
@UseGuards(new RateLimitGuard(60, 60_000), JwtAuthGuard, VerifiedGuard, RolesGuard)
export class BillingController {
  constructor(private readonly billingAddonsService: BillingAddonService, private readonly billingService: BillingService, private readonly addonService: BillingAddonService,private readonly checkoutService: BillingCheckoutService,  private readonly billingFeatures: BillingFeaturesService) {}

  @Delete('addon/:stripeItemId')
  removeAddon(
    @Req() req: AuthRequest,
    @Param('stripeItemId') stripeItemId: string,
  ) {
    return this.billingAddonsService.removeAddon(
      req.user.sub,
      stripeItemId,
    );
  }

  @Post('subscribe')
  async subscribe(
    @Req() req : AuthRequest,
    @Body() dto: { priceIds: string[]; intent: 'plan' | 'addon' },
  ) {
    const userId = req.user.sub;
  
    // 🟢 PLAN → Checkout
    if (dto.intent === 'plan') {
      return this.checkoutService.createCheckoutSession(userId, {
        priceIds: dto.priceIds,
      });
    }
  
    // 🔵 ADDON → Subscription API
    if (dto.intent === 'addon') {
      return this.addonService.addAddonToSubscription(
        userId,
        dto.priceIds[0],
      );
    }
  
    throw new BadRequestException('Intent inválido');
  }

  @Get("me-plan")
  async getMyPlan(@Req() req: AuthRequest) {
    const userId = req.user.sub;
    return this.billingFeatures.getActivePlan(userId);
  }

  @Post("custom-request")
  @Roles('owner')
  async customRequest(@Body() dto: CustomPlanDto) {
    return this.billingService.handleCustomPlanRequest(dto);
  }

  @Post("manual-payment")
  @Roles("owner")
  async manualPayment(
    @Req() req: AuthRequest,
    @Body()
    body: {
      code: string;
      kind: "plan" | "bot";
      reference?: string;
    }
  ) {
    const userId = req.user.sub;
  
    const { code, kind, reference } = body;
  
    // 🔐 Validaciones mínimas
    if (!code || !kind) {
      throw new BadRequestException("Datos incompletos para el pago manual");
    }
  
    if (kind !== "plan" && kind !== "bot") {
      throw new BadRequestException("Tipo de pago inválido");
    }
  
    return this.billingService.registerManualPayment(userId, {
      code,
      kind,
      reference: reference ?? null,
    });
  }

    // 🔐 PROTEGIDO POR JWT
  @Post('cancel')
  @Roles('owner')
  async cancelSubscription(@Req() req: AuthRequest) {
    const userId = req.user.sub; // ID real del usuario por JWT

    return await this.billingService.cancelSubscription(userId);
  }


  @Get("info")
  @Roles('owner')
  async getBillingInfo(@Req() req: AuthRequest) {
    return this.billingService.getBillingInfo(req.user.sub);
  }

  @Post("update")
  @Roles('owner')
  async updateBillingInfo(@Req() req: AuthRequest, @Body() dto: UpdateBillingDto) {
    return this.billingService.updateBillingInfo(req.user.sub, dto);
  }

  @Get("invoices")
  @Roles('owner')
  async getInvoices(@Req() req: AuthRequest) {
    return this.billingService.getInvoices(req.user.sub);
  }

  @Post('checkout')
  @Roles('owner')
  async createCheckout(@Req() req: AuthRequest, @Body() body) {
    const userId = req.user.sub;

    return this.checkoutService.createCheckoutSession(
      userId,
      body,
    );
  }

  @Post("change-plan")
  @Roles('owner')
    async changePlan(@Req() req: AuthRequest, @Body() body) {
      const userId = req.user.sub;
      const { newPriceId } = body;
    
      return this.billingService.changePlan(userId, newPriceId);
  }

  @Post("apply-retention-discount")
  @Roles('owner')
  async applyRetentionDiscount(
    @Req() req: AuthRequest,
    @Body() body: { reason: string; customReason?: string }
  ) {
    return this.billingService.applyRetentionDiscount(
      req.user.sub,
      body.reason,
      body.customReason
    );
  }


  @UseGuards(AdminGuard) // Solo administradores
  @Get("manual-payments")
  async list() {
    return this.billingService.listManualPayments();
  }

  @UseGuards(AdminGuard) // Solo administradores
  @Patch("manual-payments/:id/approve")
  async approve(@Param("id") id: number) {
    return this.billingService.approveManualPayment(id);
  }

  @UseGuards(AdminGuard) // Solo administradores
  @Patch("manual-payments/:id/reject")
  async reject(@Param("id") id: number) {
    return this.billingService.rejectManualPayment(id);
  }

}
