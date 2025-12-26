import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { SupportService } from './support.service';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthRequest } from 'src/common/interfaces/auth-request.interface';
import { RateLimitGuard } from 'src/auth/guards/rate-limit.guard';
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @UseGuards(new RateLimitGuard(60,60_000),JwtAuthGuard, RolesGuard)
  @Roles("owner")
  @Post()
  async create(@Body() dto: CreateSupportRequestDto, @Req() req: AuthRequest) {
    const userId = req.user.sub;
    return this.supportService.handleSupportRequest(dto, userId);
  }
}
