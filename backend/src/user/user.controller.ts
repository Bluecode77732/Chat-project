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
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
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
  findOne(@Param('id') id: string) {
    return this.userService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    if (req.user?.id !== +id) {
      throw new ForbiddenException('You can only update your own account');
    }
    return this.userService.update(+id, updateUserDto);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    if (req.user?.id !== +id) {
      throw new ForbiddenException('You can only delete your own account');
    }
    return this.userService.remove(+id);
  }
}
