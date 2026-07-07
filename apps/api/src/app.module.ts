import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { EmployeesModule } from './employees/employees.module';
import { DepartmentsModule } from './departments/departments.module';
import { AbsencesModule } from './absences/absences.module';
import { HolidaysModule } from './holidays/holidays.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { PerformanceModule } from './performance/performance.module';
import { ReportsModule } from './reports/reports.module';
import { PayrollModule } from './payroll/payroll.module';
import { DocumentsModule } from './documents/documents.module';
import { JobsModule } from './jobs/jobs.module';
import { CandidatesModule } from './candidates/candidates.module';
import { ApplicationsModule } from './applications/applications.module';
import { StorageModule } from './storage/storage.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    // El .env vive en la raíz del monorepo (la API arranca desde apps/api).
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env', '.env'] }),
    PrismaModule,
    StorageModule,
    HealthModule,
    AuthModule,
    EmployeesModule,
    DepartmentsModule,
    AbsencesModule,
    HolidaysModule,
    OnboardingModule,
    PerformanceModule,
    ReportsModule,
    PayrollModule,
    DocumentsModule,
    JobsModule,
    CandidatesModule,
    ApplicationsModule,
  ],
  // Guards globales: primero exige JWT, luego aplica RBAC (@Roles).
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
