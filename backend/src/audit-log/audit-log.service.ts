import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from './audit-log.entity';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { logger } from 'src/base/logger/logger';

export interface PaginatedAuditLog {
  data: AuditLogEntity[];
  total: number;
  page: number;
  take: number;
}

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
    await this.auditLogRepository.save({
      actorId,
      targetId: targetId ?? undefined,
      action,
      detail,
    });
    logger.info(
      `[AUDIT] actor=${actorId} action=${action} target=${targetId ?? 'N/A'}${detail ? ` detail=${detail}` : ''}`,
    );
  }

  async findAll(query: AuditLogQueryDto): Promise<PaginatedAuditLog> {
    const page = query.page ?? 1;
    const take = query.take ?? 20;

    const [data, total] = await this.auditLogRepository.findAndCount({
      where: query.action ? { action: query.action } : {},
      order: { created: 'DESC' },
      skip: (page - 1) * take,
      take,
    });

    return { data, total, page, take };
  }
}
