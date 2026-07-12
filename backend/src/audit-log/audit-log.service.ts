import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
// FindOptionsWhere: needed to type the OR-array where clause used by the userId filter.
import { FindOptionsWhere, Repository } from 'typeorm';
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

  // How many times this action was already recorded against a target — used by
  // ModerationService to decide a repeat ban should be permanent rather than timed.
  async countByTarget(targetId: number, action: string): Promise<number> {
    return this.auditLogRepository.count({ where: { targetId, action } });
  }

  async findAll(query: AuditLogQueryDto): Promise<PaginatedAuditLog> {
    const page = query.page ?? 1;
    const take = query.take ?? 20;
    const actionFilter = query.action ? { action: query.action } : {};

    // userId filter: returns logs where the user was either the actor (performed the action)
    // or the target (was acted upon). TypeORM WHERE array = OR; each element also carries
    // the action filter so both branches respect the action dropdown simultaneously.
    let where:
      | FindOptionsWhere<AuditLogEntity>
      | FindOptionsWhere<AuditLogEntity>[];
    if (query.userId !== undefined) {
      where = [
        { actorId: query.userId, ...actionFilter },
        { targetId: query.userId, ...actionFilter },
      ];
    } else {
      where = actionFilter;
    }

    const [data, total] = await this.auditLogRepository.findAndCount({
      where,
      order: { created: query.sort ?? 'DESC' },
      skip: (page - 1) * take,
      take,
    });

    return { data, total, page, take };
  }
}
