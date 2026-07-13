import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RBACguard } from 'src/auth/guard/rbac.guard';
import { RBAC } from 'src/auth/decorator/rbac.decorator';
import { UserRole } from 'src/auth/role/role';
import { AuditLogService } from './audit-log.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@ApiTags('Audit Log API')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RBACguard)
@UseInterceptors(ClassSerializerInterceptor)
@Controller('audit-log')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @RBAC(UserRole.admin)
  @ApiOperation({
    summary: 'List privileged-action audit logs (admin)',
    description:
      'Paginated audit trail of ROLE_CHANGE, FORCE_LOGOUT, USER_DELETE, USER_UNBAN, USER_MUTED and USER_BANNED actions, optionally filtered by action, date range and sorted by time. Requires admin role.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated audit log entries.',
    schema: {
      example: {
        data: [
          {
            id: 1,
            actorId: 2,
            targetId: 3,
            action: 'ROLE_CHANGE',
            detail: 'user→admin',
            created: '2026-01-01T00:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        take: 20,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden. Admin role required.' })
  findAll(@Query() query: AuditLogQueryDto) {
    return this.auditLogService.findAll(query);
  }
}
