import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Fase D (humanX): Memoria — Categorías y Anotaciones. CRUD real, marcar hecha/reabrir,
 * auditoría, borrar categoría no borra sus anotaciones (quedan "Sin categoría"), y RBAC
 * (ADMIN/RRHH exclusivamente). Requiere Postgres sembrado (ver prisma/seed.ts).
 */
describe('Memoria: Categorías + Anotaciones (integración)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let db: PrismaService;
  let adminToken: string;
  let managerToken: string;

  let createdCategoriaId: string | undefined;
  let createdAnotacionId: string | undefined;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    http = app.getHttpServer();
    db = moduleRef.get(PrismaService);

    const adminLogin = await request(http).post('/api/auth/login').send({ email: 'admin@grupo.com', password: 'nucleo123' });
    adminToken = adminLogin.body.accessToken;
    const managerLogin = await request(http).post('/api/auth/login').send({ email: 'carlos.soto@grupo.com', password: 'nucleo123' });
    managerToken = managerLogin.body.accessToken;
  });

  afterAll(async () => {
    if (createdAnotacionId) await db.anotacion.delete({ where: { id: createdAnotacionId } }).catch(() => undefined);
    if (createdCategoriaId) await db.categoria.delete({ where: { id: createdCategoriaId } }).catch(() => undefined);
    await app.close();
  });

  it('RBAC: MANAGER no tiene acceso a Anotaciones ni Categorías', async () => {
    await request(http).get('/api/anotaciones').set('Authorization', `Bearer ${managerToken}`).expect(403);
    await request(http).get('/api/categorias').set('Authorization', `Bearer ${managerToken}`).expect(403);
  });

  it('crea una categoría: persiste con su color', async () => {
    const res = await request(http)
      .post('/api/categorias')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: 'Categoría de prueba Fase D', color: '#4D6B80' })
      .expect(201);
    createdCategoriaId = res.body.id;
    expect(res.body.color).toBe('#4D6B80');

    const list = await request(http).get('/api/categorias').set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(list.body.some((c: { id: string }) => c.id === createdCategoriaId)).toBe(true);
  });

  it('crea una anotación: persiste, incluye empleado/categoría/autor, y audita CREATE', async () => {
    const res = await request(http)
      .post('/api/anotaciones')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ empleadoId: 'e6', categoriaId: createdCategoriaId, texto: 'Anotación de prueba Fase D', fecha: '2026-07-01' })
      .expect(201);
    createdAnotacionId = res.body.id;
    expect(res.body.empleado.id).toBe('e6');
    expect(res.body.categoria.id).toBe(createdCategoriaId);
    expect(res.body.estado).toBe('PENDIENTE');

    const audit = await db.auditLog.findFirst({ where: { entity: 'Anotacion', entityId: createdAnotacionId, action: 'CREATE' } });
    expect(audit).not.toBeNull();
  });

  it('filtra anotaciones por empleado y por categoría', async () => {
    const porEmpleado = await request(http).get('/api/anotaciones?empleadoId=e6').set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(porEmpleado.body.some((a: { id: string }) => a.id === createdAnotacionId)).toBe(true);

    const porCategoria = await request(http)
      .get(`/api/anotaciones?categoriaId=${createdCategoriaId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(porCategoria.body.every((a: { categoriaId: string }) => a.categoriaId === createdCategoriaId)).toBe(true);
  });

  it('marca hecha y reabre: persiste el estado y hechaAt, y audita UPDATE', async () => {
    const hecha = await request(http)
      .patch(`/api/anotaciones/${createdAnotacionId}/hecha`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(hecha.body.estado).toBe('HECHA');
    expect(hecha.body.hechaAt).not.toBeNull();

    const reabierta = await request(http)
      .patch(`/api/anotaciones/${createdAnotacionId}/reabrir`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(reabierta.body.estado).toBe('PENDIENTE');
    expect(reabierta.body.hechaAt).toBeNull();

    const audits = await db.auditLog.findMany({ where: { entity: 'Anotacion', entityId: createdAnotacionId, action: 'UPDATE' } });
    expect(audits.length).toBeGreaterThanOrEqual(2);
  });

  it('borrar la categoría no borra la anotación: queda "Sin categoría"', async () => {
    await request(http).delete(`/api/categorias/${createdCategoriaId}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    createdCategoriaId = undefined;

    const fetched = await request(http).get(`/api/anotaciones?empleadoId=e6`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    const anotacion = fetched.body.find((a: { id: string }) => a.id === createdAnotacionId);
    expect(anotacion).toBeDefined();
    expect(anotacion.categoriaId).toBeNull();
  });

  it('elimina la anotación: audita DELETE y desaparece del listado', async () => {
    await request(http).delete(`/api/anotaciones/${createdAnotacionId}`).set('Authorization', `Bearer ${adminToken}`).expect(200);

    const audit = await db.auditLog.findFirst({ where: { entity: 'Anotacion', entityId: createdAnotacionId, action: 'DELETE' } });
    expect(audit).not.toBeNull();

    const fetched = await request(http).get('/api/anotaciones?empleadoId=e6').set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(fetched.body.some((a: { id: string }) => a.id === createdAnotacionId)).toBe(false);
    createdAnotacionId = undefined;
  });
});
