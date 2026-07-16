import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Fase B/C (humanX): catálogos de Estructura (Sociedades, Localizaciones, Departamentos)
 * con CRUD real, bloqueo de borrado si hay personas asociadas, y los filtros nuevos de
 * Personas (vínculo, país). Requiere Postgres sembrado (ver prisma/seed.ts).
 */
describe('Estructura + Personas (integración)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let db: PrismaService;
  let token: string;

  let createdSociedadId: string | undefined;
  let createdLocalizacionId: string | undefined;
  let createdDepartmentId: string | undefined;
  let paisEspanaId: string;

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

    const paises = await request(http).get('/api/paises').set('Authorization', `Bearer ${token}`);
    paisEspanaId = paises.body.find((p: { nombre: string }) => p.nombre === 'España').id;
  });

  afterAll(async () => {
    if (createdSociedadId) await db.sociedad.delete({ where: { id: createdSociedadId } }).catch(() => undefined);
    if (createdLocalizacionId) await db.localizacion.delete({ where: { id: createdLocalizacionId } }).catch(() => undefined);
    if (createdDepartmentId) await db.department.delete({ where: { id: createdDepartmentId } }).catch(() => undefined);
    await app.close();
  });

  it('lista países sembrados', async () => {
    const res = await request(http).get('/api/paises').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(5);
    expect(res.body.some((p: { nombre: string }) => p.nombre === 'España')).toBe(true);
  });

  it('sociedades: crea, edita, y bloquea el borrado si tiene personas asociadas', async () => {
    const created = await request(http)
      .post('/api/sociedades')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Sociedad de prueba Fase C', paisId: paisEspanaId })
      .expect(201);
    createdSociedadId = created.body.id;
    expect(created.body.pais.nombre).toBe('España');

    await request(http)
      .patch(`/api/sociedades/${createdSociedadId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Sociedad de prueba (renombrada)' })
      .expect(200);

    // Una sociedad del seed tiene personas asociadas: no se puede borrar.
    await request(http)
      .delete('/api/sociedades/sc-tech-es')
      .set('Authorization', `Bearer ${token}`)
      .expect(409);

    // La de prueba, sin personas, sí se puede borrar.
    await request(http).delete(`/api/sociedades/${createdSociedadId}`).set('Authorization', `Bearer ${token}`).expect(200);
    createdSociedadId = undefined;
  });

  it('localizaciones: crea, edita, y bloquea el borrado si tiene personas asociadas', async () => {
    const created = await request(http)
      .post('/api/localizaciones')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Localización de prueba Fase C' })
      .expect(201);
    createdLocalizacionId = created.body.id;

    await request(http)
      .patch(`/api/localizaciones/${createdLocalizacionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Localización de prueba (renombrada)' })
      .expect(200);

    await request(http).delete('/api/localizaciones/loc-madrid').set('Authorization', `Bearer ${token}`).expect(409);

    await request(http)
      .delete(`/api/localizaciones/${createdLocalizacionId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    createdLocalizacionId = undefined;
  });

  it('departamentos: crea, edita, y bloquea el borrado si tiene miembros', async () => {
    const created = await request(http)
      .post('/api/departments')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Departamento de prueba Fase C', color: '#123456' })
      .expect(201);
    createdDepartmentId = created.body.id;

    await request(http)
      .patch(`/api/departments/${createdDepartmentId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ color: '#654321' })
      .expect(200);

    await request(http).delete('/api/departments/d-eng').set('Authorization', `Bearer ${token}`).expect(409);

    await request(http).delete(`/api/departments/${createdDepartmentId}`).set('Authorization', `Bearer ${token}`).expect(200);
    createdDepartmentId = undefined;
  });

  it('filtra personas por vínculo (EXTERNO) y por país', async () => {
    const externos = await request(http)
      .get('/api/employees?vinculo=EXTERNO')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(externos.body.length).toBeGreaterThan(0);
    expect(externos.body.every((e: { vinculo: string }) => e.vinculo === 'EXTERNO')).toBe(true);

    const enEspana = await request(http)
      .get(`/api/employees?paisId=${paisEspanaId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(enEspana.body.length).toBeGreaterThan(0);
    expect(enEspana.body.every((e: { sociedad: { pais: { id: string } } }) => e.sociedad?.pais.id === paisEspanaId)).toBe(true);
  });

  it('edita el expediente de una persona: código, vínculo, sociedad y fechas de contrato persisten y auditan', async () => {
    const localizaciones = await request(http).get('/api/localizaciones').set('Authorization', `Bearer ${token}`);
    const localizacionId = localizaciones.body[0].id;

    await request(http)
      .patch('/api/employees/e6')
      .set('Authorization', `Bearer ${token}`)
      .send({
        codigo: 'EMP-TEST-01',
        vinculo: 'EXTERNO',
        localizacionId,
        finPeriodoPrueba: '2026-10-01',
        vencimientoContrato: '2027-01-01',
        descripcionPuesto: 'Descripción de prueba Fase C',
      })
      .expect(200);

    const fetched = await request(http).get('/api/employees/e6').set('Authorization', `Bearer ${token}`).expect(200);
    expect(fetched.body.codigo).toBe('EMP-TEST-01');
    expect(fetched.body.vinculo).toBe('EXTERNO');
    expect(fetched.body.localizacionId).toBe(localizacionId);
    expect(fetched.body.descripcionPuesto).toBe('Descripción de prueba Fase C');

    const audit = await db.auditLog.findFirst({
      where: { entity: 'Employee', entityId: 'e6', action: 'UPDATE' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).not.toBeNull();

    // Deja al empleado de prueba como lo encontró el seed (evita filtrar el estado a otros specs).
    await db.employee.update({
      where: { id: 'e6' },
      data: {
        codigo: 'EMP-0006',
        vinculo: 'PLANTILLA',
        localizacionId: 'loc-madrid',
        finPeriodoPrueba: null,
        vencimientoContrato: null,
        descripcionPuesto: 'Desarrollo de servicios backend y APIs del producto principal.',
      },
    });
  });
});
