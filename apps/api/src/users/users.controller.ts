import { Body, Controller, Get, Header, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, ListUsersQuery, UpdateUserRoleDto } from './users.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

/** Gestión de cuentas: solo ADMIN (ni siquiera RRHH). Nunca hay DELETE: las cuentas se desactivan. */
@Roles('ADMIN')
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  list(@Query() q: ListUsersQuery) {
    return this.service.list(q.employeeId);
  }

  // `no-store`: la respuesta lleva la contraseña temporal, que se muestra una sola vez.
  @Header('Cache-Control', 'no-store')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  updateRole(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateUserRoleDto) {
    return this.service.updateRole(id, dto.role, user);
  }

  @HttpCode(200)
  @Post(':id/deactivate')
  deactivate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.deactivate(id, user);
  }

  @HttpCode(200)
  @Post(':id/reactivate')
  reactivate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.reactivate(id, user);
  }

  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @Post(':id/reset-password')
  resetPassword(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.resetPassword(id, user);
  }
}
