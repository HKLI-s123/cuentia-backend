import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comprobante } from './entities/comprobante.entity';
import { ComprobanteService } from './comprobante.service';
import { ComprobantesController } from './comprobante.controller';
import { UsersModule } from 'src/users/users.module';
import { ClientesModule } from 'src/clientes/clientes.module';
import { EmployeeUser } from 'src/employee-user/entities/employee-user.entity';

@Module({
  imports: [UsersModule,ClientesModule,TypeOrmModule.forFeature([Comprobante, EmployeeUser])],
  providers: [ComprobanteService],
  controllers: [ComprobantesController], // 🔹 Agregar esto
  exports: [ComprobanteService],
})
export class ComprobanteModule {}
