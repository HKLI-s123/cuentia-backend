import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between } from "typeorm";
import { SupportRequest } from "./entities/support-request.entity";
import { CreateSupportRequestDto } from "./dto/create-support-request.dto";
import { MailService } from "../mail/mail.service";

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportRequest)
    private readonly repo: Repository<SupportRequest>,
    private readonly mailService: MailService,
  ) {}

  async handleSupportRequest(dto: CreateSupportRequestDto, userId: number) {
    // ---------------------------------------
    // 1️⃣ Rate limit: máximo 3 solicitudes por día
    // ---------------------------------------
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const countToday = await this.repo.count({
      where: {
        userId,
        createdAt: Between(start, end),
      },
    });

    if (countToday >= 3) {
      throw new BadRequestException(
        "Has alcanzado el límite de 3 solicitudes de soporte por día."
      );
    }

    // ---------------------------------------
    // 2️⃣ Guardar solicitud en BD
    // ---------------------------------------
    const request = this.repo.create({
      ...dto,
      userId,
    });

    await this.repo.save(request);

    // ---------------------------------------
    // 3️⃣ Enviar correos
    // ---------------------------------------
    await this.mailService.sendSupportConfirmation(dto.email, dto.name);
    await this.mailService.sendSupportAdminAlert(request);

    return { message: "Tu solicitud de soporte ha sido enviada." };
  }
}
