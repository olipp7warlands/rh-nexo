import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Informes (integración)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let token: string;
  let db: PrismaService;

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
    token = await login('blanca.ruiz@grupo.com');
  });

  afterAll(async () => {
    await app.close();
  });

  it('overview cuadra con los conteos reales de la BD', async () => {
    const res = await request(http).get('/api/reports/overview').set('Authorization', `Bearer ${token}`).expect(200);
    // No comparamos contra un count() en vivo: employees.e2e-spec.ts crea/borra un empleado de
    // prueba en paralelo y contaminaría el número exacto. En su lugar comprobamos que al menos
    // la plantilla estable del seed (17 empleados, uno BAJA — e15, caso de ejemplo de
    // Offboarding) está contada, y que las distintas secciones del informe son internamente
    // consistentes entre sí.
    const { totalActive, totalAll } = res.body.headcount;
    expect(totalActive).toBeGreaterThanOrEqual(16);
    expect(totalAll).toBeGreaterThanOrEqual(totalActive);
    // La suma por departamento de plantilla activa cuadra con el total activo.
    const sumDept = res.body.headcount.byDept.reduce((s: number, d: { count: number }) => s + d.count, 0);
    expect(sumDept).toBe(totalActive);
    // Estructura de las demás secciones.
    expect(res.body.cost.total).toBeGreaterThan(0);
    expect(Array.isArray(res.body.performance.distribution)).toBe(true);
    expect(res.body.diversity.remote + res.body.diversity.onsite).toBe(totalActive);
  });

  it('RBAC: un EMPLEADO no puede ver informes (403)', async () => {
    const empToken = await login('diego.ortega@grupo.com');
    await request(http).get('/api/reports/overview').set('Authorization', `Bearer ${empToken}`).expect(403);
  });

  // El nombre de departamento lo escribe un usuario (ADMIN/RRHH): pasa por csvSafe como el resto
  // de valores de texto de los CSV exportados.
  it('export CSV: un nombre de departamento con forma de fórmula llega neutralizado', async () => {
    const dept = await db.department.findFirstOrThrow({ where: { members: { some: { status: { not: 'BAJA' } } } } });
    const payload = '=HYPERLINK("http://evil.example","click")';
    await db.department.update({ where: { id: dept.id }, data: { name: payload } });
    try {
      const res = await request(http).get('/api/reports/export').set('Authorization', `Bearer ${token}`).expect(200);
      const lines = res.text.split('\n');
      expect(lines[0]).toBe('Departamento;Plantilla activa;Coste anual (€)');
      expect(lines.some((l) => l.startsWith(`"'${payload.replace(/"/g, '""')}";`))).toBe(true);
      expect(lines.some((l) => l.startsWith('='))).toBe(false);
    } finally {
      await db.department.update({ where: { id: dept.id }, data: { name: dept.name } });
    }
  });
});
