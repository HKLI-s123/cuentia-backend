// guest-key.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuestKey } from './entities/guest-key.entity';
import { Cliente } from '../../clientes/entities/cliente.entity';
import { GuestKeyService } from './guest-key.service';
import { GuestKeyController } from './guest-key.controller';
import { UsersModule } from '../../users/users.module';
import { User } from 'src/users/entities/user.entity';
import { ClientesModule } from 'src/clientes/clientes.module';
import { EmployeeUser } from "../../employee-user/entities/employee-user.entity";
import { EmployeeRfcAccess } from "../../employee-user/entities/employee_rfc_access.entity";

@Module({
  imports: [TypeOrmModule.forFeature([GuestKey, Cliente, User, EmployeeRfcAccess, EmployeeUser]), UsersModule, ClientesModule],
  controllers: [GuestKeyController],
  providers: [GuestKeyService],
  exports: [GuestKeyService],         // ← ESTO es necesario
})
export class GuestKeyModule {}
