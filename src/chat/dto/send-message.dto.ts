import { IsNotEmpty, IsOptional, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class SemanaDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  label: string;

  @IsNotEmpty()
  cantidad: number;

  @IsOptional()
  @IsString()
  inicio?: string; // formato YYYY-MM-DD

  @IsOptional()
  @IsString()
  fin?: string; // formato YYYY-MM-DD
}

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsNotEmpty()
  rfc: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SemanaDto)
  semanas?: SemanaDto[];
}
