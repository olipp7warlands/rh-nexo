import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Tanda 2 (RH feedback): los 5 catálogos editables nuevos de la ficha de Personas (TipoContrato,
 * Jornada, RelacionEmergencia, Proyecto, Idioma) — mismo patrón CRUD + bloqueo de borrado que
 * Sociedad/Localizacion/Department en estructura.e2e-spec.ts. Un registro sembrado con
 * empleados asociados por catálogo (para probar el 409) viene de prisma/seed.ts.
 */
describe('Catálogos Tanda 2 (integración)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let db: PrismaService;
  let token: string;
  let empToken: string;
  // Red de seguridad si un `it` falla antes de llegar a su propio DELETE (mismo patrón que
  // estructura.e2e-spec.ts) — evita que un fallo deje basura con `nombre` único chocando en
  // una re-ejecución de la suite.
  const createdIds: Partial<Record<string, string>> = {};

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    http = app.getHttpServer();
    db = moduleRef.get(PrismaService);

    const login = await request(http).post('/api/auth/login').send({ email: 'admin@grupo.com', password: 'nucleo123' });
    token = login.body.accessToken;
    const empLogin = await request(http).post('/api/auth/login').send({ email: 'diego.ortega@grupo.com', password: 'nucleo123' });
    empToken = empLogin.body.accessToken;
  });

  afterAll(async () => {
    for (const cat of CATALOGOS) {
      const id = createdIds[cat.resource];
      if (id) await (db[cat.model] as { delete: (args: { where: { id: string } }) => Promise<unknown> }).delete({ where: { id } }).catch(() => undefined);
    }
    await app.close();
  });

  const CATALOGOS = [
    { resource: 'tipos-contrato', model: 'tipoContrato' as const, seededIdInUse: 'tc-indefinido', nombrePrueba: 'Tipo de prueba Tanda 2' },
    { resource: 'jornadas', model: 'jornada' as const, seededIdInUse: 'jor-completa', nombrePrueba: 'Jornada de prueba Tanda 2' },
    { resource: 'relaciones-emergencia', model: 'relacionEmergencia' as const, seededIdInUse: 'rel-conyuge', nombrePrueba: 'Relación de prueba Tanda 2' },
    { resource: 'proyectos', model: 'proyecto' as const, seededIdInUse: 'proy-migracion-cloud', nombrePrueba: 'Proyecto de prueba Tanda 2' },
    { resource: 'idiomas', model: 'idioma' as const, seededIdInUse: 'idi-espanol', nombrePrueba: 'Idioma de prueba Tanda 2' },
  ];

  for (const cat of CATALOGOS) {
    it(`${cat.resource}: lista, crea, edita, bloquea el borrado con empleados asociados, y permite borrar el que no tiene`, async () => {
      // GET: cualquier autenticado, incluido EMPLEADO.
      const list = await request(http).get(`/api/${cat.resource}`).set('Authorization', `Bearer ${empToken}`).expect(200);
      expect(list.body.some((c: { id: string }) => c.id === cat.seededIdInUse)).toBe(true);

      // POST/PATCH/DELETE: EMPLEADO no puede.
      await request(http)
        .post(`/api/${cat.resource}`)
        .set('Authorization', `Bearer ${empToken}`)
        .send({ nombre: cat.nombrePrueba })
        .expect(403);

      const created = await request(http)
        .post(`/api/${cat.resource}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: cat.nombrePrueba })
        .expect(201);
      const createdId = created.body.id;
      createdIds[cat.resource] = createdId;

      await request(http)
        .patch(`/api/${cat.resource}/${createdId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: `${cat.nombrePrueba} (renombrado)` })
        .expect(200);

      // El sembrado con empleados asociados no se puede borrar.
      await request(http).delete(`/api/${cat.resource}/${cat.seededIdInUse}`).set('Authorization', `Bearer ${token}`).expect(409);

      // El de prueba, sin empleados, sí.
      await request(http).delete(`/api/${cat.resource}/${createdId}`).set('Authorization', `Bearer ${token}`).expect(200);
      createdIds[cat.resource] = undefined;
    });
  }

  it('bloque 4 "Datos administrativos": los catálogos nuevos no filtran datos sensibles — nº SS/situación IRPF del propio empleado siguen ocultos salvo ADMIN/RRHH', async () => {
    // Regresión: confirma que añadir los catálogos no aflojó el masking de employees.service.ts.
    const self = await request(http).get('/api/employees/e6').set('Authorization', `Bearer ${empToken}`).expect(200);
    expect(self.body.numSeguridadSocial).toBeNull();
    expect(self.body.situacionIRPF).toBeNull();
  });
});
