import { Injectable, ForbiddenException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotificationPreferences } from "./entities/notification-preferences.entity";
import { Notification } from "./entities/notification.entity";
import { UpdateNotificationDto } from "./dto/update-notification.dto";
import { EmployeeUser } from "src/employee-user/entities/employee-user.entity";
import { CreateNotificationDto } from "./dto/create-notificaton.dto";

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(NotificationPreferences)
    private prefsRepo: Repository<NotificationPreferences>,

    @InjectRepository(Notification)
    private notifRepo: Repository<Notification>,
    
    @InjectRepository(EmployeeUser)
    private readonly employeeRepo : Repository<EmployeeUser>,
  ) {}

    // 🔔 Crear notificación genérica
  async create(dto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notifRepo.create({
      type: dto.type,
      title: dto.title,
      content: dto.content,
      userId: dto.userId,
    });

    return await this.notifRepo.save(notification);
  }

  async getPreferences(userId: number) {
    let prefs = await this.prefsRepo.findOne({ where: { userId } });

    if (!prefs) {
      prefs = this.prefsRepo.create({ userId });
      await this.prefsRepo.save(prefs);
    }

    return prefs;
  }

  async updatePreferences(userId: number, dto: UpdateNotificationDto) {
    const prefs = await this.getPreferences(userId);

    Object.assign(prefs, dto);
    return this.prefsRepo.save(prefs);
  }

  async findByUser(userId: number, type: string = "user") {

  // 🟦 Caso EMPLEADO → usar RFCs asignados
     if (type === "employee") {
         // 1️⃣ Buscar empleado activo
         const employee = await this.employeeRepo.findOne({
           where: { id: userId, isActive: true },
         });
     
         if (!employee) {
           throw new ForbiddenException("Empleado no encontrado o inactivo.");
         }

         userId = employee.ownerId;
     }

    return this.notifRepo.find({
      where: { userId },
      order: { createdAt: "DESC" },
      take: 20,
    });
  }

  async deleteForUser(id: number, userId: number, type: string = "user") {

     // 🟦 Caso EMPLEADO → usar RFCs asignados
    if (type === "employee") {
        // 1️⃣ Buscar empleado activo
        const employee = await this.employeeRepo.findOne({
          where: { id: userId, isActive: true },
        });
    
        if (!employee) {
          throw new ForbiddenException("Empleado no encontrado o inactivo.");
        }  
        userId = employee.ownerId;
    }

    const notif = await this.notifRepo.findOne({ where: { id, userId } });
  
    if (!notif) return { success: false, message: "No encontrada o sin permiso" };
  
    await this.notifRepo.remove(notif);
    return { success: true };
  }

}
