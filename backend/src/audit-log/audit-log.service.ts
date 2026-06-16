import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from './audit-log.entity';
import { logger } from 'src/base/logger/logger';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepository: Repository<AuditLogEntity>,
  ) {}

  async log(
    actorId: number,
    targetId: number | null,
    action: string,
    detail?: string,
  ): Promise<void> {
    await this.auditLogRepository.save({ actorId, targetId, action, detail });
    logger.info(
      `[AUDIT] actor=${actorId} action=${action} target=${targetId ?? 'N/A'}${detail ? ` detail=${detail}` : ''}`,
    );
  }

  async findAll(): Promise<AuditLogEntity[]> {
    return this.auditLogRepository.find({
      order: { created: 'DESC' },
      take: 100,
    });
  }
}
