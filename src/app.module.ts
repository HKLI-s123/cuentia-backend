import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CfdiModule } from './cfdi/cfdi.module';
import { ClientesModule } from './clientes/clientes.module';
import { join } from 'path'; // 🔹 Importa join
import { ServeStaticModule } from '@nestjs/serve-static';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { ChatModule } from './chat/chat.module';
import { GuestKeyModule } from './chat/guest-key/guest-key.module';
import { BillingModule } from './billing/billing.module';
import { BillingPaymentModule } from './billing-payment/billing-payment.module';
import { NotificationModule } from "./notifications/notification.module";
import { DangerZoneModule } from './danger-zone/danger-zone.module';
import { EmployeeModule } from './employee-user/employee.module';
import { SupportModule } from './support/support.module';
import { StripeModule } from './stripe/stripe.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'admin',
      database: 'CuentIA',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true, // solo en dev
    }), 
    AuthModule,
    CfdiModule,
    ClientesModule,
    WhatsappModule,
    ChatModule,
    GuestKeyModule, 
    BillingModule,
    BillingPaymentModule,
    NotificationModule,
    DangerZoneModule,
    EmployeeModule,
    SupportModule,
    StripeModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'), // carpeta que quieres exponer
      serveRoot: '/uploads', // ruta base en el navegador
    })],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
