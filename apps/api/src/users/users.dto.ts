import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsString() @IsNotEmpty() employeeId!: string;
  @IsEnum(Role) role!: Role;
}

export class UpdateUserRoleDto {
  @IsEnum(Role) role!: Role;
}

export class ListUsersQuery {
  @IsOptional() @IsString() employeeId?: string;
}
