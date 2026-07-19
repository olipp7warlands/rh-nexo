import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { PrismaModule } from './prisma/prisma.module';
import { EmployeesModule } from './employees/employees.module';
import { DepartmentsModule } from './departments/departments.module';
import { PaisesModule } from './paises/paises.module';
import { SociedadesModule } from './sociedades/sociedades.module';
import { LocalizacionesModule } from './localizaciones/localizaciones.module';
import { CategoriasModule } from './categorias/categorias.module';
import { AnotacionesModule } from './anotaciones/anotaciones.module';
import { AgendaModule } from './agenda/agenda.module';
import { AbsencesModule } from './absences/absences.module';
import { HolidaysModule } from './holidays/holidays.module';
import { ProcesosModule } from './procesos/procesos.module';
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
    // Límite base por IP para toda la API (100 req/min); /auth/login y /auth/refresh llevan
    // un límite más estricto con @Throttle() (auditoría A1 — sin esto, el login no tenía
    // ninguna protección contra fuerza bruta / credential stuffing).
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    // Sirve el build de apps/web (un solo servicio en Railway: API + frontend en la misma URL).
    // Ruta relativa desde el compilado apps/api/dist/main.js hasta apps/web/dist.
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'web', 'dist'),
      // `exclude` lo evalúa @nestjs/serve-static con SU PROPIA dependencia de path-to-regexp
      // (v8, sintaxis de wildcard con nombre) — '/api/(.*)' (sintaxis vieja) lanza "Unexpected
      // (" y rompe el fallback en silencio.
      exclude: ['/api/{*splat}'],
      // `renderPath` lo registra Express con SU PROPIA path-to-regexp (0.1.x, bundlada con
      // express@4, sintaxis clásica) — el default del paquete ('{*any}', sintaxis v8) no
      // coincide con nada bajo esa versión y el fallback a index.html nunca se dispara.
      renderPath: '*',
    }),
    PrismaModule,
    StorageModule,
    HealthModule,
    AuthModule,
    EmployeesModule,
    DepartmentsModule,
    PaisesModule,
    SociedadesModule,
    LocalizacionesModule,
    CategoriasModule,
    AnotacionesModule,
    AgendaModule,
    AbsencesModule,
    HolidaysModule,
    ProcesosModule,
    PerformanceModule,
    ReportsModule,
    PayrollModule,
    DocumentsModule,
    JobsModule,
    CandidatesModule,
    ApplicationsModule,
  ],
  // Guards globales: primero rate limiting, luego exige JWT, luego aplica RBAC (@Roles).
  // ThrottlerGuard corre en TODAS las rutas (incluidas las @Public()) — no depende del JWT.
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
