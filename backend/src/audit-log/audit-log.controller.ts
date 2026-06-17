import {
  Controller,
  Get,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RBACguard } from 'src/auth/guard/rbac.guard';
import { RBAC } from 'src/auth/decorator/rbac.decorator';
import { UserRole } from 'src/auth/role/role';
import { AuditLogService } from './audit-log.service';

@ApiTags('Audit Log API')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RBACguard)
@RBAC(UserRole.admin)
@UseInterceptors(ClassSerializerInterceptor)
@Controller('audit-log')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  findAll() {
    return this.auditLogService.findAll();
  }
}
