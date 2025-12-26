// src/verification-token/verification-token.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VerificationToken } from './entities/verification-token.entity';
import { VerificationTokenService } from './verification-token.service';

@Module({
  imports: [TypeOrmModule.forFeature([VerificationToken])],
  providers: [VerificationTokenService],
  exports: [VerificationTokenService],
})
export class VerificationTokenModule {}
