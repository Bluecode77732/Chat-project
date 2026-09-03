import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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

// CSV 내보내기용 고정 안전 상한 — 감사 로그는 저용량(권한 작업만 해당)이라
// 커서 기반 스트리밍보다 이 방식이 단순하며, 실제로 걸릴 일은 거의 없음.
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

  // 이 액션이 대상에 대해 이미 몇 번 기록됐는지 — ModerationService가 재차 밴 시
  // 영구 처분할지 판단하는 데 사용.
  async countByTarget(targetId: number, action: string): Promise<number> {
    return this.auditLogRepository.count({ where: { targetId, action } });
  }

  // findAll(페이지네이션 목록)과 exportCsv(플랫 CSV)가 공유하는 필터 생성 로직 —
  // action/날짜범위/userId 의미가 동일해 두 뷰가 어긋나지 않음.
  private buildWhere(
    query: AuditLogFilter,
  ): FindOptionsWhere<AuditLogEntity> | FindOptionsWhere<AuditLogEntity>[] {
    const actionFilter = query.action ? { action: query.action } : {};

    // And()로 같은 필드의 두 경계를 결합 — 따로 대입하면 뒤의 값이 앞의 값을 덮어씀.
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

    // userId 필터: 해당 사용자가 actor(행위자)이거나 target(대상)인 로그를 반환.
    // TypeORM WHERE 배열은 OR 의미이며, 각 항목에 action 필터도 함께 포함해
    // 두 분기 모두 action 드롭다운을 동시에 반영.
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
