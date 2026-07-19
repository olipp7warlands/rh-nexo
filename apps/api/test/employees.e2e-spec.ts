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
      const procesos = await db.proceso.findMany({ where: { employeeId: createdId } });
      await db.procesoTarea.deleteMany({ where: { procesoId: { in: procesos.map((p) => p.id) } } });
      await db.auditLog.deleteMany({ where: { entity: 'Proceso', entityId: { in: procesos.map((p) => p.id) } } });
      await db.proceso.deleteMany({ where: { employeeId: createdId } });
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

  // Auditoría C2: solo salary/iban se enmascaraban para viewers no privilegiados; dni,
  // address, emergency y birthday se devolvían en claro a cualquier autenticado.
  it('un EMPLEADO no ve el dni/dirección/contacto de emergencia/cumpleaños de otro compañero', async () => {
    const empLogin = await request(http).post('/api/auth/login').send({ email: 'diego.ortega@grupo.com', password: 'nucleo123' });
    const empToken = empLogin.body.accessToken;

    const res = await request(http).get('/api/employees/e1').set('Authorization', `Bearer ${empToken}`).expect(200);
    expect(res.body.dni).toBeNull();
    expect(res.body.address).toBeNull();
    expect(res.body.emergency).toBeNull();
    expect(res.body.birthday).toBeNull();
    expect(res.body.salary).toBeNull();
    expect(res.body.iban).toBeNull();
    // El resto de la ficha sigue siendo visible (directorio normal).
    expect(res.body.fullName).toBe('Elena Vázquez');
  });

  it('ADMIN/RRHH y el propio empleado sí ven esos campos', async () => {
    const res = await request(http).get('/api/employees/e1').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body.dni).not.toBeNull();
    expect(res.body.address).not.toBeNull();

    const selfLogin = await request(http).post('/api/auth/login').send({ email: 'diego.ortega@grupo.com', password: 'nucleo123' });
    const selfRes = await request(http)
      .get('/api/employees/e6')
      .set('Authorization', `Bearer ${selfLogin.body.accessToken}`)
      .expect(200);
    expect(selfRes.body.dni).not.toBeNull();
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

  it('dar de baja: MANAGER/EMPLEADO no pueden (403)', async () => {
    const managerLogin = await request(http).post('/api/auth/login').send({ email: 'carlos.soto@grupo.com', password: 'nucleo123' });
    await request(http)
      .post(`/api/employees/${createdId}/baja`)
      .set('Authorization', `Bearer ${managerLogin.body.accessToken}`)
      .send({ fecha: '2026-07-17' })
      .expect(403);

    const empLogin = await request(http).post('/api/auth/login').send({ email: 'diego.ortega@grupo.com', password: 'nucleo123' });
    await request(http)
      .post(`/api/employees/${createdId}/baja`)
      .set('Authorization', `Bearer ${empLogin.body.accessToken}`)
      .send({ fecha: '2026-07-17' })
      .expect(403);
  });

  // Antes eran dos llamadas independientes desde el modal (crear Proceso, luego borrar
  // empleado); ahora es un único endpoint atómico — comprobamos que las DOS escrituras caen
  // juntas: el estado pasa a BAJA Y se abre el Offboarding con la plantilla activa.
  it('dar de baja: RRHH/ADMIN crea el Offboarding y marca BAJA de forma atómica, con doble auditoría', async () => {
    const res = await request(http)
      .post(`/api/employees/${createdId}/baja`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fecha: '2026-07-17' })
      .expect(201);
    expect(res.body.employee.status).toBe('BAJA');
    expect(res.body.proceso.tipo).toBe('OFFBOARDING');
    expect(res.body.proceso.tareas.length).toBeGreaterThan(0);

    const fetched = await request(http).get(`/api/employees/${createdId}`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(fetched.body.status).toBe('BAJA');

    const proceso = await db.proceso.findFirst({ where: { employeeId: createdId, tipo: 'OFFBOARDING' } });
    expect(proceso).not.toBeNull();

    const employeeAudit = await db.auditLog.findFirst({ where: { entity: 'Employee', entityId: createdId, action: 'DELETE' } });
    expect(employeeAudit).not.toBeNull();
    const procesoAudit = await db.auditLog.findFirst({ where: { entity: 'Proceso', entityId: proceso!.id, action: 'CREATE' } });
    expect(procesoAudit).not.toBeNull();
  });

  it('dar de baja: no se puede repetir sobre alguien que ya está de baja (400)', async () => {
    await request(http)
      .post(`/api/employees/${createdId}/baja`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fecha: '2026-07-17' })
      .expect(400);
  });
});
