import {
  Controller,
  Get,
  Patch,
  Body,
  Req,
  Delete,
  UseGuards,
  Param,
} from "@nestjs/common";
import { NotificationService } from "./notification.service";
import { UpdateNotificationDto } from "./dto/update-notification.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { VerifiedGuard } from "../auth/guards/verified.guard";
import { RateLimitGuard } from "src/auth/guards/rate-limit.guard";
import type { AuthRequest } from "src/common/interfaces/auth-request.interface";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

@Controller("notifications")
@UseGuards(new RateLimitGuard(120, 60_000) ,JwtAuthGuard, VerifiedGuard, RolesGuard)
export class NotificationController {
  constructor(private service: NotificationService) {}

  @Get()
  @Roles('owner')
  async getPrefs(@Req() req: AuthRequest) {
    return this.service.getPreferences(req.user.sub);
  }

  @Patch("update")
  @Roles('owner')
  async update(@Req() req: AuthRequest, @Body() body: UpdateNotificationDto) {
    return this.service.updatePreferences(req.user.sub, body);
  }

  @Get("my")
  async getMyNotifications(@Req() req: AuthRequest) {
    const userId = req.user.sub;
    const type = req.user.type;
    return this.service.findByUser(userId, type);
  }

  @Delete(":id")
  @Roles('employee-admin')
  async deleteNotification(@Param("id") id: number, @Req() req: AuthRequest) {
    const userId = req.user.sub;
    const type = req.user.type;
    return this.service.deleteForUser(id, userId, type);
  }

}
