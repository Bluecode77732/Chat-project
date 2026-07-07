import {
  Controller,
  ForbiddenException,
  Get,
  Body,
  Patch,
  Post,
  Param,
  Delete,
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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RBACguard } from 'src/auth/guard/rbac.guard';
import { RBAC } from 'src/auth/decorator/rbac.decorator';
import { UserRole } from 'src/auth/role/role';

@ApiTags('User API')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // Numeric privilege-level check (mirrors RBACguard) — admin and superadmin
  // must both be able to act on other accounts, not just an exact role match.
  private canActOnOthers(role?: UserRole): boolean {
    return (role ?? UserRole.user) >= UserRole.admin;
  }

  @Get()
  @UseGuards(RBACguard)
  @RBAC(UserRole.admin)
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  findOne(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    if (req.user?.id !== +id && !this.canActOnOthers(req.user?.role)) {
      throw new ForbiddenException('You can only view your own account');
    }
    return this.userService.findOne(+id);
  }

  @Patch(':id')
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
  forceLogout(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.userService.forceLogout(req.user.id, +id);
  }

  @Delete(':id')
  remove(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() deleteUserDto: DeleteUserDto,
  ) {
    if (req.user?.id !== +id && !this.canActOnOthers(req.user?.role)) {
      throw new ForbiddenException('You can only delete your own account');
    }
    // admin이 타인 삭제 시: rawToken 생략(admin 토큰 블랙리스트 방지), 패스워드 검증 스킵
    const isSelf = req.user?.id === +id;
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
