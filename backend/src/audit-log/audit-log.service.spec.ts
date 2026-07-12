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

    // userId filter passes an OR-array so logs where the user was actor OR target are returned.
    it('passes an OR-array where clause when userId is provided.', async () => {
      mockAuditLogRepository.findAndCount.mockResolvedValue([[], 3]);

      await auditLogService.findAll({ userId: 7 });

      expect(mockAuditLogRepository.findAndCount).toHaveBeenCalledWith({
        where: [{ actorId: 7 }, { targetId: 7 }],
        order: { created: 'DESC' },
        skip: 0,
        take: 20,
      });
    });

    // When both userId and action are supplied both branches of the OR carry the action filter.
    it('combines userId OR-array with action filter when both are supplied.', async () => {
      mockAuditLogRepository.findAndCount.mockResolvedValue([[], 1]);

      await auditLogService.findAll({ userId: 7, action: 'ROLE_CHANGE' });

      expect(mockAuditLogRepository.findAndCount).toHaveBeenCalledWith({
        where: [
          { actorId: 7, action: 'ROLE_CHANGE' },
          { targetId: 7, action: 'ROLE_CHANGE' },
        ],
        order: { created: 'DESC' },
        skip: 0,
        take: 20,
      });
    });
  });
});
