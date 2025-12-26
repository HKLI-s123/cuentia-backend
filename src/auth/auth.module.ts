import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RecaptchaModule } from '../recaptcha/recaptcha.module';
import { MailModule } from '../mail/mail.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VerificationToken } from '../verification-token/entities/verification-token.entity';
import { VerificationTokenModule } from '../verification-token/verification-token.module';
import { PasswordResetModule } from "../password-reset/password-reset.module";
import { GoogleAuthService } from "../auth/google-auth.service";
import { Cliente } from 'src/clientes/entities/cliente.entity';
import { EmployeeUser } from 'src/employee-user/entities/employee-user.entity';
import { EmployeeRfcAccess } from 'src/employee-user/entities/employee_rfc_access.entity';
import { BillingSubscription } from 'src/billing-payment/entities/billing-subscriptions.entity';
import { NotificationService } from 'src/notifications/notification.service';
import { NotificationPreferences } from 'src/notifications/entities/notification-preferences.entity';
import { Notification } from 'src/notifications/entities/notification.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // <-- para que esté disponible en todos lados
    }),
    PassportModule,
    MailModule,  // 🔥 Esto es obligatorio
    UsersModule,
    RecaptchaModule,
    VerificationTokenModule,
    TypeOrmModule.forFeature([VerificationToken, Cliente, EmployeeUser, EmployeeRfcAccess, BillingSubscription, NotificationPreferences, Notification]),
    PasswordResetModule,   // ⬅️ AÑADIDO
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy,GoogleAuthService, NotificationService],
  exports: [AuthService],
})
export class AuthModule {}
