// src/whatsapp/whatsapp.service.ts
import { BadRequestException, ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Client, LocalAuth } from 'whatsapp-web.js';
import { ClientSession } from './entities/client-session.entity';
import { ClientQrLog } from './entities/client-qr-log.entity';
import { Repository, MoreThan, In } from 'typeorm';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as qrcode from 'qrcode';
import { AiService } from './ai/ai.service';
import { ComprobanteService } from './comprobantes/comprobante.service';
import { ComprobanteDigitalService } from './comprobantes-digitales/comprobante-digital.service';
import { BillingFeaturesService } from 'src/billing/billing-features.service';
import { User } from 'src/users/entities/user.entity';
import { BillingSubscriptionItem } from 'src/billing-payment/entities/billing-subscription-items.entity';
import { BillingSubscription } from 'src/billing-payment/entities/billing-subscriptions.entity';

//function sanitizeAmount(value: any): number {
//  if (value === null || value === undefined) return 0;
//
//  let str = value.toString().trim();
//
//  // 1) Detectar formato negativo tipo "(123.45)"
//  const isNegative = str.includes("(") && str.includes(")");
//
//  // 2) Remover todo excepto dígitos y punto decimal
//  str = str.replace(/[^0-9.,-]/g, "");
//
//  // 3) Unificar formatos tipo "1.234,56" → "1234.56"
//  if (str.includes(",") && str.includes(".")) {
//    // Si tiene ambos, asumir que la coma es decimal (formato europeo)
//    if (str.lastIndexOf(",") > str.lastIndexOf(".")) {
//      str = str.replace(/\./g, "").replace(",", ".");
//    }
//  } else {
//    // Si solo tiene coma → decimal
//    if (str.includes(",") && !str.includes(".")) {
//      str = str.replace(",", ".");
//    }
//  }
//
//  // 4) Doble signo negativo
//  str = str.replace(/--+/g, "-");
//
//  // 5) Convertir a número
//  let num = parseFloat(str);
//  if (isNaN(num)) num = 0;
//
//  // 6) Aplicar negativo si era "(xxx)"
//  if (isNegative) num = num * -1;
//
//  return num;
//}

const USABLE_SUBSCRIPTION_STATUSES = [
  'free',
  'trialing',
  'active',
  'past_due',
];

const INVITED_ALLOWED_PLANS: Record<string, string[]> = {
  cuentia_bot_gastos: [
    'cuentia_bot_gastos',
    'cuentia_start_bots_2',
    'cuentia_trial',
  ],
  cuentia_bot_comprobantes: [
    'cuentia_bot_comprobantes',
    'cuentia_start_bots_2',
    'cuentia_trial',
  ],
};

@Injectable()
export class WhatsappService {
  constructor(
    @InjectRepository(ClientSession)
    private readonly clientSessionRepo: Repository<ClientSession>,
    @InjectRepository(ClientQrLog)
    private readonly qrLogRepo: Repository<ClientQrLog>,

    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,

    @InjectRepository(BillingSubscriptionItem)
     private readonly itemRepo: Repository<BillingSubscriptionItem>,
    
    @InjectRepository(BillingSubscription)
    private readonly subscriptionRepo: Repository<BillingSubscription>,

    private readonly aiService: AiService,
    private readonly comprobanteService: ComprobanteService,
    private readonly comprobanteDigitalService: ComprobanteDigitalService,
    private readonly billingFeaturesService: BillingFeaturesService,
  ) {}

  private readonly logger = new Logger(WhatsappService.name);
  private sessions: Map<string, Client> = new Map();
  private qrSubscribers: Map<string, Function[]> = new Map();
  private qrTimeouts: Map<string, NodeJS.Timeout> = new Map();

  private extractUserIdFromClientId(clientId: string): number | null {
    if (!clientId) return null;
    const last = clientId.split('-').pop();
    const parsed = Number(last);
    return isNaN(parsed) ? null : parsed;
  }

  private async safeGetContact(msg: any) {
    try {
      return await msg.getContact();
    } catch (e) {
      // WhatsApp Web fallback
      const raw: any = msg?._data || {};
  
      return {
        pushname: raw.notifyName || "Desconocido",
        verifiedName: raw.verifiedName || null,
        name: raw.name || null,
        id: {
          user: raw.id?.participant || msg.from || null
        }
      };
    }
  }

