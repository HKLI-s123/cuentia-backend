import { Controller, Delete, Post, Body, UseGuards, Req } from "@nestjs/common";
import { DangerZoneService } from "./danger-zone.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RateLimitGuard } from "src/auth/guards/rate-limit.guard";
import { VerifiedGuard } from "src/auth/guards/verified.guard";
import type { AuthRequest } from "src/common/interfaces/auth-request.interface";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

@Controller("danger-zone")
@UseGuards(new RateLimitGuard(60,60_000), JwtAuthGuard, VerifiedGuard, RolesGuard)
export class DangerZoneController {
  constructor(private readonly service: DangerZoneService) {}

  @Delete("delete-account")
  @Roles('owner')
  async deleteAccount(@Req() req: AuthRequest, @Body() body: { password?: string }) {
    const userId = req.user.sub;
    return this.service.deleteAccount(userId, body.password);
  }
}
