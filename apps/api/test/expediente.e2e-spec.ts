import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Fase E (humanX): ficha enriquecida — histórico de puesto/salarial (solo lectura, sembrado
 * en prisma/seed.ts) y registro de acceso (AuditLog VIEW) al abrir una ficha. Requiere
 * Postgres sembrado.
 */
describe('Expediente: histórico + registro de accesos (integración)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let db: PrismaService;
  let adminToken: string;
  let empleadoToken: string; // diego.ortega@grupo.com, employeeId e6 — sin salario sembrado

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    http = app.getHttpServer();
    db = moduleRef.get(PrismaService);

    const admin = await request(http).post('/api/auth/login').send({ email: 'admin@grupo.com', password: 'nucleo123' });
    adminToken = admin.body.accessToken;
    const empleado = await request(http).post('/api/auth/login').send({ email: 'diego.ortega@grupo.com', password: 'nucleo123' });
    empleadoToken = empleado.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('histórico de puestos: e3 tiene 2 registros, el más reciente sin fechaFin (actual)', async () => {
    const res = await request(http).get('/api/employees/e3/historico-puestos').set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(res.body.length).toBe(2);
    expect(res.body[0].fechaFin).toBeNull();
    expect(res.body[0].titulo).toBe('VP Engineering');
    expect(res.body[1].titulo).toBe('Tech Lead');
  });

  it('histórico de puestos: un empleado sin privilegio no puede ver el de otra persona (403)', async () => {
    await request(http).get('/api/employees/e3/historico-puestos').set('Authorization', `Bearer ${empleadoToken}`).expect(403);
  });

  it('histórico de puestos: un empleado SÍ puede ver el suyo propio', async () => {
    const res = await request(http).get('/api/employees/e6/historico-puestos').set('Authorization', `Bearer ${empleadoToken}`).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('histórico salarial: RRHH/ADMIN lo ve completo, con los importes sembrados', async () => {
    const res = await request(http).get('/api/employees/e3/historico-salarial').set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(res.body.length).toBe(2);
    expect(res.body[0].brutoAnual).toBe(95000);
    expect(res.body[1].brutoAnual).toBe(78000);
  });

  it('histórico salarial: un empleado sin privilegio no puede ver el de otra persona (403)', async () => {
    await request(http).get('/api/employees/e3/historico-salarial').set('Authorization', `Bearer ${empleadoToken}`).expect(403);
  });

  it('histórico salarial: un empleado SÍ puede ver el suyo propio', async () => {
    // diego.ortega -> employeeId e6, sin histórico sembrado, pero debe responder 200 (lista vacía), no 403.
    const res = await request(http).get('/api/employees/e6/historico-salarial').set('Authorization', `Bearer ${empleadoToken}`).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('abrir una ficha registra un acceso VIEW en AuditLog', async () => {
    const before = await db.auditLog.count({ where: { entity: 'Employee', entityId: 'e5', action: 'VIEW' } });
    await request(http).get('/api/employees/e5').set('Authorization', `Bearer ${adminToken}`).expect(200);
    const after = await db.auditLog.count({ where: { entity: 'Employee', entityId: 'e5', action: 'VIEW' } });
    expect(after).toBe(before + 1);
  });

  it('editar una ficha NO duplica el registro de acceso (la lectura interna de update() no audita VIEW)', async () => {
    const before = await db.auditLog.count({ where: { entity: 'Employee', entityId: 'e6', action: 'VIEW' } });
    await request(http)
      .patch('/api/employees/e6')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ jobTitle: 'Backend Engineer' })
      .expect(200);
    const after = await db.auditLog.count({ where: { entity: 'Employee', entityId: 'e6', action: 'VIEW' } });
    expect(after).toBe(before);
  });
});
