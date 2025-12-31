// src/whatsapp/whatsapp.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { WhatsappService } from './whatsapp.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimitGuard } from '../auth/guards/rate-limit.guard';
import type { AuthRequest } from 'src/common/interfaces/auth-request.interface';
import { VerifiedGuard } from 'src/auth/guards/verified.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientSession } from './entities/client-session.entity';
import { In, Repository } from 'typeorm';
import { BillingSubscriptionItem } from 'src/billing-payment/entities/billing-subscription-items.entity';
import { BillingSubscription } from 'src/billing-payment/entities/billing-subscriptions.entity';
import { User } from 'src/users/entities/user.entity';
import { BillingFeaturesService } from 'src/billing/billing-features.service';

const BOT_CODE_MAP: Record<string, string> = {
  gastos: 'cuentia_bot_gastos',
  ingresos: 'cuentia_bot_ingresos',
};

const USABLE_SUBSCRIPTION_STATUSES = [
  'free',
  'trialing',
  'active',
  'past_due',
];

@Controller('whatsapp')
export class WhatsappController {
  constructor(    
    @InjectRepository(ClientSession)
    private readonly clientSessionRepo: Repository<ClientSession>,

    @InjectRepository(BillingSubscriptionItem)
     private readonly itemRepo: Repository<BillingSubscriptionItem>,

    @InjectRepository(BillingSubscription)
    private readonly subscriptionRepo: Repository<BillingSubscription>,

    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,

    private readonly whatsappService: WhatsappService,
    
    private readonly billingFeaturesService: BillingFeaturesService,
  ) 
    {}

  @Post('create')
  @UseGuards(new RateLimitGuard(60, 60_000), JwtAuthGuard, VerifiedGuard )
  async createSession(
    @Req() req: AuthRequest,
    @Body('clientId') clientId: string,
    @Body('botType') botType: string, // ✅ Nuevo
  ) {
    const userIdLog = req.user.sub;
    // 🚨 Validación de identidad
    if (clientId !== `${botType}-${userIdLog}`) {
      throw new UnauthorizedException("No puedes iniciar sesiones de otros usuarios");
    }
    return await this.whatsappService.createSession(clientId, botType, userIdLog);
  }

  @Post('reconnect')
  @UseGuards(new RateLimitGuard(60, 60_000), JwtAuthGuard, VerifiedGuard)
  async reconnect(
    @Req() req: AuthRequest,
    @Body('clientId') clientId: string,
    @Body('botType') botType: string, // ✅ Nuevo
  ) {
    const userIdLog = req.user.sub;
    // 🚨 Validación de identidad
    if (clientId !== `${botType}-${userIdLog}`) {
      throw new UnauthorizedException("No puedes iniciar sesiones de otros usuarios");
    }
    return this.whatsappService.reconnectSession(clientId, botType,userIdLog);
  }

  @Get('sessions')
  @UseGuards(new RateLimitGuard(60, 60_000), JwtAuthGuard, VerifiedGuard)
  listSessions() {
    return this.whatsappService.listSessions();
  }

