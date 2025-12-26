import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { UsersService } from "../users/users.service";
import { BillingService } from "../billing/billing.service";
import * as bcrypt from "bcrypt";
import { Cliente } from "../clientes/entities/cliente.entity";
import { BillingPaymentService } from "src/billing-payment/billing-payment.service";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

@Injectable()
export class DangerZoneService {
  constructor(
    @InjectRepository(Cliente)
    private clientesRepo: Repository<Cliente>,
    private readonly usersService: UsersService,
    private readonly billingService: BillingService,
    private readonly billingPaymentService: BillingPaymentService,
  ) {}


  // 💀 Eliminar cuenta (con contraseña opcional)
  async deleteAccount(userId: number, password?: string, confirmation?: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException("Usuario no encontrado");

    if (user.tipo_cuenta === "invitado") {
      // 1. Revisar si tiene empresa asignada
      if (user.guestRfc) {
        throw new ForbiddenException(
          "No puedes eliminar tu cuenta porque pertenece a una empresa. Solicita al administrador."
        );
      }
    }

    // Si es usuario local → verificar contraseña
    if (user.provider === "local") {
      if (!password) throw new BadRequestException("Debes ingresar tu contraseña");

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) throw new UnauthorizedException("Contraseña incorrecta");
    }

      // Google → validar texto ELIMINAR
    if (user.provider === "google") {
      if (confirmation !== "ELIMINAR") {
        throw new BadRequestException("Debes escribir ELIMINAR para confirmar.");
      }
    }

    if (user.tipo_cuenta === "empresarial") {
      await this.clientesRepo.delete({ user_id_relacionado: userId });
    }

    console.log(userId);

    user.status = "inactivo";
    user.email = user.email + "__deleted__" + Date.now();
    user.nombre = "Cuenta Eliminada";
    user.username = "Cuenta Eliminada";
    user.currentHashedRefreshToken = null;
    user.deletedAt = new Date();
    await this.usersService.update(userId, user);

    // Borrar datos sensibles
    await this.billingService.deleteUserBilling(userId);
    await this.billingPaymentService.deleteUserBilling(userId);

    return { message: "Cuenta eliminada permanentemente" };
  }
}
