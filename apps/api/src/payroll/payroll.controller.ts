import { Body, Controller, Get, Header, Param, Patch, Post } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { AddItemDto, GenerateRunDto } from './payroll.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

@Controller('payroll')
export class PayrollController {
  constructor(private readonly service: PayrollService) {}

  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.service.mine(user);
  }

  @Get('payslips/:id/document')
  @Header('Content-Type', 'text/html; charset=utf-8')
  document(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.payslipDocument(id, user);
  }

  @Roles('ADMIN', 'RRHH')
  @Get('runs')
  runs() {
    return this.service.runs();
  }

  @Roles('ADMIN', 'RRHH')
  @Post('runs')
  generate(@CurrentUser() user: AuthUser, @Body() dto: GenerateRunDto) {
    return this.service.generate(dto.period, user);
  }

  @Roles('ADMIN', 'RRHH')
  @Get('runs/:id')
  run(@Param('id') id: string) {
    return this.service.run(id);
  }

  @Roles('ADMIN', 'RRHH')
  @Get('runs/:id/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="nomina.csv"')
  export(@Param('id') id: string) {
    return this.service.exportCsv(id);
  }

  @Roles('ADMIN', 'RRHH')
  @Post('runs/:id/items')
  addItem(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddItemDto) {
    return this.service.addItem(id, dto, user);
  }

  @Roles('ADMIN', 'RRHH')
  @Patch('runs/:id/process')
  process(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.process(id, user);
  }
}
