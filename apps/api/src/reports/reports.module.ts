import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { SeleccionReportService } from './seleccion-report.service';

@Module({ controllers: [ReportsController], providers: [ReportsService, SeleccionReportService] })
export class ReportsModule {}
