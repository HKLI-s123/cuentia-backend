// guest-key.controller.ts
import { Body, Controller, Post, HttpException, HttpStatus, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { GuestKeyService } from './guest-key.service';
import { UsersService } from '../../users/users.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RateLimitGuard } from '../../auth/guards/rate-limit.guard';
import type { AuthRequest } from 'src/common/interfaces/auth-request.interface';
import { OnboardingGuard } from 'src/auth/guards/onboarding.guard';
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";

@Controller('guest')
export class GuestKeyController {
  constructor(private readonly service: GuestKeyService, private readonly usersService: UsersService) {}

 @UseGuards(new RateLimitGuard(60, 60_000), JwtAuthGuard, OnboardingGuard) // 20 intentos por minuto
 @Post('validate')
 async validate(@Body() body: { key: string }) {
   if (!body.key) throw new HttpException('missing key', HttpStatus.BAD_REQUEST);

   const result = await this.service.validateKey(body.key);

   if (!result) throw new HttpException('invalid key', HttpStatus.UNAUTHORIZED);

   return result; // { rfc: "..." }
   }

 @UseGuards(new RateLimitGuard(60, 60_000), JwtAuthGuard, OnboardingGuard, RolesGuard)
 @Post('create')
 @Roles('employee-admin')
 async create(@Body() body: { rfc: string },  @Req() req: AuthRequest) {
   const userId =  req.user.sub; // ejemplo si usas jwt con { sub: userId }
   const type =  req.user.type; // ejemplo si usas jwt con { sub: userId }
   return this.service.createKey(body.rfc, userId, type);
 }

 @Post('activate')
 @UseGuards(new RateLimitGuard(60, 60_000), JwtAuthGuard, OnboardingGuard)
  async activateGuestAccess(
    @Body('rfc') rfc: string,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    const type =  req.user.type; // ejemplo si usas jwt con { sub: userId }

    await this.usersService.setGuestAccess(userId, rfc, type);

    return { success: true };
  }

}
