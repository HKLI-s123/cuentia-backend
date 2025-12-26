import { IsEmail, IsNotEmpty, IsOptional, Length, Matches, IsIn, IsBoolean } from 'class-validator';

export class RegisterDto {
  @IsNotEmpty() @Length(3) nombre: string;
  @IsOptional() @Matches(/^[0-9]{10}$/) telefono?: string;
  @IsOptional() @Length(4) username?: string;
  @IsEmail() email: string;
  @IsNotEmpty() password: string;
  @IsOptional() empresa?: string;
  // recaptcha token from client
  @IsOptional() recaptchaToken?: string;
  @IsIn(['invitado', 'individual', 'empresarial'])
  tipo_cuenta: 'invitado' | 'individual' | 'empresarial';
  @IsBoolean()
  accepted: boolean;
}
