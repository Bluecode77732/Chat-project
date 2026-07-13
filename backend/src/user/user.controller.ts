import {
  Controller,
  ForbiddenException,
  Get,
  Body,
  Patch,
  Post,
  Param,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
  Request,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { UserService } from './user.service';

type AuthenticatedRequest = ExpressRequest & {
  user: { id: number; role: UserRole };
};
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { DeleteUserDto } from './dto/delete-user.dto';
import { UserEntity } from './entities/user.entity';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RBACguard } from 'src/auth/guard/rbac.guard';
import { RBAC } from 'src/auth/decorator/rbac.decorator';
import { UserRole } from 'src/auth/role/role';
import { ModerationService } from 'src/moderation/moderation.service';
import { ModerationStatus } from 'src/moderation/enums/moderation-status.enum';

@ApiTags('User API')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly moderationService: ModerationService,
  ) {}

  // Numeric privilege-level check (mirrors RBACguard) — admin and superadmin
  // must both be able to act on other accounts, not just an exact role match.
  private canActOnOthers(role?: UserRole): boolean {
    return (role ?? UserRole.user) >= UserRole.admin;
  }

  @Get()
  @UseGuards(RBACguard)
  @RBAC(UserRole.admin)
  @ApiOperation({
    summary: 'List users (admin)',
    description:
      'Paginated, sortable and searchable user list. Requires admin role.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'take', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['ASC', 'DESC'],
    description: 'Sort direction (default DESC).',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['id', 'role', 'created'],
    description: 'Sort field (default id).',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Case-insensitive match on email or nickname.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['active', 'banned'],
    description: 'Filter by moderation status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated user list.',
    schema: {
      example: {
        data: [
          {
            id: 1,
            email: 'x@gmail.com',
            nickname: 'Joon',
            role: 0,
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
  findAll(
    @Query('page') page?: string,
    @Query('take') take?: string,
    @Query('sort') sort?: string,
    @Query('sortBy') sortBy?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    const sortOrder = sort === 'ASC' ? 'ASC' : 'DESC';
    const sortField =
      sortBy === 'role' ? 'role' : sortBy === 'created' ? 'created' : 'id';
    const statusFilter =
      status === ModerationStatus.banned
        ? ModerationStatus.banned
        : status === ModerationStatus.active
          ? ModerationStatus.active
          : undefined;
    return this.userService.findAll(
      page ? parseInt(page, 10) : 1,
      take ? parseInt(take, 10) : 20,
      sortOrder,
      sortField,
      search || undefined,
      statusFilter,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single user',
    description:
      'Users can fetch only their own account; admins can fetch any.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Target user id.' })
  @ApiResponse({ status: 200, description: 'User found.', type: UserEntity })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Can only view your own account.',
  })
  @ApiResponse({ status: 404, description: 'User not found.' })
  findOne(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    if (req.user?.id !== +id && !this.canActOnOthers(req.user?.role)) {
      throw new ForbiddenException('You can only view your own account');
    }
    return this.userService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a user',
    description:
      'Users can update only their own account; admins can update any. All body fields are optional.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Target user id.' })
  @ApiResponse({ status: 200, description: 'Updated user.', type: UserEntity })
  @ApiResponse({ status: 400, description: 'Nickname already in use.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Can only update your own account.',
  })
  @ApiResponse({ status: 404, description: 'User not found.' })
  update(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    if (req.user?.id !== +id && !this.canActOnOthers(req.user?.role)) {
      throw new ForbiddenException('You can only update your own account');
    }
    return this.userService.update(+id, updateUserDto);
  }

  @Patch(':id/role')
  @UseGuards(RBACguard)
  @RBAC(UserRole.superadmin)
  @ApiOperation({
    summary: 'Change a user role (superadmin)',
    description:
      'Assigns a new role. Requires superadmin. Enforces the last-superadmin and admin-count population invariants, and writes an audit log entry.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Target user id.' })
  @ApiResponse({ status: 200, description: 'Role updated.', type: UserEntity })
  @ApiResponse({
    status: 400,
    description:
      'Cannot demote the last superadmin, or admin count limit reached.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Superadmin role required.',
  })
  @ApiResponse({ status: 404, description: 'User not found.' })
  updateRole(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
  ) {
    return this.userService.updateRole(req.user.id, +id, updateRoleDto.role);
  }

  @Post(':id/force-logout')
  @UseGuards(RBACguard)
  @RBAC(UserRole.admin)
  @ApiOperation({
    summary: 'Force-logout a user (admin)',
    description:
      "Disconnects the target user's active socket and marks the session offline. Requires admin; cannot act on a user with an equal or higher role.",
  })
  @ApiParam({ name: 'id', type: Number, description: 'Target user id.' })
  @ApiResponse({ status: 201, description: 'User force-logged out.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden. Admin role required, or target has an equal/higher role.',
  })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async forceLogout(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const target = await this.userService.findOne(+id);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if ((target.role ?? UserRole.user) >= (req.user?.role ?? UserRole.user)) {
      throw new ForbiddenException(
        'Cannot act on a user with equal or higher role',
      );
    }
    return this.userService.forceLogout(req.user.id, +id);
  }

  @Post(':id/unban')
  @UseGuards(RBACguard)
  @RBAC(UserRole.admin)
  @ApiOperation({
    summary: 'Clear a user moderation state (admin)',
    description:
      'Lifts any ban/mute and resets accrued strikes for a false-positive. Requires admin; cannot act on a user with an equal or higher role. Writes a USER_UNBAN audit entry.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Target user id.' })
  @ApiResponse({ status: 201, description: 'Moderation state cleared.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden. Admin role required, or target has an equal/higher role.',
  })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async unban(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    const target = await this.userService.findOne(+id);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if ((target.role ?? UserRole.user) >= (req.user?.role ?? UserRole.user)) {
      throw new ForbiddenException(
        'Cannot act on a user with equal or higher role',
      );
    }
    await this.moderationService.unban(req.user.id, +id);
    return `The user ${id} moderation state was cleared`;
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a user',
    description:
      'Self-deletion requires the current password in the body; an admin deleting another user skips the password check. Cascades room cleanup for orphaned rooms.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Target user id.' })
  @ApiResponse({
    status: 200,
    description: 'User deleted.',
    schema: { example: 'The user 1 is deleted' },
  })
  @ApiResponse({
    status: 400,
    description: 'Password required or invalid (self-deletion).',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden. Can only delete your own account, or target has an equal/higher role.',
  })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async remove(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() deleteUserDto: DeleteUserDto,
  ) {
    if (req.user?.id !== +id && !this.canActOnOthers(req.user?.role)) {
      throw new ForbiddenException('You can only delete your own account');
    }
    const isSelf = req.user?.id === +id;
    if (!isSelf) {
      const target = await this.userService.findOne(+id);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      if ((target.role ?? UserRole.user) >= (req.user?.role ?? UserRole.user)) {
        throw new ForbiddenException(
          'Cannot act on a user with equal or higher role',
        );
      }
    }
    // admin이 타인 삭제 시: rawToken 생략(admin 토큰 블랙리스트 방지), 패스워드 검증 스킵
    const rawToken = isSelf ? req.headers['authorization'] : undefined;
    const skipPasswordCheck = !isSelf;
    return this.userService.remove(
      req.user.id,
      +id,
      deleteUserDto.password,
      rawToken,
      skipPasswordCheck,
    );
  }
}
