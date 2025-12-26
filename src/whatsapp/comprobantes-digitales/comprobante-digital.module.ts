import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComprobanteDigital } from './entities/comprobante-digital.entity';
import { ComprobantesDigitalesController } from './comprobante-digital.controller';
import { ComprobanteDigitalService } from './comprobante-digital.service';
import { UsersModule } from 'src/users/users.module';
import { ClientesModule } from 'src/clientes/clientes.module';
import { EmployeeUser } from 'src/employee-user/entities/employee-user.entity';

@Module({
  imports: [UsersModule,ClientesModule,TypeOrmModule.forFeature([ComprobanteDigital, EmployeeUser])],
  providers: [ComprobanteDigitalService],
  controllers: [ComprobantesDigitalesController], // 🔹 Agregar esto
  exports: [ComprobanteDigitalService],
})
export class ComprobanteDigitalModule {}
