import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { NotificationPreferences } from "./entities/notification-preferences.entity";
import { NotificationService } from "./notification.service";
import { NotificationController } from "./notification.controller";
import { UsersModule } from "src/users/users.module";
import { Notification } from "./entities/notification.entity";
import { EmployeeUser } from "src/employee-user/entities/employee-user.entity";

@Module({
  imports: [TypeOrmModule.forFeature([NotificationPreferences, Notification, EmployeeUser]), UsersModule],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
