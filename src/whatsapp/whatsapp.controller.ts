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
import { Repository } from 'typeorm';
import { BillingSubscriptionItem } from 'src/billing-payment/entities/billing-subscription-items.entity';
import { BillingSubscription } from 'src/billing-payment/entities/billing-subscriptions.entity';
import { BillingService } from 'src/billing/billing.service';
import { User } from 'src/users/entities/user.entity';
import { BillingFeaturesService } from 'src/billing/billing-features.service';

const BOT_CODE_MAP: Record<string, string> = {
  gastos: 'cuentia_bot_gastos',
  ingresos: 'cuentia_bot_ingresos',
};

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

  // ✅ Ahora recibe botType
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

    // 1️⃣ Obtener usuario
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      select: ['tipo_cuenta'],
    });
  
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    console.log("bot typeeee", botType);
  
    // 2️⃣ Obtener info del plan
    const planInfo = await this.billingFeaturesService.getActivePlan(userId);
    const paymentMethod = planInfo?.paymentMethod; // 'stripe' | 'manual_payment' | null
    const hasActivePlan = planInfo?.status === 'active';
  
    // 3️⃣ Validar derecho al bot según tipo de cuenta
      if (user.tipo_cuenta === 'invitado') {
        const sub = await this.subscriptionRepo.findOne({
          where: {
            userId,
            status: 'active',
            planProductId: billingBotCode, // 👈 el bot ES el plan
          },
          order: { createdAt: 'DESC' },
        });
      
        if (!sub) {
          throw new ForbiddenException('Este bot no está contratado');
        }
      } else {
      // 🟠 Individual / Empresa
      if (!hasActivePlan) {
        throw new ForbiddenException('Debes tener un plan activo');
      }
  
      // ❌ Transferencia no permite bots
      if (paymentMethod === 'transfer') {
        throw new ForbiddenException(
          'Los bots requieren pago con tarjeta. Cambia tu método de pago.'
        );
      }
  
      // 🟢 Pago con tarjeta → validar addon
      const sub = await this.subscriptionRepo.findOne({
        where: { userId, status: 'active' },
        order: { createdAt: 'DESC' },
      });
  
      if (!sub) {
        throw new ForbiddenException('No tienes una suscripción activa');
      }
  
      const botItem = await this.itemRepo.findOne({
        where: {
          billingSubscriptionId: sub.id,
          itemType: 'bot',
          code: billingBotCode, // IMPORTANTE: botType debe coincidir con code
          active: true,
        },
      });
  
    if (!botItem) {
      throw new ForbiddenException('Este bot no está contratado');
    }
  }

    const client = this.whatsappService.getClient(clientId, botType);
    const session = await this.whatsappService.getSessionRecord(clientId, botType);

    return {
      contracted: true,
      connected: !!client?.info?.wid,
      hadSession: !!session,
      status: session?.status || 'unknown',
      botType: session?.botType || botType, // Devuelve tipo de bot
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
