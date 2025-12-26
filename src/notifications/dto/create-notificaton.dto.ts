// dto/create-notification.dto.ts
import { IsInt, IsString, MaxLength } from "class-validator";

export class CreateNotificationDto {

  @IsString()
  @MaxLength(30)
  type: string; 
  // "EMAIL" | "INTERNAL" | "BOT" | "SMS" | "PUSH"

  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  content: string;

  @IsInt()
  userId: number;
}
