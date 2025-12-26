import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatClaveProdServ } from './entities/cat-clave-prod-serv.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CatClaveProdServ])],
  exports: [TypeOrmModule],
})
export class CatClaveProdServModule {}