  async validateBotAccess(
    userId: number,
    botType: string,
  ) {

    const BOT_TYPE_TO_BILLING_CODE: Record<string, string> = {
      gastos: 'cuentia_bot_gastos',
      'comprobantes-digitales': 'cuentia_bot_comprobantes',
    };

    const billingBotCode = BOT_TYPE_TO_BILLING_CODE[botType];
  
    if (!billingBotCode) {
      throw new BadRequestException('Tipo de bot inválido');
    }
  
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      select: ['tipo_cuenta'],
    });
  
    if (!user) {
      throw new UnauthorizedException();
    }
  
    // 🔍 Buscar suscripción activa
    const sub = await this.subscriptionRepo.findOne({
      where: { userId, status: In(USABLE_SUBSCRIPTION_STATUSES),},
      order: { createdAt: 'DESC' },
    });
  
    if (!sub) {
      throw new ForbiddenException('No tienes una suscripción activa');
    }
  
    const isManualPayment = sub.stripeSubscriptionId === 'manual_payment';
  

    // 🟣 INVITADO → bots como plan
    if (user.tipo_cuenta === 'invitado') {
      const allowedPlans = INVITED_ALLOWED_PLANS[billingBotCode];
  
      if (!allowedPlans.includes(sub.planProductId || "")) {
        throw new ForbiddenException('Este bot no está contratado');
      }
  
      return true;
    }
  
    // 🔵 INDIVIDUAL / EMPRESA
    if (isManualPayment) {
      throw new ForbiddenException(
        'Los bots requieren un plan con pago automático (tarjeta)',
      );
    }
  
    // ✅ TRIAL → bots incluidos
    if (sub.status === 'trialing') {
      return true;
    }

    const item = await this.itemRepo.findOne({
      where: {
        billingSubscriptionId: sub.id,
        code: billingBotCode,
        active: true,
      },
    });
  
    if (!item) {
      throw new ForbiddenException('Este bot no está contratado');
    }
  
    return true;
  }

  
  // ------------------------------------------------------------
  // 🔐 Límite de QR diarios
  // ------------------------------------------------------------
  async canGenerateQr(clientId: string, botType: string): Promise<boolean> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const count = await this.qrLogRepo.count({
      where: { clientId, botType, createdAt: MoreThan(today) },
    });

    console.log(count);

    return count < 10;
  }

  // ------------------------------------------------------------
  // 🧩 Crear sesión con botType
  // ------------------------------------------------------------
  async createSession(clientId: string, botType: string, userIdLog: number) {
    await this.validateBotAccess(userIdLog, botType);

    const sessionKey = `${clientId}_${botType}`;
    if (this.sessions.has(sessionKey)) {
      return { message: 'Sesión ya existente', clientId, botType };
    }

    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: `client_${sessionKey}`,
        dataPath: './sessions',
      }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    });

    // ======================================================
    // QR
    // ======================================================
    client.on('qr', async (qr) => {
      if (!client.info?.wid) {
        const canGenerate = await this.canGenerateQr(clientId, botType);
        if (!canGenerate) {
          this.logger.warn(`Usuario ${clientId} (${botType}) alcanzó límite diario de QR`);
          this.emitQr(clientId, botType, { error: 'Límite diario de QR alcanzado' });
          return;
        }

        await this.qrLogRepo.save({ clientId, botType });
        const qrImage = await qrcode.toDataURL(qr);
        this.logger.log(`QR generado para ${sessionKey}`);
        this.emitQr(clientId, botType, { qr: qrImage });

        if (!this.qrTimeouts.has(sessionKey)) {
          const timeout = setTimeout(async () => {
            this.logger.warn(`⏰ Se excedió el tiempo de QR para ${sessionKey}`);
            this.emitQr(clientId, botType, { error: 'Tiempo máximo de QR excedido' });

            try {
              await client.destroy();
            } catch (err) {
              this.logger.error(err);
            }

            this.sessions.delete(sessionKey);
            const sessionPath = path.join('./sessions', `client_${sessionKey}`);
            await fs.remove(sessionPath).catch((err) => this.logger.error(err));
            this.qrTimeouts.delete(sessionKey);
          }, 180000); // 3 minutos

          this.qrTimeouts.set(sessionKey, timeout);
        }
      }
    });

    // ======================================================
    // READY
    // ======================================================
    client.on('ready', async () => {
      this.logger.log(`✅ Cliente ${sessionKey} conectado`);

      const timeout = this.qrTimeouts.get(sessionKey);
      if (timeout) {
        clearTimeout(timeout);
        this.qrTimeouts.delete(sessionKey);
      }

      const info = client.info;

      let session = await this.clientSessionRepo.findOne({ where: { clientId, botType } });
    
      if (session) {
        session.status = 'active';
        session.updatedAt = new Date();
        session.whatsappNumber = info?.wid?.user;
        session.pushName = info?.pushname;
        session.platform = info?.platform;
        await this.clientSessionRepo.save(session);
      } else {
        session = this.clientSessionRepo.create({
          clientId,
          botType,
          status: 'active',
        });
        await this.clientSessionRepo.save(session);
      }

      this.emitQr(clientId, botType, { connected: true });
    });

    // ======================================================
    // DISCONNECTED
    // ======================================================
    client.on('disconnected', async (reason) => {
      this.logger.warn(`⚠️ Cliente ${sessionKey} desconectado: ${reason}`);

      const timeout = this.qrTimeouts.get(sessionKey);
      if (timeout) {
        clearTimeout(timeout);
        this.qrTimeouts.delete(sessionKey);
      }

      try {
        await client.destroy();
      } catch (err) {
        this.logger.error(`Error al destruir cliente ${sessionKey}:`, err);
      }

      this.sessions.delete(sessionKey);

      const sessionPath = path.join('./sessions', `client_${sessionKey}`);
      if (fs.existsSync(sessionPath)) await fs.remove(sessionPath);

      const session = await this.clientSessionRepo.findOne({ where: { clientId, botType } });
      if (session) {
        session.status = 'disconnected';
        await this.clientSessionRepo.save(session);
      }

      this.emitQr(clientId, botType, { disconnected: true });
    });

    // ======================================================
    // MESSAGE
    // ======================================================
    client.on('message', async (msg) => {
      try {
        if (!msg.hasMedia) {
          if (msg.body.toLowerCase().includes('hola')) {
            await msg.reply(`👋 ¡Hola! Soy tu asistente del bot *${botType}* de CuentIA. Envía una foto de tu comprobante.`);
          }
          return;
        }
    
        const media = await msg.downloadMedia();
        if (!media?.mimetype?.startsWith('image')) {
          await msg.reply('⚠️ Solo acepto imágenes de comprobantes o tickets.');
          return;
        }
    
        const extension = media.mimetype.split('/')[1];
        const tempPath = path.join('./temp', `comp_${Date.now()}.${extension}`);
        await fs.ensureDir('./temp');
        await fs.writeFile(tempPath, media.data, 'base64');
    
        // 🔹 Diferenciación completa según botType
        let esComprobante = false;
        let datos: any;
    
        if (botType === 'gastos') {
          esComprobante = await this.aiService.esComprobante(tempPath);
          if (!esComprobante) {
            await msg.reply('❌ La imagen no parece ser un ticket o comprobante de gastos.');
            await fs.remove(tempPath);
            return;
          }
          datos = await this.aiService.extraerDatosComprobante(tempPath);
    
        } else if (botType === 'comprobantes-digitales') {
          esComprobante = await this.aiService.esComprobanteDigital(tempPath);
          if (!esComprobante) {
            await msg.reply('❌ La imagen no parece ser un comprobante digital bancario.');
            await fs.remove(tempPath);
            return;
          }
          datos = await this.aiService.extraerDatosComprobanteDigital(tempPath);
    
        } else {
          throw new BadRequestException(`BotType desconocido: ${botType}`);
        }
    
        const contact = await this.safeGetContact(msg);
    
        function cleanClientId(clientId: string): string {
          return clientId.split('-').pop() ?? '';
        }        
    
        const cleanId = cleanClientId(clientId);
        const userId = Number(cleanId);
    
        console.log('usuariooo', userId);

        if (isNaN(userId)) throw new BadRequestException(`ID de cliente inválido: ${userId}`);

        if (userId !== userIdLog){
          throw new UnauthorizedException(
            `No puedes manipular sesiones del usuario ${userId}`
          );        }
    
        // 🔹 Guardado según botType
        let registro;
        if (botType === 'gastos') {

          console.log(contact.pushname, contact.id.user);
          console.log(datos);

            const cleanMonto = datos.monto
            ? Number(String(datos.monto).replace(/[^0-9.-]/g, '')) || 0
            : 0;

          registro = await this.comprobanteService.create({
            ...datos,
            monto: cleanMonto, // 👈 monto limpio numérico
            nombre_remitente: contact.pushname || contact.name || contact.verifiedName,
            telefono_remitente: contact.id.user,
            userId,
          });
        } else if (botType === 'comprobantes-digitales') {
          console.log(contact.pushname, contact.id.user);
          console.log(datos);

            const cleanMonto = datos.monto
            ? Number(String(datos.monto).replace(/[^0-9.-]/g, '')) || 0
            : 0;

          console.log('Monto limpio:', cleanMonto);

          registro = await this.comprobanteDigitalService.create({
            ...datos,
            monto: cleanMonto, // 👈 monto limpio numérico
            nombre_remitente: contact.pushname || contact.name || contact.verifiedName,
            telefono_remitente: contact.id.user,
            userId,
          });
        }
    
        await msg.reply(`✅ Gracias ${registro.nombreRemitente || ''}! Tu comprobante ha sido registrado correctamente.`);
    
        await fs.remove(tempPath);
      } catch (error) {
        this.logger.error(`❌ Error procesando mensaje (${sessionKey}): ${error.message}`);
        await msg.reply('⚠️ Ocurrió un error procesando tu imagen. Intenta más tarde.');
      }
    });
    
    // ======================================================
    // Inicialización
    // ======================================================
    await client.initialize();
    this.sessions.set(sessionKey, client);
    
    return { message: 'Sesión creada', clientId, botType };
    }

  // ------------------------------------------------------------
  // ♻️ Reconectar sesión
  // ------------------------------------------------------------
  async reconnectSession(clientId: string, botType: string, UserIdLog: number) {
    await this.validateBotAccess(UserIdLog, botType);

    const sessionKey = `${clientId}_${botType}`;
    this.logger.log(`♻️ Reconectando sesión ${sessionKey}...`);

    const existingClient = this.sessions.get(sessionKey);
    if (existingClient) {
      await existingClient.destroy().catch((e) => this.logger.warn(e));
      this.sessions.delete(sessionKey);
    }

    const sessionPath = path.join('./sessions', `client_${sessionKey}`);
    if (fs.existsSync(sessionPath)) await fs.remove(sessionPath);

    const session = await this.clientSessionRepo.findOne({ where: { clientId, botType } });
    if (session) {
      session.status = 'reconnecting';
      await this.clientSessionRepo.save(session);
    }

    return this.createSession(clientId, botType, UserIdLog);
  }

  // ------------------------------------------------------------
  // Utilidades
  // ------------------------------------------------------------
  listSessions() {
    return Array.from(this.sessions.keys());
  }

  subscribeToQr(clientId: string, botType: string, callback: (payload: any) => void) {
    const key = `${clientId}-${botType}`;
    let subscribers = this.qrSubscribers.get(key);
    if (!subscribers) {
      subscribers = [];
      this.qrSubscribers.set(key, subscribers);
    }
    subscribers.push(callback);
  }

  private emitQr(clientId: string, botType: string, payload: any) {
    const key = `${clientId}-${botType}`;
    const subs = this.qrSubscribers.get(key);
    if (subs) subs.forEach((cb) => cb(payload));
  }

  async getStatus(clientId: string, botType: string) {
    const session = await this.clientSessionRepo.findOne({ where: { clientId, botType } });
    return { connected: session?.status === 'active', exists: !!session };
  }

  async getSessionRecord(clientId: string, botType: string) {
    return await this.clientSessionRepo.findOne({ where: { clientId, botType } });
  }

  getClient(clientId: string, botType: string) {
    return this.sessions.get(`${clientId}_${botType}`);
  }

  // whatsapp.service.ts

  async getBotConfig(userId: number) {
    // 1️⃣ Traer TODAS las sesiones
    const sessions = await this.clientSessionRepo.find({
      order: { createdAt: "DESC" },
    });
  
    // 2️⃣ Filtrar solo las del usuario autenticado
    const userSessions = sessions.filter((s) => {
      const extracted = this.extractUserIdFromClientId(s.clientId);
      return extracted === userId;
    });
  
    // 3️⃣ Transformar para el front
    const bots = userSessions.map((s) => ({
      botType: s.botType,
      name: s.pushName,
      clientId: s.clientId,
      connected: s.status === "connected",
      status: s.status,
      platform: s.platform,
      whatsappnumber: s.whatsappNumber,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
  
    return { bots };
  }  
}
