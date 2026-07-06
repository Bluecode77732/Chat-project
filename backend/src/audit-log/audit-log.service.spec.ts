import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLogService } from './audit-log.service';
import { AuditLogEntity } from './audit-log.entity';

describe('AuditLogService', () => {
  let auditLogService: AuditLogService;

  const mockAuditLogRepository = {
    save: jest.fn(),
    findAndCount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        {
          provide: getRepositoryToken(AuditLogEntity),
          useValue: mockAuditLogRepository,
        },
      ],
    }).compile();

    auditLogService = module.get<AuditLogService>(AuditLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('saves an audit entry with the target id when provided.', async () => {
      mockAuditLogRepository.save.mockResolvedValue(undefined);

      await auditLogService.log(1, 2, 'ROLE_CHANGE', 'user→admin');

      expect(mockAuditLogRepository.save).toHaveBeenCalledWith({
        actorId: 1,
        targetId: 2,
        action: 'ROLE_CHANGE',
        detail: 'user→admin',
      });
    });

    it('saves an audit entry without a target id when null is passed.', async () => {
      mockAuditLogRepository.save.mockResolvedValue(undefined);

      await auditLogService.log(1, null, 'FORCE_LOGOUT');

      expect(mockAuditLogRepository.save).toHaveBeenCalledWith({
        actorId: 1,
        targetId: undefined,
        action: 'FORCE_LOGOUT',
        detail: undefined,
      });
    });
  });

  describe('findAll', () => {
    it('paginates with default page/take and no action filter.', async () => {
      mockAuditLogRepository.findAndCount.mockResolvedValue([[], 0]);

      const result = await auditLogService.findAll({});

      expect(mockAuditLogRepository.findAndCount).toHaveBeenCalledWith({
        where: {},
        order: { created: 'DESC' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({ data: [], total: 0, page: 1, take: 20 });
    });

    it('applies the action filter and computes the skip offset for the requested page.', async () => {
      mockAuditLogRepository.findAndCount.mockResolvedValue([[], 5]);

      const result = await auditLogService.findAll({
        action: 'USER_DELETE',
        page: 3,
        take: 10,
      });

      expect(mockAuditLogRepository.findAndCount).toHaveBeenCalledWith({
        where: { action: 'USER_DELETE' },
        order: { created: 'DESC' },
        skip: 20,
        take: 10,
      });
      expect(result).toEqual({ data: [], total: 5, page: 3, take: 10 });
    });
  });
});
