// billing.service.ts
import {
    Injectable,
    BadRequestException,
    NotFoundException,
    ConflictException,
  } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingInfo } from './entities/billing-info.entity';
import { BillingInvoice } from './entities/billing-invoice.entity';
import { UpdateBillingDto } from './dto/update-billing.dto';
import Stripe from 'stripe';
import { BillingCustomer } from 'src/billing-payment/entities/billing-customer.entity';
import { BillingSubscription } from 'src/billing-payment/entities/billing-subscriptions.entity';
import { BillingSubscriptionItem } from 'src/billing-payment/entities/billing-subscription-items.entity';
import { CustomPlanDto } from './dto/custom-plan.dto';
import { MailService } from 'src/mail/mail.service';
import { EnterpriseLead } from './entities/enterprise-lead.entity';
import { ManualPayment } from './entities/manual-payment.entity';
import { BillingInvoiceStripe } from 'src/billing-payment/entities/billing-invoice-stripe.entity';
import { StripeService } from 'src/stripe/stripe.service';
import { User } from 'src/users/entities/user.entity';
import { BillingFeaturesService } from './billing-features.service';
import { NotificationService } from 'src/notifications/notification.service';

export const PRICE_ID_TO_CODE_MAP: Record<string, string> = {
  // 🤖 Bots
  price_1ScxhdKWIz2QT93cIt58WcIg: 'cuentia_bot_gastos',
  price_1ScxiyKWIz2QT93c6K8sc0Cl: 'cuentia_bot_comprobantes',

  // 📦 Paquete
  price_1Sf7A2KWIz2QT93cyeeWTbiY: 'cuentia_start_bots_2',

  // 🟢 Planes (si los necesitas)
  price_1Seg0XKWIz2QT93cwnyee3uL: 'cuentia_plan_individual',
  price_1ScxMCKWIz2QT93ceaPmuDXE: 'cuentia_plan_profesional',
  price_1ScxTTKWIz2QT93cmuNGNUzW: 'cuentia_plan_empresarial',
};

// =============================
//  EXTRACT SUBSCRIPTION ID
// =============================
function getSubscriptionId(invoice: Stripe.Invoice): string | null {
  const inv: any = invoice; // <- TypeScript deja de quejarse

  // 1️⃣ Nivel raíz (a veces viene aquí)
  if (inv.subscription) {
    return inv.subscription;
  }

  // 2️⃣ En parent.subscription_details.subscription
  if (inv.parent?.subscription_details?.subscription) {
    return inv.parent.subscription_details.subscription;
  }

  // 3️⃣ En líneas (muy común en invoice.payment_succeeded)
  if (Array.isArray(inv.lines?.data) && inv.lines.data.length > 0) {
    const firstLine: any = inv.lines.data[0];

    const subFromLine =
      firstLine?.parent?.subscription_item_details?.subscription ??
      firstLine?.subscription;

    if (subFromLine) {
      return subFromLine;
    }
  }

  return null;
}

