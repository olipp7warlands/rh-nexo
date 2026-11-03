import { Controller, Get, Header, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { SeleccionReportService } from './seleccion-report.service';
import { SeleccionReportQueryDto } from './seleccion-report.dto';

// Analítica con datos sensibles (coste de plantilla): solo RRHH/ADMIN.
@Roles('ADMIN', 'RRHH')
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly service: ReportsService,
    private readonly seleccion: SeleccionReportService,
  ) {}

  /** Analítica de procesos de selección: solo agregados, sin nombres de candidatos. Audita VIEW. */
  @Get('seleccion')
  seleccionReport(@CurrentUser() user: AuthUser, @Query() query: SeleccionReportQueryDto) {
    return this.seleccion.report(query, user);
  }

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
