import { IsString, IsOptional, IsEmail, MaxLength } from "class-validator";

export class CreateSupportRequestDto {
  @IsString()
  @MaxLength(150)
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsString()
  message: string;
}
