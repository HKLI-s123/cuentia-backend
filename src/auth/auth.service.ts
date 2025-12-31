import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { VerificationToken } from '../verification-token/entities/verification-token.entity';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';
import { JwtService } from '@nestjs/jwt';
import { RecaptchaService } from '../recaptcha/recaptcha.service';
import { randomBytes, createHash } from 'crypto';
import { Cliente } from 'src/clientes/entities/cliente.entity';
import { EmployeeUser } from '../employee-user/entities/employee-user.entity';
import { EmployeeRfcAccess } from '../employee-user/entities/employee_rfc_access.entity';
import { GoogleAuthService } from './google-auth.service';
import { Response } from 'express';
import { addDays } from 'date-fns';
import { BillingSubscription } from 'src/billing-payment/entities/billing-subscriptions.entity';
import { NotificationService } from 'src/notifications/notification.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,

    @InjectRepository(Cliente)
    private clientesRepo: Repository<Cliente>,

    @InjectRepository(EmployeeUser)
    private employeeRepo: Repository<EmployeeUser>,

    @InjectRepository(EmployeeRfcAccess)
    private employeeRfcRepo: Repository<EmployeeRfcAccess>,

    @InjectRepository(VerificationToken)
    private vtRepo: Repository<VerificationToken>,

    @InjectRepository(BillingSubscription)
    private readonly subscriptionRepo: Repository<BillingSubscription>,

    private mailService: MailService,
    private jwtService: JwtService,
    private recaptchaService: RecaptchaService,
    private googleAuthService: GoogleAuthService, // 👈 NUEVO
    private notificationsService: NotificationService, // 👈 NUEVO
  ) {
    console.log(
    "🔎 ENTIDAD QUE TYPEORM ESTÁ USANDO PARA USER:",
    this.usersRepo.metadata.columns.map((c) => c.propertyName)
  );
  }

  async register(dto: any) {

    // === 1. Validar aceptación de términos =============================
    console.log("aceptado? ", dto.accepted);
    if (!dto.accepted) {
      throw new BadRequestException(
        'Debes aceptar los términos y condiciones para continuar'
      );
    }
    // === reCAPTCHA ====================================================
    if (!dto.recaptchaToken)
      throw new BadRequestException('Captcha requerido');

    const ok = await this.recaptchaService.verifyToken(dto.recaptchaToken);
    if (!ok) throw new BadRequestException('Fallo captcha');

    // === Validación extra del tipo_cuenta ============================
    const tiposValidos = ['individual', 'empresarial', 'invitado'];
    if (!tiposValidos.includes(dto.tipo_cuenta)) {
      throw new BadRequestException('Tipo de cuenta inválido');
    }

    // === Sanitización mínima =========================================
    dto.email = dto.email.trim().toLowerCase();
    if (dto.username) dto.username = dto.username.trim().toLowerCase();

    // === Evitar enumeración de usuarios ==============================
    const emailExists = await this.usersRepo.findOne({
      where: { email: dto.email },
    });

    
     if (emailExists) {
       throw new BadRequestException('El correo ya está registrado');
     }
 
     
     if (dto.username) {
        const usernameExists = await this.usersRepo.findOne({
          where: { username: dto.username },
     });
   
     if (usernameExists) {
        throw new BadRequestException('El usuario ya está registrado');
     }
    }

    // === Hash password ===============================================
    const passwordHash = await bcrypt.hash(dto.password, 12);

    if (dto.tipo_cuenta !== "individual") {
      dto.username = null;
    }

    if (dto.tipo_cuenta === "invitado") {
      dto.telefono = null;
      dto.empresa = null;
    }

    const user = this.usersRepo.create({
      nombre: dto.nombre,
      telefono: dto.telefono || null,
      username: dto.username || null,
      email: dto.email,
      passwordHash,
      empresa: dto.empresa || null,
      status: 'pending',
      verified: false,
      tipo_cuenta: dto.tipo_cuenta,
      accepted_terms: true,      // ← GUARDAR MARCA EN BD (si existe la columna)
      accepted_terms_at: new Date(), // ← OPCIONAL PERO PROFESIONAL
    });

    await this.usersRepo.save(user);

    
    await this.notificationsService.create({
      userId: user.id,
      type: "INTERNAL",
      title: "Bienvenido a CuentIA",
      content:
        "Tu cuenta fue creada correctamente. Desde aquí podrás organizar tus CFDI, automatizar IVA y DIOT, y tener claridad fiscal desde el primer día.",
    });

    await this.notificationsService.create({
        userId: user.id,
        type: "INTERNAL",
        title: "Exportación de XML disponible por solicitud",
        content:
          "Si requieres tus XML, envía un correo a soporte con tu nombre y RFC(s). " +
          "Te enviaremos el archivo en un plazo máximo de 24 horas. " +
          "Estamos trabajando para que este proceso sea 100% automatizado muy pronto.",
      });

    // === Crear verificación de correo ================================
    const rawToken = randomBytes(32).toString('hex');
    const token = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h

    const vt = this.vtRepo.create({
      token,
      userId: user.id,
      expiresAt,
    });

    await this.vtRepo.save(vt);

    // === Enviar correo ===============================================
    await this.mailService.sendVerificationEmail(user.email, rawToken);

    // === Crear sesión automática ===
    const payload = { sub: user.id, email: user.email, type: "user", role: "owner"};
    
    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: process.env.JWT_ACCESS_EXPIRATION,
    });
    
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_EXPIRATION,
    });
    
    user.currentHashedRefreshToken = await bcrypt.hash(refreshToken, 12);
    await this.usersRepo.save(user);
    
    return {
      message: 'Usuario creado. Revisa tu correo para verificar tu cuenta.',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        verified: user.verified,
        tipo_cuenta: user.tipo_cuenta,
      },
    }
  }

  // ===================================================================
  async verifyEmail(rawToken: string) {
    if (!rawToken) throw new BadRequestException('Token faltante');

    const hashed = createHash('sha256').update(rawToken).digest('hex');

    const vt = await this.vtRepo.findOne({
      where: { token: hashed },
      relations: ['user'],
    });

    if (!vt || vt.expiresAt < new Date())
      throw new BadRequestException('Token inválido o expirado');

    const user = vt.user;
    user.verified = true;
    user.status = 'active';

    user.verificationAttempts = 0;
    user.lastVerificationSent = null;

    await this.usersRepo.save(user);
    await this.vtRepo.delete(vt.id);

    console.log("user iddd", user.id);

    await this.startTrialIfEligible(user.id);

    return { message: 'Correo verificado con éxito' };
  }

  async startTrialIfEligible(userId: number) {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      select: ["id", "tipo_cuenta"],
    });
  
    if (!user) {
      throw new BadRequestException("Usuario no encontrado");
    }

    const existing = await this.subscriptionRepo.findOne({
      where: { userId },
    });
  
    if (existing) return;
  
    const trialStartsAt = new Date();
  
    await this.subscriptionRepo.save({
      userId,
      status: "trialing",
      planProductId: "cuentia_trial",
      trialStartsAt,
      trialEndsAt: addDays(trialStartsAt, 30),
    });
  }

  // ===================================================================
  async login(identifier: string, password: string, res: any) {
    const input = identifier.trim().toLowerCase();
  
    let user: User | null = null;
    let employee: EmployeeUser | null = null;
  
    // Si parece un email → buscar por email
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) {
      user = await this.usersRepo.findOne({where: { email: input },});

      if (!user) {
          employee = await this.employeeRepo.findOne({
            where: { email: input, isActive: true },
          });
      }

    } else {
      // Si NO es email → buscar por username exacto
      user = await this.usersRepo.findOne({where: { username: input },});
    }

    // === LOGIN COMO EMPLEADO ===
    if (!user && employee) {
      const validEmployee = await bcrypt.compare(password, employee.hashedPassword);
      if (!validEmployee) throw new UnauthorizedException("Credenciales inválidas");
    
      // Payload especial para RolesGuard
      const payload = {
        sub: employee.id,
        type: "employee",
        role: employee.role,          // "admin" | "consulta"
        empresaId: employee.ownerId,
      };
    
      const accessToken = this.jwtService.sign(payload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: process.env.JWT_ACCESS_EXPIRATION,
      });
    
      const refreshToken = this.jwtService.sign(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: process.env.JWT_REFRESH_EXPIRATION,
      });

      // 🔥 GUARDAR HASH DEL REFRESH TOKEN (FALTABA ESTO)
      employee.currentHashedRefreshToken = await bcrypt.hash(refreshToken, 12);
      await this.employeeRepo.save(employee);
    
      res.cookie("refresh_token", refreshToken, {
        httpOnly: true,
        secure: false,
        sameSite: "strict",
        path: "/",
        maxAge: 1000 * 60 * 60 * 24 * 7,
      });
    
      return {
        accessToken,
        user: {
          id: employee.id,
          email: employee.email,
          nombre: employee.nombre,
          type: "employee",
          role: employee.role,
          empresaId: employee.ownerId,
        },
      };
    }

    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    if (user.deletedAt) throw new UnauthorizedException('Credenciales inválidas');

    // ========== 🔒 RATE LIMITING POR SEGURIDAD ==========
    
    const now = new Date();
  
    // Si está bloqueado temporalmente
    if (user.lockedUntil && user.lockedUntil > now) {
      throw new UnauthorizedException(
        "Demasiados intentos fallidos. Intenta más tarde."
      );
    }
  
    // Reset de intentos si han pasado 30 minutos sin intentar
    if (
      user.lastLoginAttempt &&
      now.getTime() - user.lastLoginAttempt.getTime() > 30 * 60 * 1000
    ) {
      user.loginAttempts = 0;
    }
  
    // Registrar intento
    user.lastLoginAttempt = now;
    await this.usersRepo.save(user);
  
    // Validar contraseña
    const valid = await bcrypt.compare(password, user.passwordHash);
  
    if (!valid) {
      user.loginAttempts += 1;
  
      // Si alcanza el límite → bloquear por 15 minutos
      if (user.loginAttempts >= 5) {
        user.lockedUntil = new Date(now.getTime() + 15 * 60 * 1000);
        await this.usersRepo.save(user);
  
        throw new UnauthorizedException(
          "Demasiados intentos fallidos. Intenta dentro de 15 minutos."
        );
      }
  
      await this.usersRepo.save(user);
      throw new UnauthorizedException("Credenciales inválidas");
    }
  
    // === 🔓 LOGIN EXITOSO → Resetear contador ===
    user.loginAttempts = 0;
    user.lockedUntil = null;
    await this.usersRepo.save(user);
  
    // === 🔥 GENERAR TOKENS ==
    const payload = { sub: user.id, email: user.email, type: "user", role: "owner"};
  
    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: process.env.JWT_ACCESS_EXPIRATION,
    });
  
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_EXPIRATION,
    });
  
    // Guardar hash en DB
    user.currentHashedRefreshToken = await bcrypt.hash(refreshToken, 12);
    await this.usersRepo.save(user);
  
    // ⬅️ 🍪 SET REFRESH TOKEN COOKIE SEGURA
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: false,       // ⚠️ true en producción HTTPS
      sameSite: 'strict',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 días
    });
  
    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        verified: user.verified,
        tipo_cuenta: user.tipo_cuenta,
      },
    };
  }


  // ===================================================================
  async refresh(refreshToken: string) {
    // 1. Decodificar sin validar firma (solo para obtener sub)
    const decoded = this.jwtService.decode(refreshToken) as any;
  
    if (!decoded?.sub) {
      throw new UnauthorizedException("Token inválido");
    }

    // ⭐ Si es empleado → refrescar empleado
    if (decoded.type === "employee") {
      return this.refreshEmployee(decoded, refreshToken);
    }
  
    // 2. Buscar usuario
    const user = await this.usersRepo.findOne({
      where: { id: decoded.sub },
    });
  
    if (!user || !user.currentHashedRefreshToken) {
      throw new UnauthorizedException("No autorizado");
    }
  
    // 3. Verificar que coincida con el hash almacenado
    const matches = await bcrypt.compare(
      refreshToken,
      user.currentHashedRefreshToken,
    );
  
    if (!matches) throw new UnauthorizedException("Refresh inválido");
  
    // 4. Generar nuevo access token
    const payload = { sub: user.id, email: user.email, type: "user", role: "owner"};

    console.log("REFRESH PAYLOAD QUE SE ESTÁ USANDO:", payload);
  
    const newAccessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: process.env.JWT_ACCESS_EXPIRATION,
    });
  
    const newRefreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_EXPIRATION,
    });
  
    user.currentHashedRefreshToken = await bcrypt.hash(newRefreshToken, 12);
    await this.usersRepo.save(user);
  
    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        verified: user.verified,
        tipo_cuenta: user.tipo_cuenta,
        status: user.status,
      },
    };  
  }

  private async refreshEmployee(decoded: any, oldRefreshToken: string) {
    const employee = await this.employeeRepo.findOne({
      where: { id: decoded.sub, isActive: true },
    });
  
    if (!employee) throw new UnauthorizedException("Empleado no válido");
  
    // Nuevo payload
    const payload = {
      sub: employee.id,
      email: employee.email,
      type: "employee",
      role: employee.role,
      empresaId: employee.ownerId,
    };
  
    const newAccessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: process.env.JWT_ACCESS_EXPIRATION,
    });
  
    const newRefreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_EXPIRATION,
    });
  
    employee.currentHashedRefreshToken = await bcrypt.hash(newRefreshToken, 12);
    await this.employeeRepo.save(employee);
  
    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: employee.id,
        email: employee.email,
        nombre: employee.nombre,
        type: "employee",
        role: employee.role,
        empresaId: employee.ownerId,
      },
    };
  }

  async resendVerification(email: string) {
    // Buscar usuario sin revelar si existe o no
    const user = await this.usersRepo.findOne({ where: { email } });
  
    // Respuesta genérica en caso de que NO exista
    // (Nunca revelar si existe, por seguridad)
    if (!user) {
      return { message: 'Si la cuenta existe, enviamos un correo.' };
    }
  
    // Usuario ya verificado
    if (user.verified) {
      return { message: 'Tu cuenta ya está verificada. Ya puedes iniciar sesión.' };
    }
  
    // Rate limit: mínimo 5 min entre reenvíos
    const now = Date.now();
    const last = user.lastVerificationSent?.getTime() ?? 0;
  
    if (now - last < 5 * 60 * 1000) {
      throw new BadRequestException(
        'Debes esperar unos minutos antes de solicitar otro enlace.',
      );
    }
  
    // Intentos diarios (máximo 5 por día)
    const today = new Date();
    const lastDate = user.lastVerificationSent ? new Date(user.lastVerificationSent) : null;
  
    const isSameDay =
      lastDate &&
      lastDate.getFullYear() === today.getFullYear() &&
      lastDate.getMonth() === today.getMonth() &&
      lastDate.getDate() === today.getDate();
  
    if (isSameDay && user.verificationAttempts >= 5) {
      throw new BadRequestException(
        'Has solicitado demasiados enlaces hoy. Intenta mañana.',
      );
    }
  
    // Actualizar contador
    if (!isSameDay) {
      user.verificationAttempts = 0; // reinicia contador si es otro día
    }
  
    user.verificationAttempts += 1;
    user.lastVerificationSent = new Date();
    await this.usersRepo.save(user);
  
    // Crear token nuevo
    const raw = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(raw).digest('hex');
  
    await this.vtRepo.insert({
      userId: user.id,
      token: hash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
    });
  
    // Enviar correo nuevamente
    await this.mailService.sendVerificationEmail(user.email, raw);
  
    return { message: 'Nuevo enlace enviado. Revisa tu correo.' };
  }

  async getProfile(userId: number, type: "user" | "employee") {
  if (type === "employee") {
    const emp = await this.employeeRepo.findOne({
      where: { id: userId },
      select: ["id", "email", "nombre", "role", "isActive", "createdAt"],
    });

    if (!emp) throw new BadRequestException("Empleado no encontrado");

    return {
      id: emp.id,
      email: emp.email,
      nombre: emp.nombre,
      verified: true,     // empleados no requieren verificación
      tipo_cuenta: "empleado",
      role: emp.role,
      status: emp.isActive ? "active" : "inactive",
      created_at: emp.createdAt,
    };
  }

  // Usuario normal (owner / enterprise / invitado)
  const user = await this.usersRepo.findOne({
    where: { id: userId },
  });

  if (!user) throw new BadRequestException("Usuario no encontrado");

  return {
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    verified: user.verified,
    tipo_cuenta: user.tipo_cuenta,
    status: user.status,
    created_at: user.created_at,
  };
}

  // ===================================================================
  // ===================================================================
  // LOGOUT COMPLETO CON REFRESH TOKEN
  // ===================================================================
  async logoutFromRefreshToken(refreshToken: string | undefined) {
    if (!refreshToken) return;
  
    // Decodificar sin verificar firma (solo lectura)
    const decoded: any = this.jwtService.decode(refreshToken);
    if (!decoded?.sub || !decoded?.type) return;
  
    // ⭐ Logout usuario normal
    if (decoded.type === "user") {
      await this.usersRepo.update(
        { id: decoded.sub },
        { currentHashedRefreshToken: null }
      );
    }
  
    // ⭐ Logout empleado
    if (decoded.type === "employee") {
      await this.employeeRepo.update(
        { id: decoded.sub },
        { currentHashedRefreshToken: null }
      );
     } 
  }

  async getSessionInfo(userId: number, type: "user" | "employee") {

    // ==================================================
    // 🧑‍💼 CASO EMPLEADO (NO BUSCAR EN USERS)
    // ==================================================
    if (type === "employee") {
      const id = userId;
      const employee = await this.employeeRepo.findOne({
        where: { id, isActive: true },
        select: ["id", "email", "nombre", "role", "ownerId", "createdAt"]
      });
  
      if (!employee) {
        throw new NotFoundException("Empleado no encontrado");
      }

      const assignedRfcs = await this.employeeRfcRepo.find({
        where: { employeeId: employee.id, ownerId: employee.ownerId },
      });
      
      // 👉 2. Si no tiene RFCs, devolver vacío
      let clientes: any[] = [];
      
      if (assignedRfcs.length > 0) {
        const rfcList = assignedRfcs.map(r => r.rfc);
      
        clientes = await this.clientesRepo.find({
          where: {
            user_id_relacionado: employee.ownerId,
            rfc: In(rfcList),
          },
          select: [
            "id",
            "nombre",
            "rfc",
          ],
        });
      }
  
      return {
        userId: employee.id,
        nombre: employee.nombre,
        email: employee.email,
        tipoCuenta: "empleado",
        role: employee.role,
        ownerId: employee.ownerId,
        created_at: employee.createdAt,
        verified: true,       // empleados NO pasan por verificación
        omitOnboarding: true, // empleados NO hacen onboarding
        clientes,         // empleados no tienen lista de RFCs
        provider: "local"     // empleados siempre son login local
      };
    }

    // 1️⃣ Obtener usuario
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      select: ['id','nombre', 'telefono', 'email', 'tipo_cuenta', 'guestRfc', 'verified', 'propioRfc', 'omitOnboarding', 'created_at', 'provider'], // <--- aquí está individual/corporativo
    });
  
    if (!user) throw new NotFoundException("Usuario no encontrado 1");
  
    // 2️⃣ Obtener clientes relacionados
    const clientes = await this.clientesRepo.find({
      where: { user_id_relacionado: userId },
      select: ['id', 'nombre', 'rfc','syncStatus','lastSync', 'syncPaused'],
    });
  
    console.log(user.guestRfc);

    const clienteYo = clientes.find(
      c => c.nombre === "Yo" && c.rfc === user.propioRfc
    );

    return {
      userId: user.id,
      nombre: user.nombre,
      telefono: user.telefono,
      email: user.email,
      tipoCuenta: user.tipo_cuenta,   // "individual" | "corporativo"
      clientes,
      guestRfc: user.guestRfc,
      verified: user.verified,
      propioRFC: user.propioRfc,
      omitOnboarding: user.omitOnboarding,
      created_at: user.created_at,
      provider: user.provider,
      syncStatus: clienteYo?.syncStatus || "inactivo",
      lastSync: clienteYo?.lastSync || null,
    };
  }

  async omitOnboarding(userId: number) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
  
    if (!user) throw new NotFoundException('Usuario no encontrado 2');
  
    if (user.propioRfc) {
      throw new BadRequestException('Ya completaste el onboarding. No se puede omitir.');
    }
  
    if (user.tipo_cuenta !== 'empresarial') {
      throw new BadRequestException('Solo cuentas empresariales pueden omitir el onboarding.');
    }
  
    if (user.omitOnboarding === true) {
      return { message: 'Ya se había marcado como omitido.', status: 'ok' };
    }
  
    user.omitOnboarding = true;
    await this.usersRepo.save(user);

  return { message: 'Onboarding omitido correctamente.' };
 }

 async googleLogin(idToken: string, res: Response) {
    if (!idToken) {
      throw new BadRequestException('Token de Google faltante');
    }

    // 1️⃣ Verificar token de Google y obtener perfil
    const googleUser = await this.googleAuthService.verifyIdToken(idToken);

    // 2️⃣ Buscar usuario por email
    let user = await this.usersRepo.findOne({
      where: { email: googleUser.email },
    });

    // 3️⃣ Si no existe → crear usuario nuevo
    if (!user) {
      user = this.usersRepo.create({
        nombre: googleUser.name,
        email: googleUser.email,
        status: googleUser.emailVerified ? 'active' : 'pending',
        verified: googleUser.emailVerified,   // si Google ya verificó el correo, lo marcamos verified
        tipo_cuenta: null,
        googleId: googleUser.googleId,
        avatarUrl: googleUser.picture, // si tienes este campo, si no elimínalo
        provider: 'google'           // si tienes este campo, si no elimínalo
    });

      await this.usersRepo.save(user);
      
    } else {
      // 4️⃣ Si ya existe, podemos actualizar algunos datos básicos
      let needsUpdate = false;

      if (!user.googleId) {
        (user as any).googleId = googleUser.googleId;
        needsUpdate = true;
      }

      // Si antes no estaba verificado pero Google dice que sí
      if (!user.verified && googleUser.emailVerified) {
        user.verified = true;
        user.status = 'active';
        needsUpdate = true;
      }

      if (needsUpdate) {
        await this.usersRepo.save(user);
      }
    }

    // 5️⃣ Generar accessToken y refreshToken igual que en login()
    const payload = { sub: user.id, email: user.email, type: "user", role: "owner"};

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: process.env.JWT_ACCESS_EXPIRATION,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_EXPIRATION,
    });

    // 6️⃣ Guardar hash del refresh en la BD
    user.currentHashedRefreshToken = await bcrypt.hash(refreshToken, 12);
    await this.usersRepo.save(user);

    // 7️⃣ Cookie refresh_token igual que login()
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: false, // ⚠️ true en producción con HTTPS
      sameSite: 'strict',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 días
    });

    // 8️⃣ Respuesta homogénea a tu login normal
    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        verified: user.verified,
        tipo_cuenta: user.tipo_cuenta,
        firstGoogleLogin: !user.tipo_cuenta, // Si aún no la eligió
      },
    };
  }

  async setGoogleAccountType(userId: number, body: any) {
    if (!body.accepted) {
      throw new BadRequestException("Debes aceptar los términos y condiciones.");
    }

    const user = await this.usersRepo.findOne({ where: { id: userId } });
  
    if (!user) throw new NotFoundException("Usuario no encontrado 3");
    if (user.provider !== "google")
      throw new BadRequestException("Solo para usuarios Google");
    if (user.tipo_cuenta)
      throw new BadRequestException("El tipo ya ha sido configurado");
  
    user.tipo_cuenta = body.tipo_cuenta;
    user.empresa = body.empresa || null;
    user.accepted_terms = true;
    user.accepted_terms_at = new Date();
  
    await this.usersRepo.save(user);
  
    return { message: "Tipo de cuenta actualizado" };
 }

 async updateProfile(
   userId: number,
   data: {
     nombre?: string;
     telefono?: string;
     email?: string;
     passwordConfirm: string;
   }
 ) {
   const user = await this.usersRepo.findOne({ where: { id: userId } });
 
   if (!user) throw new NotFoundException("Usuario no encontrado 4");

   if (user.provider !== "local" && data.email) {
     throw new BadRequestException("No puedes cambiar un correo vinculado a Google");
   }
 
   // Verificar contraseña actual
   const valid = await bcrypt.compare(data.passwordConfirm, user.passwordHash);
 
   if (!valid) throw new UnauthorizedException("Contraseña incorrecta");

     if (data.nombre) {
    const nameRegex = /^[A-Za-zÁÉÍÓÚÑáéíóúñ ]{3,}$/;
    if (!nameRegex.test(data.nombre.trim())) {
      throw new BadRequestException(
        "El nombre debe contener solo letras y mínimo 3 caracteres"
      );
    }
    user.nombre = data.nombre.trim();
  }

  // Teléfono (solo si no es invitado)
  if (data.telefono !== undefined) {
    if (user.tipo_cuenta !== "invitado") {
      const phoneRegex = /^[0-9]{10}$/;
      if (!phoneRegex.test(data.telefono)) {
        throw new BadRequestException("El teléfono debe tener 10 dígitos");
      }
      user.telefono = data.telefono;
    } else {
      // invitados no pueden editar teléfono
      data.telefono = undefined;
    }
  }

  // Email
  if (data.email) {
    if (user.provider !== "local") {
      throw new BadRequestException(
        "No puedes cambiar un correo vinculado a Google"
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new BadRequestException("El correo no es válido");
    }

    user.email = data.email.toLowerCase().trim();
  }
 
  // Actualizar campos
  if (data.nombre) user.nombre = data.nombre;
  if (data.telefono !== undefined) user.telefono = data.telefono;
  if (data.email) user.email = data.email.toLowerCase().trim();
 
  await this.usersRepo.save(user);
 
  return { message: "Perfil actualizado correctamente" };
 }

 async changePassword(
   userId: number,
   data: { oldPassword: string; newPassword: string }
 ) {
   const user = await this.usersRepo.findOne({ where: { id: userId } });
 
   if (!user) throw new NotFoundException("Usuario no encontrado 5");

   if (user.provider !== "local" && data) {
     throw new BadRequestException("No puedes cambiar la contraseña a una vinculada a Google");
   }
 
   // Verificar actual
   const valid = await bcrypt.compare(data.oldPassword, user.passwordHash);
   if (!valid) throw new UnauthorizedException("Contraseña actual incorrecta");
 
   // Validar nueva contraseña
   const strongPasswordRegex = /^(?=.*[a-z])(?=.*\d)(?=.*[\W_]).{8,}$/;
   if (!strongPasswordRegex.test(data.newPassword)) {
     throw new BadRequestException(
       "La nueva contraseña es débil (usa letras, números y símbolos)"
     );
   }
 
   // Actualizar hash
   user.passwordHash = await bcrypt.hash(data.newPassword, 12);
 
   // Invalidar refresh tokens previos
   user.currentHashedRefreshToken = null;
 
   await this.usersRepo.save(user);
 
   return { message: "Contraseña actualizada correctamente" };
 }

 async validateEmployee(email: string, pass: string) {
  const employee = await this.employeeRepo.findOne({ where: { email, isActive: true } });

  if (!employee) return null;

  const isPasswordValid = await bcrypt.compare(pass, employee.hashedPassword);
  if (!isPasswordValid) return null;

  return employee;
 }
}
