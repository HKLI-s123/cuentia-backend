// billing.controller.ts
import { Controller, Get, Post, Body, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { VerifiedGuard } from "../auth/guards/verified.guard";
import { RateLimitGuard } from "src/auth/guards/rate-limit.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { BillingPortalService } from "./billing-portal.service";
import type { AuthRequest } from "src/common/interfaces/auth-request.interface";
// billing/billing-portal.controller.ts


@Controller('billing-portal')
@UseGuards(new RateLimitGuard(60, 60_000), JwtAuthGuard, VerifiedGuard, RolesGuard)
export class BillingPortalController {
  constructor(
    private readonly portalService: BillingPortalService,
  ) {}

  @Post('portal')
  @Roles('owner')
  async createPortalSession(@Req() req: AuthRequest) {
    const userId = req.user.sub;
    return this.portalService.createPortalSession(userId);
  }
}