  @Get('status/:clientId/:botType')
  @UseGuards(new RateLimitGuard(100, 60_000), JwtAuthGuard)
  async getStatus(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
    @Param('botType') botType: string,
  ) {
    const userId = req.user.sub;
  
    const BOT_TYPE_TO_BILLING_CODE: Record<string, string> = {
      gastos: 'cuentia_bot_gastos',
      'comprobantes-digitales': 'cuentia_bot_comprobantes',
    };
  
    const billingBotCode = BOT_TYPE_TO_BILLING_CODE[botType];
  
    if (!billingBotCode) {
      throw new BadRequestException('Tipo de bot inválido');
    }
  
    // 1️⃣ Usuario
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      select: ['tipo_cuenta'],
    });
  
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
  
    // 2️⃣ Suscripción usable
    const sub = await this.subscriptionRepo.findOne({
      where: {
        userId,
        status: In(USABLE_SUBSCRIPTION_STATUSES),
      },
      order: { createdAt: 'DESC' },
    });
  
    if (!sub) {
      throw new ForbiddenException('No tienes un plan activo');
    }
  
    let hasBotAccess = false;
  
    /**
     * 3️⃣ Validación de acceso al bot
     */

    console.log(botType);
  
    // 🟣 INVITADO → bots como plan
    if (user.tipo_cuenta === 'invitado') {
      const INVITED_ALLOWED_PLANS: Record<string, string[]> = {
        cuentia_bot_gastos: [
          'cuentia_bot_gastos',
          'cuentia_start_bots',
          'cuentia_trial',
        ],
        cuentia_bot_comprobantes: [
          'cuentia_bot_comprobantes',
          'cuentia_start_bots',
          'cuentia_trial',
        ],
      };
  
      hasBotAccess = INVITED_ALLOWED_PLANS[billingBotCode]?.includes(
        sub.planProductId || '',
      );
    }
  
    // 🔵 INDIVIDUAL / EMPRESARIAL
    else {
      // ✅ TRIAL → bots incluidos
      if (sub.status === 'trialing') {
        hasBotAccess = true;
      } else {
        // 🔒 FUERA DE TRIAL → bots como add-ons
        const botItem = await this.itemRepo.findOne({
          where: {
            billingSubscriptionId: sub.id,
            code: billingBotCode,
            active: true,
          },
        });
  
        hasBotAccess = !!botItem;
      }
    }
  
    if (!hasBotAccess) {
      throw new ForbiddenException('Este bot no está contratado');
    }
  
    /**
     * 4️⃣ Construcción de respuesta (SIEMPRE)
     */
    const client = this.whatsappService.getClient(clientId, botType);
    const session = await this.whatsappService.getSessionRecord(clientId, botType);
  
    return {
      contracted: true,
      connected: !!client?.info?.wid,
      hadSession: !!session,
      status: session?.status || 'unknown',
      botType: session?.botType || botType,
    };
  }


  @Get('qr/:clientId/:botType')
  @UseGuards(new RateLimitGuard(60, 60_000))
  async sendQr(
    @Param('clientId') clientId: string,
    @Param('botType') botType: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const client = this.whatsappService.getClient(clientId, botType);
    if (client?.info?.wid) {
      res.write(`data: ${JSON.stringify({ connected: true })}\n\n`);
    }

    this.whatsappService.subscribeToQr(clientId, botType, (qrImage) => {
      res.write(`data: ${JSON.stringify({ qr: qrImage })}\n\n`);
    });

    req.on('close', () => {
      res.end();
    });
  }

  @Get('qr-limit/:clientId/:botType')
  @UseGuards(new RateLimitGuard(60, 60_000), JwtAuthGuard, VerifiedGuard)
  async getQrLimit(
    @Req() req: AuthRequest,
    @Param('clientId') clientId: string,
    @Param('botType') botType: string,
  ) {
    const userId = req.user.sub;
    // 🚨 Validación de identidad
    if (clientId !== `${botType}-${userId}`) {
      throw new UnauthorizedException("No puedes iniciar sesiones de otros usuarios");
    }

    const canGenerate = await this.whatsappService.canGenerateQr(clientId, botType);
    return { canGenerate };
  }

  @Get("status")
  @UseGuards(new RateLimitGuard(300, 60_000), JwtAuthGuard)
  async getStatusC(@Req() req: AuthRequest) {
    const userId = req.user.sub;

    const clientId = 'client-recibos-'+userId;
  
    const bots = await this.clientSessionRepo.find({
      where: { clientId },
      order: { updatedAt: "DESC" },
    });

    console.log(clientId);
  
    // Estructura frontend
    const result = bots.map(b => ({
      botType: b.botType,
      connected: b.status,
      lastConnection: b.updatedAt,
    }));
  
    return { bots: result };
  }

  // whatsapp.controller.ts

  @Get('config')
  @UseGuards(new RateLimitGuard(60, 60_000), JwtAuthGuard, VerifiedGuard)
  async getBotConfig(@Req() req: AuthRequest) {
    const userId = req.user.sub;
    return this.whatsappService.getBotConfig(userId);
  }
  
}
