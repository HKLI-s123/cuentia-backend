import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usage } from './entities/usage.entity';

@Injectable()
export class UsageService {
  constructor(
    @InjectRepository(Usage)
    private readonly usageRepo: Repository<Usage>,
  ) {}

  private getCurrentPeriod(): string {
    const now = new Date();
    return now.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  async getUsage(userId: number, feature: Usage['feature']): Promise<number> {
    const period = this.getCurrentPeriod();

    const record = await this.usageRepo.findOne({
      where: { userId, feature, period },
    });

    return record?.count ?? 0;
  }

  async increment(userId: number, feature: Usage['feature'], amount = 1) {
    const period = this.getCurrentPeriod();

    let record = await this.usageRepo.findOne({
      where: { userId, feature, period },
    });

    if (!record) {
      record = this.usageRepo.create({
        userId,
        feature,
        period,
        count: amount,
      });
    } else {
      record.count += amount;
    }

    await this.usageRepo.save(record);
  }
}
