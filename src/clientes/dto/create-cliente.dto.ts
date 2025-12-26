import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateClienteDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  rfc: string;

  @IsOptional()
  @IsString()
  fiel?: string;

  @IsOptional()
  @IsString()
  ciec?: string;

  // 🔹 Rutas de archivos
  @IsOptional()
  @IsString()
  key_path?: string | null;

  @IsOptional()
  @IsString()
  cer_path?: string | null;
  
  // 🔹 Nuevo campo para relacionar con usuario
  @IsOptional()
  @IsString()
  user_id_relacionado?: number;
}
