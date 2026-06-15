import {
  Controller,
  ForbiddenException,
  Get,
  Body,
  Patch,
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

  @Get()
  @UseGuards(RBACguard)
  @RBAC(UserRole.admin)
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  findOne(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    if (req.user?.id !== +id && req.user?.role !== UserRole.admin) {
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
    if (req.user?.id !== +id && req.user?.role !== UserRole.admin) {
      throw new ForbiddenException('You can only update your own account');
    }
    return this.userService.update(+id, updateUserDto);
  }

  @Delete(':id')
  remove(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() deleteUserDto: DeleteUserDto,
  ) {
    if (req.user?.id !== +id && req.user?.role !== UserRole.admin) {
      throw new ForbiddenException('You can only delete your own account');
    }
    // admin이 타인을 삭제할 때는 rawToken 전달 생략 — admin 토큰이 블랙리스트에 등록되는 것을 방지
    const rawToken =
      req.user?.id === +id ? req.headers['authorization'] : undefined;
    return this.userService.remove(+id, deleteUserDto.password, rawToken);
  }
}
