import { IsBoolean, IsOptional } from "class-validator";

export class UpdateNotificationDto {
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  internalAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  botAlerts?: boolean;
}
