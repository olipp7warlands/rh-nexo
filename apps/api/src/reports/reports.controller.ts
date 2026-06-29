import { Controller, Get, Header, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { Roles } from '../auth/decorators/roles.decorator';

// Analítica con datos sensibles (coste de plantilla): solo RRHH/ADMIN.
@Roles('ADMIN', 'RRHH')
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('overview')
  overview(@Query('departmentId') departmentId?: string) {
    return this.service.overview(departmentId);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="informe-plantilla.csv"')
  export(@Query('departmentId') departmentId?: string) {
    return this.service.exportCsv(departmentId);
  }
}
