import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { UserRole } from 'src/auth/role/role';

export class UpdateRoleDto {
  @ApiProperty({ enum: UserRole, description: 'Target role to assign' })
  @IsNotEmpty()
  @IsEnum(UserRole)
  role!: UserRole;
}
