import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Tanda 2 · Bloque 1: alta de país desde la app (solo ADMIN/RRHH, único sin distinguir
 * mayúsculas, auditado) y país en Localización (obligatorio al crear, asignable al editar las
 * creadas sin él). Crea sus datos con un marcador único y los limpia. Requiere Postgres de TEST.
 */
describe('Países y localizaciones (integración)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let db: PrismaService;
  let rrhhToken: string;
  let empToken: string;
  const tag = `PaisTest${Date.now()}`;
  const paisIds: string[] = [];
  const locIds: string[] = [];
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const login = (email: string) =>
    request(http).post('/api/auth/login').send({ email, password: 'nucleo123' }).then((r) => r.body.accessToken as string);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    http = app.getHttpServer();
    db = moduleRef.get(PrismaService);
    rrhhToken = await login('blanca.ruiz@grupo.com');
    empToken = await login('diego.ortega@grupo.com');
  });

  afterAll(async () => {
    await db.localizacion.deleteMany({ where: { id: { in: locIds } } }).catch(() => undefined);
    await db.auditLog.deleteMany({ where: { entityId: { in: [...paisIds, ...locIds] } } }).catch(() => undefined);
    await db.pais.deleteMany({ where: { id: { in: paisIds } } }).catch(() => undefined);
    await app.close();
  });

  describe('POST /paises', () => {
    it('RRHH crea un país (nombre recortado), aparece en el catálogo y queda auditado', async () => {
      const res = await request(http).post('/api/paises').set(auth(rrhhToken)).send({ nombre: `  ${tag} Uno  ` }).expect(201);
      paisIds.push(res.body.id);
      expect(res.body.nombre).toBe(`${tag} Uno`);

      const list = await request(http).get('/api/paises').set(auth(empToken)).expect(200);
      expect(list.body.some((p: { id: string }) => p.id === res.body.id)).toBe(true);

      const log = await db.auditLog.findFirstOrThrow({ where: { entity: 'Pais', entityId: res.body.id, action: 'CREATE' } });
      expect((log.after as { nombre: string }).nombre).toBe(`${tag} Uno`);
    });

    it('rechaza un duplicado sin distinguir mayúsculas (409) y un nombre vacío (400)', async () => {
      await request(http).post('/api/paises').set(auth(rrhhToken)).send({ nombre: `${tag} UNO` }).expect(409);
      await request(http).post('/api/paises').set(auth(rrhhToken)).send({ nombre: '   ' }).expect(400);
    });

    it('un EMPLEADO no puede crear países (403)', async () => {
      await request(http).post('/api/paises').set(auth(empToken)).send({ nombre: `${tag} Emp` }).expect(403);
      expect(await db.pais.findFirst({ where: { nombre: `${tag} Emp` } })).toBeNull();
    });
  });

  describe('localizaciones con país', () => {
    it('crea con país (devuelve el país), exige paisId y rechaza un país inexistente', async () => {
      const res = await request(http)
        .post('/api/localizaciones')
        .set(auth(rrhhToken))
        .send({ nombre: `${tag} Loc A`, paisId: 'p-es' })
        .expect(201);
      locIds.push(res.body.id);
      expect(res.body.paisId).toBe('p-es');
      expect(res.body.pais.nombre).toBe('España');
      const log = await db.auditLog.findFirstOrThrow({ where: { entity: 'Localizacion', entityId: res.body.id, action: 'CREATE' } });
      expect((log.after as { paisId: string }).paisId).toBe('p-es');

      await request(http).post('/api/localizaciones').set(auth(rrhhToken)).send({ nombre: `${tag} Loc B` }).expect(400);
      await request(http)
        .post('/api/localizaciones')
        .set(auth(rrhhToken))
        .send({ nombre: `${tag} Loc C`, paisId: 'no-existe' })
        .expect(400);
    });

    it('una localización creada sin país se puede editar para asignárselo (UPDATE auditado) y el listado trae el país', async () => {
      const legacy = await db.localizacion.create({ data: { nombre: `${tag} Loc legada` } });
      locIds.push(legacy.id);
      const before = await request(http).get('/api/localizaciones').set(auth(rrhhToken)).expect(200);
      expect(before.body.find((l: { id: string }) => l.id === legacy.id).pais).toBeNull();

      const res = await request(http)
        .patch(`/api/localizaciones/${legacy.id}`)
        .set(auth(rrhhToken))
        .send({ paisId: 'p-es' })
        .expect(200);
      expect(res.body.pais.nombre).toBe('España');

      const log = await db.auditLog.findFirstOrThrow({ where: { entity: 'Localizacion', entityId: legacy.id, action: 'UPDATE' } });
      expect((log.before as { paisId: string | null }).paisId).toBeNull();
      expect((log.after as { paisId: string }).paisId).toBe('p-es');
    });

    it('editar solo el nombre no exige país; vaciar el país o uno inexistente da 400; EMPLEADO 403', async () => {
      const legacy = await db.localizacion.create({ data: { nombre: `${tag} Loc renombrar` } });
      locIds.push(legacy.id);
      await request(http).patch(`/api/localizaciones/${legacy.id}`).set(auth(rrhhToken)).send({ nombre: `${tag} Loc renombrada` }).expect(200);
      await request(http).patch(`/api/localizaciones/${legacy.id}`).set(auth(rrhhToken)).send({ paisId: '' }).expect(400);
      await request(http).patch(`/api/localizaciones/${legacy.id}`).set(auth(rrhhToken)).send({ paisId: 'no-existe' }).expect(400);
      await request(http).patch(`/api/localizaciones/${legacy.id}`).set(auth(empToken)).send({ paisId: 'p-es' }).expect(403);
    });
  });
});
