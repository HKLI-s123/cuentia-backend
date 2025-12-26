import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { MailService } from '../mail/mail.service';
import { SupportRequest } from './entities/support-request.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([SupportRequest]) // entidad opcional
  ],
  controllers: [SupportController],
  providers: [SupportService, MailService],
  exports: [SupportService],
})
export class SupportModule {}
