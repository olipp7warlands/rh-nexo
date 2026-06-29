import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Fase 2: flujo de ausencias de extremo a extremo.
 * Diego (EMPLEADO, e6) solicita → Carlos (MANAGER, e3, su manager) ve en cola y aprueba →
 * el saldo se actualiza. Verifica RBAC y limpia los datos creados.
 */
describe('Ausencias (integración)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let db: PrismaService;
  let empToken: string;
  let mgrToken: string;
  let absenceId: string | undefined;
  let original: { used: number; pending: number } | undefined;

  const EMP = 'e6'; // Diego
  const YEAR = 2026;

  const login = (email: string) =>
    request(http).post('/api/auth/login').send({ email, password: 'nucleo123' }).then((r) => r.body.accessToken);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    http = app.getHttpServer();
    db = moduleRef.get(PrismaService);

    empToken = await login('diego.ortega@grupo.com');
    mgrToken = await login('carlos.soto@grupo.com');
    const bal = await db.leaveBalance.findUnique({ where: { employeeId_year: { employeeId: EMP, year: YEAR } } });
    original = { used: bal!.used, pending: bal!.pending };
  });

  afterAll(async () => {
    if (absenceId) {
      await db.auditLog.deleteMany({ where: { entity: 'Absence', entityId: absenceId } });
      await db.absence.delete({ where: { id: absenceId } }).catch(() => undefined);
    }
    if (original) {
      await db.leaveBalance.update({
        where: { employeeId_year: { employeeId: EMP, year: YEAR } },
        data: original,
      });
    }
    await app.close();
  });

  it('el empleado crea una solicitud: calcula días laborables y suma a pending', async () => {
    // 2026-09-01 (mar) → 2026-09-07 (lun): 5 laborables (excluye 5 y 6, fin de semana).
    const res = await request(http)
      .post('/api/absences')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ type: 'VACACIONES', startDate: '2026-09-01', endDate: '2026-09-07', reason: 'Test' })
      .expect(201);
    absenceId = res.body.id;
    expect(res.body.days).toBe(5);
    expect(res.body.status).toBe('PENDIENTE');

    const bal = await db.leaveBalance.findUnique({ where: { employeeId_year: { employeeId: EMP, year: YEAR } } });
    expect(bal!.pending).toBe(original!.pending + 5);
  });

  it('aparece en la cola del manager (PENDIENTE)', async () => {
    const res = await request(http)
      .get('/api/absences?status=PENDIENTE')
      .set('Authorization', `Bearer ${mgrToken}`)
      .expect(200);
    expect(res.body.some((a: { id: string }) => a.id === absenceId)).toBe(true);
  });

  it('el empleado NO puede aprobar (403)', async () => {
    await request(http).patch(`/api/absences/${absenceId}/approve`).set('Authorization', `Bearer ${empToken}`).expect(403);
  });

  it('el manager aprueba: estado APROBADA y el saldo pasa de pending a used', async () => {
    const res = await request(http)
      .patch(`/api/absences/${absenceId}/approve`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .expect(200);
    expect(res.body.status).toBe('APROBADA');

    const bal = await db.leaveBalance.findUnique({ where: { employeeId_year: { employeeId: EMP, year: YEAR } } });
    expect(bal!.used).toBe(original!.used + 5);
    expect(bal!.pending).toBe(original!.pending);
  });

  it('exporta CSV con cabecera', async () => {
    const res = await request(http)
      .get('/api/absences/export')
      .set('Authorization', `Bearer ${mgrToken}`)
      .expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text.split('\n')[0]).toBe('Empleado;Tipo;Inicio;Fin;Días;Estado;Motivo');
  });
});
