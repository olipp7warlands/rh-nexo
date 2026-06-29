import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Fase 1: alta de empleado persiste + audita, listado de departamentos y filtro
 * por estado. Crea un empleado de prueba y lo limpia al final (hard delete).
 * Requiere Postgres sembrado.
 */
describe('Empleados + Departamentos (integración)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let db: PrismaService;
  let token: string;
  let createdId: string | undefined;

  const TEST_EMAIL = 'test.alta.fase1@example.com';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    http = app.getHttpServer();
    db = moduleRef.get(PrismaService);

    const login = await request(http)
      .post('/api/auth/login')
      .send({ email: 'admin@grupo.com', password: 'nucleo123' });
    token = login.body.accessToken;
  });

  afterAll(async () => {
    if (createdId) {
      await db.auditLog.deleteMany({ where: { entity: 'Employee', entityId: createdId } });
      await db.employee.delete({ where: { id: createdId } }).catch(() => undefined);
    }
    await app.close();
  });

  it('lista departamentos con lead y nº de miembros', async () => {
    const res = await request(http).get('/api/departments').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(8);
    expect(res.body[0]).toHaveProperty('_count.members');
  });

  it('crea un empleado: persiste y escribe en AuditLog', async () => {
    const res = await request(http)
      .post('/api/employees')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Empleado De Prueba',
        email: TEST_EMAIL,
        jobTitle: 'QA Engineer',
        level: 'mid',
        location: 'Madrid',
        startDate: '2026-06-01',
        departmentId: 'd-eng',
        status: 'ONBOARDING',
        salary: 40000,
      })
      .expect(201);
    createdId = res.body.id;
    expect(createdId).toBeTruthy();

    // Persiste: se recupera por id.
    const fetched = await request(http)
      .get(`/api/employees/${createdId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(fetched.body.email).toBe(TEST_EMAIL);

    // Audita: hay un registro CREATE para la entidad.
    const audit = await db.auditLog.findFirst({
      where: { entity: 'Employee', entityId: createdId, action: 'CREATE' },
    });
    expect(audit).not.toBeNull();
  });

  it('filtra empleados por estado (ONBOARDING incluye al recién creado)', async () => {
    const res = await request(http)
      .get('/api/employees?status=ONBOARDING')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.every((e: { status: string }) => e.status === 'ONBOARDING')).toBe(true);
    expect(res.body.some((e: { id: string }) => e.id === createdId)).toBe(true);
  });

  it('edita un empleado: persiste el cambio y escribe AuditLog UPDATE', async () => {
    await request(http)
      .patch(`/api/employees/${createdId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ jobTitle: 'Senior QA Engineer', status: 'ACTIVO' })
      .expect(200);

    const fetched = await request(http)
      .get(`/api/employees/${createdId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(fetched.body.jobTitle).toBe('Senior QA Engineer');
    expect(fetched.body.status).toBe('ACTIVO');

    const audit = await db.auditLog.findFirst({
      where: { entity: 'Employee', entityId: createdId, action: 'UPDATE' },
    });
    expect(audit).not.toBeNull();
  });
});