function resolveCodeFromPriceId(priceId: string): string {
  const code = PRICE_ID_TO_CODE_MAP[priceId];

  if (!code) {
    throw new Error(`No existe mapping para priceId=${priceId}`);
  }

  return code;
}

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(BillingInfo)
    private billingRepo: Repository<BillingInfo>,

    @InjectRepository(BillingInvoice)
    private invoicesRepo: Repository<BillingInvoice>,

    @InjectRepository(BillingInvoiceStripe)
    private invoicesStripeRepo: Repository<BillingInvoiceStripe>,

    @InjectRepository(BillingCustomer)
    private readonly customerRepo: Repository<BillingCustomer>,

    @InjectRepository(BillingSubscription)
    private readonly subscriptionRepo: Repository<BillingSubscription>,

    @InjectRepository(BillingSubscriptionItem)
    private readonly itemRepo: Repository<BillingSubscriptionItem>,

    @InjectRepository(EnterpriseLead)
    private readonly enterpriseLeadRepo: Repository<EnterpriseLead>,

    @InjectRepository(ManualPayment)
    private readonly manualPaymentRepo: Repository<ManualPayment>,

    @InjectRepository(User)
    private readonly usersRepo : Repository<User>,

    private readonly mailService: MailService,

    private readonly stripeService: StripeService,

    private readonly billingFeaturesService: BillingFeaturesService,

    private readonly notificationsService: NotificationService,
  ) {}

  async getBillingInfo(userId: number) {
    let info = await this.billingRepo.findOne({ where: { userId } });

    if (!info) {
      info = this.billingRepo.create({ userId, plan: "Free" });
      await this.billingRepo.save(info);
    }

    return info;
  }

  async updateBillingInfo(userId: number, dto: UpdateBillingDto) {
    // Validación lógica adicional según tipo de RFC
    const isPM = dto.rfc.length === 12; // Persona Moral
    const isPF = dto.rfc.length === 13; // Persona Física
  
    if (!isPM && !isPF) {
      throw new BadRequestException("El RFC no corresponde a PF ni PM.");
    }
  
    if (isPM && Number(dto.regimenFiscal) < 600) {
      throw new BadRequestException(
        "El RFC es de Persona Moral pero el régimen fiscal seleccionado no corresponde."
      );
    }
  
    if (isPF && Number(dto.regimenFiscal) < 600) {
      // PF puede usar varios, no restringimos más
    }
  
    let info = await this.billingRepo.findOne({ where: { userId } });
  
    if (!info) {
      info = this.billingRepo.create({ userId });
    }
  
    Object.assign(info, dto);
  
    return await this.billingRepo.save(info);
  }

  async getInvoices(userId: number) {
    return this.invoicesRepo.find({
      where: { userId },
      order: { createdAt: "DESC" },
    });
  }

  async deleteUserBilling(userId: number) {
    await this.billingRepo.delete({ userId });
    await this.invoicesRepo.delete({ userId });
  }

  // =====================================
  // ✅ CHECKOUT COMPLETED
  // =====================================
  async handleCheckoutCompleted(
    session: Stripe.Checkout.Session
  ) {
    const userId = Number(session.metadata?.userId);
    if (!userId) return;

    console.log('✅ Checkout completed for user', userId);

    // Aquí usualmente:
    // 1. Crear BillingCustomer si no existe
    // 2. Asociar stripeCustomerId
    // 3. NO activar servicios aquí (eso lo hace subscription.created)
    console.log("DEBUG SESSION:", JSON.stringify(session, null, 2));
  }

  // =====================================
  // ✅ SUBSCRIPTION SYNC (CREATED / UPDATED)
  // =====================================
  async syncSubscription(subscription: Stripe.Subscription) {
    const stripeCustomerId = subscription.customer as string;

    console.log("🔍 RAW SUBSCRIPTION:", {
      id: subscription.id,
      status: subscription.status,
      cancel_at_period_end: subscription.cancel_at_period_end,
      cancel_at: subscription.cancel_at,
      canceled_at: subscription.canceled_at,
      ended_at: (subscription as any).ended_at,
    });
    // ===============================
    // 1️⃣ Resolver usuario
    // ===============================
    const billingCustomer = await this.customerRepo.findOne({
      where: { stripeCustomerId },
    });

    if (!billingCustomer) {
      console.warn(
        `⚠️ BillingCustomer no encontrado para stripeCustomerId=${stripeCustomerId}`,
      );
      return;
    }

    const userId = billingCustomer.userId;

    const user = await this.usersRepo.findOne({
      where: { id: userId },
      select: ['tipo_cuenta'],
    });

    const isInvitado = user?.tipo_cuenta === 'invitado';

    // ===============================
    // 2️⃣ Upsert BillingSubscription
    // ===============================
    let billingSubscription =
      await this.subscriptionRepo.findOne({
        where: { stripeSubscriptionId: subscription.id },
    });

    if (!billingSubscription) {
      billingSubscription = this.subscriptionRepo.create({
        userId,
        stripeSubscriptionId: subscription.id,
      });
    }

    billingSubscription.stripeSubscriptionId = subscription.id;
    billingSubscription.status = subscription.status as any;
    const currentPeriodEndUnix =
    (subscription as any).current_period_end as number | undefined;

    billingSubscription.currentPeriodEnd = currentPeriodEndUnix
      ? new Date(currentPeriodEndUnix * 1000)
      : null;
      
    billingSubscription.trialEndsAt = subscription.trial_end
      ? new Date(subscription.trial_end * 1000)
      : null;


    let newPlanProductId = billingSubscription.planProductId;
    let newPlanPriceId = billingSubscription.planPriceId;

    await this.subscriptionRepo.save(billingSubscription);

    console.log("🔄 Sincronizando suscripción...");

    // ===============================
    // 3️⃣ Sincronizar ITEMS
    // ===============================
    const stripeItems = subscription.items.data;

    // Marcar todos como inactivos primero (idempotencia)
    await this.itemRepo.update(
      { billingSubscriptionId: billingSubscription.id },
      { active: false },
    );

    for (const item of stripeItems) {
      const price = item.price;
      const productId = price.product as string;
      const priceId = price.id;

      const code = price.metadata?.code; // ej: "cuentia_plan_individual"

      const meta = price.metadata || {};
      const metaType = meta.type; // plan | bot

      let itemType: 'plan' | 'bot' | 'addon' = 'addon';
      
      // =======================
      // 🔹 PLAN NORMAL
      // =======================
      if (metaType === 'plan') {
        itemType = 'plan';
      
        newPlanProductId = code;
        newPlanPriceId = priceId;
      
        billingSubscription.planProductId = newPlanProductId;
        billingSubscription.planPriceId = newPlanPriceId;
      }
      
      // =======================
      // 🤖 BOT
      // =======================
      if (metaType === 'bot') {
      
        // ============================
        // 👤 INVITADO → bot = PLAN
        // ============================
        if (isInvitado) {
          itemType = 'plan';
      
          billingSubscription.planProductId = code;
          billingSubscription.planPriceId = priceId;
        }
      
        // ============================
        // 🏢 NO invitado → bot = ADDON
        // ============================
        else {
          itemType = 'bot';
        }
      }

    
      let dbItem = await this.itemRepo.findOne({
        where: {
          stripeItemId: item.id,
        },
      });
    
      if (!dbItem) {
        dbItem = this.itemRepo.create({
          billingSubscriptionId: billingSubscription.id,
          stripeItemId: item.id,
        });
      }
    
      dbItem.productId = productId; // Stripe product (prod_xxx)
      dbItem.priceId = priceId;
      dbItem.itemType = itemType;
      dbItem.code = code;            // <--- RECOMENDADO
      dbItem.quantity = item.quantity ?? 1;
      dbItem.active = true;
    
      await this.itemRepo.save(dbItem);
    }

    await this.subscriptionRepo.save(billingSubscription);

    await this.notificationsService.create({
      userId: userId,
      type: "INTERNAL",
      title: "Plan iniciado con éxito",
      content:
        "Has iniciado tu plan de forma exitosa. Ya puedes acceder a todas las funcionalidades incluidas y comenzar a operar en CuentIA.",
    });

    console.log(`✅ Subscription sincronizada userId=${userId}`);
  }

  // =====================================
  // ❌ SUBSCRIPTION DELETED
  // =====================================
  // billing-cancel.service.ts (o dentro de BillingService)

  async cancelSubscription(userId: number) {
    const sub = await this.subscriptionRepo.findOne({
      where: { userId },
      order: { createdAt: "DESC" },
    });

  
    if (!sub || !sub.stripeSubscriptionId) {
      throw new NotFoundException('No tienes una suscripción activa.');
    }
  
    const isManualPayment =
      !sub.stripeSubscriptionId ||
      sub.stripeSubscriptionId === "manual_payment";
  
    // ==========================
    // 🔹 CASO 1: TRANSFERENCIA
    // ==========================
    if (isManualPayment) {
      sub.status = "canceled" as any;
      sub.canceledAt = new Date();
  
      await this.subscriptionRepo.save(sub);
  
      await this.itemRepo.update(
        { billingSubscriptionId: sub.id },
        { active: false },
      );
  
      return { ok: true, mode: "manual" };
    }
  
    // 1️⃣ Cancelar en Stripe (inmediato)
    await this.stripeService.stripe.subscriptions.cancel(
      sub.stripeSubscriptionId,
      {
        invoice_now: false,
        prorate: false,
      },
    );
  
    // 2️⃣ Actualizar tu BD
    sub.status = 'canceled' as any;
    sub.canceledAt = new Date();
    await this.subscriptionRepo.save(sub);
  
    await this.itemRepo.update(
      { billingSubscriptionId: sub.id },
      { active: false },
    );
  
    return { ok: true };
  }


  // =====================================
  // 💰 PAYMENT SUCCEEDED
  // =====================================
  async handlePaymentSucceeded(invoice: Stripe.Invoice) {
    console.log("💰 Payment succeeded:", invoice.id);
  
    // Manejo seguro
    const subscriptionId = getSubscriptionId(invoice);

    if (!subscriptionId) {
      console.warn("⚠️ Invoice sin subscription asociada");
      console.warn("RAW:", JSON.stringify(invoice, null, 2));
      return;
    }

    const existing = await this.invoicesStripeRepo.findOne({
      where: { invoiceId: invoice.id },
    });

    if (existing?.status === "paid") {
      console.log("⛔ Ignorando evento viejo para invoice pagada");
      return;
    }

    const periodEndUnix = invoice.lines?.data?.[0]?.period?.end;
    const periodEnd = periodEndUnix
      ? new Date(periodEndUnix * 1000)
      : existing?.periodEnd ?? null; 


    const entity = existing ?? this.invoicesStripeRepo.create({
      invoiceId: invoice.id,
    });


    await this.subscriptionRepo.update(
      { stripeSubscriptionId: subscriptionId },
      {
        status: "active",
        currentPeriodEnd: periodEnd,
        lastPaymentAt: new Date(),
      }
    );

    console.log("📄 Invoice event", {
      id: invoice.id,
      eventType: invoice.status,
      amount: invoice.amount_paid,
      lines: invoice.lines?.data?.length,
    });

    entity.stripeSubscriptionId = subscriptionId;
    entity.amount = invoice.amount_paid ?? entity.amount ?? 0;
    entity.currency = invoice.currency ?? entity.currency ?? null;
    entity.periodEnd = periodEnd;
    entity.status = "paid";
  
    await this.invoicesStripeRepo.save(entity);
  }

  async handlePaymentFailed(invoice: Stripe.Invoice) {
   const rawSub = invoice["subscription"];
     const subscriptionId =
       typeof rawSub === "string" ? rawSub : rawSub?.id;
   
     if (!subscriptionId) {
       console.warn("⚠️ Invoice sin subscription asociada");
       return;
     }

     const existing = await this.invoicesStripeRepo.findOne({
       where: { invoiceId: invoice.id },
     });

     if (existing?.status === "paid") {
       console.log("⛔ Ignorando evento viejo para invoice pagada");
       return;
     }
   
     const entity = existing ?? this.invoicesStripeRepo.create({
       invoiceId: invoice.id,
     });

    console.log("📄 Invoice event", {
      id: invoice.id,
      eventType: invoice.status,
      amount: invoice.amount_paid,
      lines: invoice.lines?.data?.length,
    });
   
     entity.stripeSubscriptionId = subscriptionId;
     entity.amount = invoice.amount_due ?? entity.amount ?? 0;
     entity.currency = invoice.currency ?? entity.currency ?? null;
     entity.status = "failed";

     await this.invoicesStripeRepo.save(entity);
  }


  async handleCustomPlanRequest(dto: CustomPlanDto) {
    // Convertir checkbox HTML ("on") → boolean
    const leadData = {
      ...dto,
      botGastos: dto.botGastos === "on",
      botComprobantes: dto.botComprobantes === "on",
      integraciones: dto.integraciones === "on",
    };
  
    // Guardar en BD
    const lead = this.enterpriseLeadRepo.create(leadData);
    await this.enterpriseLeadRepo.save(lead);
  
    // Enviar correo a soporte
    await this.mailService.sendEnterpriseLeadEmail(lead);
  
    return { ok: true };
  }

  async registerManualPayment(
    userId: number,
    payload: { code: string; kind: 'plan' | 'bot'; reference: string | null;}
  ) {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      select: ['tipo_cuenta'],
    });
  
    const isInvitado = user?.tipo_cuenta === 'invitado';
  
    const planInfo = await this.getUserPlanStatus(userId);
    const hasActivePlan = !!planInfo?.plan && !planInfo?.expired;

    console.log("activeee?",planInfo);

    const activeBots = await this.billingFeaturesService.getActiveBots(userId);
    const hasActiveBot = activeBots?.length > 0;
  
    // 🔒 Invitado
    if (isInvitado) {
      if (payload.kind === 'bot') {
        if (hasActiveBot) {
          return {
            ok: false,
            message:
              "Ya tienes un bot activo. Para cambiarlo, debes esperar a que termine o contratar el paquete.",
          };
        }
      }
  
      if (payload.kind === 'plan' && hasActivePlan) {
        return {
          ok: false,
          message: "Ya cuentas con un plan activo.",
        };
      }
    }
  
    // 🔒 No invitado
    if (!isInvitado) {
      if (payload.kind === 'bot') {
        if (!hasActivePlan) {
          return {
            ok: false,
            message: "Debes tener un plan activo para contratar bots.",
          };
        }
      }
  
      if (payload.kind === 'plan' && hasActivePlan) {
        return {
          ok: false,
          message:
            "Para cambiar de plan debes hacerlo con tarjeta o esperar a que termine el actual.",
        };
      }
    }
  
    // 🔁 Evitar duplicados pendientes
    const existing = await this.manualPaymentRepo.findOne({
      where: { userId, status: 'pending' },
    });
  
    if (existing) {
      return {
        ok: false,
        pending: true,
        message: "Ya tienes una solicitud pendiente de validación.",
      };
    }

    let role: 'plan' | 'addon';

    if (payload.kind === 'plan') {
      role = 'plan';
    } else {
      // payload.kind === 'bot'
      role = isInvitado ? 'plan' : 'addon';
    }
  
    // ✅ Crear solicitud
    const record = this.manualPaymentRepo.create({
      userId,
      code: payload.code,
      kind: payload.kind,
      role,
      status: 'pending',
    });
  
    await this.manualPaymentRepo.save(record);
    await this.mailService.sendManualPaymentEmail(record);
  
    return { ok: true };
  }
  
  
  async getUserPlanStatus(userId: number) {
    const sub = await this.subscriptionRepo.findOne({
      where: { userId },
      order: { createdAt: "DESC" },
    });
  
    if (!sub) {
      return {
        plan: null,
        expired: false,
      };
    }
  
    let expired = true;

    if(sub.status === "active"){
      expired = false;
    }else{
      expired = true;
    }

    console.log(sub);
    console.log(userId);

    return {
      plan: sub.planProductId,
      expired,
    };
  }

  async activateManualAddon(
    userId: number,
    code: string
  ) {

    console.log("repooo", userId);

    const sub = await this.subscriptionRepo.findOne({
      where: { userId },
      order: { createdAt: "DESC" },
    });

    console.log("suuub", sub);
  
    if (!sub || sub.status !== "active") {
      throw new BadRequestException(
        "No existe un plan activo para agregar el addon."
      );
    }
  
    // Evitar duplicados
    const existing = await this.itemRepo.findOne({
      where: {
        billingSubscriptionId: sub.id,
        code,
        active: true,
      },
    });
  
    if (existing) {
      throw new ConflictException(
        "Este addon ya se encuentra activo."
      );
    }
  
    const resolvedCode = resolveCodeFromPriceId(code);

    const item = this.itemRepo.create({
      billingSubscriptionId: sub.id,
      code: resolvedCode,
      itemType: 'bot',
      priceId: code,
      quantity: 1,
      stripeItemId: 'manual_payment',
      productId: 'manual_payment',
      active: true,
    });
  
    await this.itemRepo.save(item);

    await this.notificationsService.create({
      userId: userId,
      type: "INTERNAL",
      title: "Pago verificado con éxito",
      content:
        "Tu pago por transferencia fue verificado correctamente. Tu plan ya está activo y puedes comenzar a utilizar todas sus funcionalidades.",
    });
  }

  async activateManualSubscription(
    userId: number,
    planProductCode: string
  ) {
    let sub = await this.subscriptionRepo.findOne({ 
      where: { userId },
      order: { createdAt: "DESC" },
    });
  
    if (!sub) {
      sub = this.subscriptionRepo.create({ userId });
    }
  
    // 🚫 Seguridad extra
    if (sub.status === "active") {
      throw new BadRequestException(
        "El usuario ya tiene un plan activo."
      );
    }
    
    const resolvedCode = resolveCodeFromPriceId(planProductCode);

    sub.status = "active";
    sub.planProductId = resolvedCode;
    sub.planPriceId = planProductCode;
    sub.stripeSubscriptionId = "manual_payment";
    sub.currentPeriodEnd = this.addOneMonth();
  
    await this.subscriptionRepo.save(sub);

    await this.notificationsService.create({
      userId: userId,
      type: "INTERNAL",
      title: "Pago verificado con éxito",
      content:
        "Tu pago por transferencia fue verificado correctamente. Tu plan ya está activo y puedes comenzar a utilizar todas sus funcionalidades.",
    });
  }

  
  private addOneMonth() {
    const now = new Date();
    now.setMonth(now.getMonth() + 1);
    return now;
  }

  async listManualPayments() {
    return this.manualPaymentRepo.find({
      order: { createdAt: "DESC" },
    });
  }

  async approveManualPayment(id: number) {
    const record = await this.manualPaymentRepo.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException("Registro no encontrado");
    }
  
    const userId = record.userId;
  
    // 1️⃣ Estado actual del usuario
    const planInfo = await this.getUserPlanStatus(userId);
    const hasActivePlan = !!planInfo?.plan && !planInfo?.expired;
  
    // 🚫 Bloqueos según rol
    if (record.role === 'plan' && hasActivePlan) {
      throw new ConflictException(
        "El usuario ya tiene un plan activo vigente"
      );
    }
  
    if (record.role === 'addon' && !hasActivePlan) {
      throw new ConflictException(
        "No se puede activar un addon sin un plan activo"
      );
    }
  
    // 2️⃣ Activar suscripción / addon
    if (record.role === 'plan') {
      await this.activateManualSubscription(userId, record.code);
    }
  
    if (record.role === 'addon') {
      await this.activateManualAddon(userId, record.code);
    }
  
    // 3️⃣ Marcar como aprobado
    record.status = "approved";
    record.approvedAt = new Date();
  
    await this.manualPaymentRepo.save(record);
  
    return { ok: true };
  }


  async rejectManualPayment(id: number) {
    const payment = await this.manualPaymentRepo.findOne({ where: { id } });
  
    if (!payment) throw new NotFoundException("No existe este pago manual");
  
    if (payment.status !== "pending") {
      throw new BadRequestException("Este pago ya fue procesado");
    }
  
    payment.status = "rejected";
    await this.manualPaymentRepo.save(payment);
  
    return { ok: true };
  }

  async changePlan(userId: number, newPriceId: string) {
    // 1️⃣ Buscar la suscripción interna
    const sub = await this.subscriptionRepo.findOne({
      where: { userId },
      order: { createdAt: "DESC" },
    });
  
    if (!sub) {
      throw new BadRequestException("No tienes una suscripción activa.");
    }
  
    // 2️⃣ Validar que stripeSubscriptionId exista
    const stripeId = sub.stripeSubscriptionId;

    if (!stripeId || stripeId === "manual_payment") {
       // 👉 aquí NO se toca Stripe
   
       // Mapear priceId → code
       const planCode = PRICE_ID_TO_CODE_MAP[newPriceId];
   
       if (!planCode) {
         throw new BadRequestException("Plan inválido.");
       }
   
       sub.planProductId = planCode;
       sub.planPriceId = "manual_payment";
       sub.status = "active";
       sub.currentPeriodEnd = this.addOneMonth();
   
       await this.subscriptionRepo.save(sub);
   
       return {
         ok: true,
         mode: "manual",
         message: "Plan actualizado manualmente",
       };
     }


    if (!stripeId || typeof stripeId !== "string") {
      throw new BadRequestException("La suscripción no tiene un stripeSubscriptionId válido.");
    }
  
    // 3️⃣ Obtener la suscripción real desde Stripe
    const stripeSub = await this.stripeService.stripe.subscriptions.retrieve(stripeId);
  
    if (!stripeSub || !stripeSub.items || stripeSub.items.data.length === 0) {
      throw new BadRequestException("Stripe no devolvió items activos para esta suscripción.");
    }
  
    // 4️⃣ Tomar el item REAL de Stripe (el que sí existe)
    const currentItem = stripeSub.items.data[0];
  
    if (!currentItem?.id) {
      throw new BadRequestException("No se encontró ningún subscription item válido en Stripe.");
    }
  
    // 5️⃣ Actualizar la suscripción (upgrade / downgrade)
    const updated = await this.stripeService.stripe.subscriptions.update(stripeId, {
      items: [
        {
          id: currentItem.id,  // item REAL de Stripe (obligatorio)
          price: newPriceId,
        },
      ],
      proration_behavior: "create_prorations", // cobra diferencia
    });
  
    return updated;
  }
  
  async applyRetentionDiscount(userId: number, reason: string, customReason?: string) {
    // 1️⃣ Obtener suscripción activa
    const sub = await this.subscriptionRepo.findOne({
      where: { userId, status: 'active' },
      order: { createdAt: 'DESC' },
    });
  
    if (!sub?.stripeSubscriptionId) {
      throw new BadRequestException('No hay suscripción activa');
    }
  
    if (sub.status !== "active") {
      throw new BadRequestException("La suscripción no está activa");
    }

    // 2️⃣ Evitar doble descuento
    if (sub.discountAt) {
      throw new BadRequestException("Ya se aplicó un descuento previamente");
    }

    // 3️⃣ Calcular meses pagados
    const paidMonths = await this.invoicesStripeRepo.count({
      where: {
        stripeSubscriptionId: sub.stripeSubscriptionId,
        status: "paid",
      },
    });
  
    if (paidMonths < 3) {
      throw new BadRequestException(
        "El descuento solo aplica a clientes con al menos 3 meses pagados"
      );
    }

    const finalReason = reason || "retention_discount_accepted";


    // 2️⃣ Aplicar cupón a la suscripción
    await this.stripeService.stripe.subscriptions.update(
      sub.stripeSubscriptionId,
      {
        discounts: [
          { coupon: process.env.RETENTION_COUPON_20_3M },
        ],
      }
    );
  
    // 6️⃣ Guardar auditoría local
     sub.discountAt = new Date();
     sub.retentionReason = finalReason;
     sub.retentionReasonExtra = customReason ?? null;

     await this.subscriptionRepo.save(sub);
  
    return { success: true,  message: "Descuento aplicado correctamente",};
  }
}



