import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
// FindOptionsWhere: needed to type the OR-array where clause used by the userId filter.
import {
  And,
  FindOptionsWhere,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { AuditLogEntity } from './audit-log.entity';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { AuditLogExportQueryDto } from './dto/audit-log-export-query.dto';
import { logger } from 'src/base/logger/logger';

export interface PaginatedAuditLog {
  data: AuditLogEntity[];
  total: number;
  page: number;
  take: number;
}

// Flat safety cap for CSV export — audit logs are low-volume (privileged actions only),
// so this bound is simpler than cursor-based streaming and is expected to rarely trigger.
const AUDIT_LOG_EXPORT_MAX_ROWS = 10_000;

type AuditLogFilter = Pick<
  AuditLogQueryDto,
  'action' | 'userId' | 'from' | 'to'
>;

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

  // Shared filter-building logic for findAll (paginated list) and exportCsv (flat CSV) —
  // same action/date-range/userId semantics for both, so the two views never diverge.
  private buildWhere(
    query: AuditLogFilter,
  ): FindOptionsWhere<AuditLogEntity> | FindOptionsWhere<AuditLogEntity>[] {
    const actionFilter = query.action ? { action: query.action } : {};

    // Date range: build a created filter using And/MoreThanOrEqual/LessThanOrEqual
    // so both from and to can be applied to the same field simultaneously.
    const dateFilter: FindOptionsWhere<AuditLogEntity> = {};
    if (query.from && query.to) {
      dateFilter.created = And(
        MoreThanOrEqual(new Date(query.from)),
        LessThanOrEqual(new Date(query.to)),
      );
    } else if (query.from) {
      dateFilter.created = MoreThanOrEqual(new Date(query.from));
    } else if (query.to) {
      dateFilter.created = LessThanOrEqual(new Date(query.to));
    }

    // userId filter: returns logs where the user was either the actor (performed the action)
    // or the target (was acted upon). TypeORM WHERE array = OR; each element also carries
    // the action filter so both branches respect the action dropdown simultaneously.
    if (query.userId !== undefined) {
      return [
        { actorId: query.userId, ...actionFilter, ...dateFilter },
        { targetId: query.userId, ...actionFilter, ...dateFilter },
      ];
    }
    return { ...actionFilter, ...dateFilter };
  }

  async findAll(query: AuditLogQueryDto): Promise<PaginatedAuditLog> {
    const page = query.page ?? 1;
    const take = query.take ?? 20;
    const where = this.buildWhere(query);

    const [data, total] = await this.auditLogRepository.findAndCount({
      where,
      order: { created: query.sort ?? 'DESC' },
      skip: (page - 1) * take,
      take,
    });

    return { data, total, page, take };
  }

  async exportCsv(query: AuditLogExportQueryDto): Promise<string> {
    const where = this.buildWhere(query);
    const rows = await this.auditLogRepository.find({
      where,
      order: { created: query.sort ?? 'DESC' },
      take: AUDIT_LOG_EXPORT_MAX_ROWS,
    });
    return this.toCsv(rows);
  }

  private toCsv(rows: AuditLogEntity[]): string {
    const escape = (value: string | number | null | undefined): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const header = 'id,actorId,targetId,action,detail,created';
    const lines = rows.map((row) =>
      [
        row.id,
        row.actorId,
        row.targetId,
        row.action,
        row.detail,
        row.created instanceof Date ? row.created.toISOString() : row.created,
      ]
        .map(escape)
        .join(','),
    );
    return [header, ...lines].join('\n');
  }
}
