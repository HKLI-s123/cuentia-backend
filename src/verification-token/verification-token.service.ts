// src/verification-token/verification-token.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VerificationToken } from './entities/verification-token.entity';

@Injectable()
export class VerificationTokenService {
  constructor(
    @InjectRepository(VerificationToken)
    private readonly vtRepo: Repository<VerificationToken>,
  ) {}

  async createToken(userId: number, token: string, expiresAt: Date) {
    const vt = this.vtRepo.create({
      token,
      userId,
      expiresAt,
    });
    return this.vtRepo.save(vt);
  }

  findByToken(token: string) {
    return this.vtRepo.findOne({ where: { token } });
  }

  async markAsUsed(id: number) {
    return this.vtRepo.update({ id }, { used: true });
  }
}
