import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Fase G (humanX): Procesos — generalización de Onboarding a Onboarding+Offboarding,
 * con estados de proceso/tarea y editor de plantilla maestra (fases, responsables,
 * duplicar, archivar). Requiere Postgres sembrado (ver prisma/seed.ts) y la migración
 * 20260716184041_humanx_fase_g_procesos ya aplicada. Limpia los datos creados al terminar.
 */
describe('Procesos: Onboarding + Offboarding + plantillas (integración)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let db: PrismaService;
  let adminToken: string;
  let managerToken: string;
  let empleadoToken: string;

  let plantillaId: string | undefined;
  let plantillaTareaId: string | undefined;
  let procesoId: string | undefined;

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

    adminToken = await login('admin@grupo.com');
    managerToken = await login('carlos.soto@grupo.com'); // e3, manager de e4
    empleadoToken = await login('diego.ortega@grupo.com'); // e6
  });

  afterAll(async () => {
    if (procesoId) {
      await db.procesoTarea.deleteMany({ where: { procesoId } });
      await db.proceso.delete({ where: { id: procesoId } }).catch(() => undefined);
    }
    if (plantillaId) {
      await db.plantillaProcesoTarea.deleteMany({ where: { plantillaId } });
      await db.plantillaProceso.delete({ where: { id: plantillaId } }).catch(() => undefined);
    }
    await app.close();
  });

  it('la migración conservó los datos sembrados: onboarding de e4/e13 siguen visibles', async () => {
    const res = await request(http).get('/api/procesos?tipo=ONBOARDING').set('Authorization', `Bearer ${adminToken}`).expect(200);
    const ids = res.body.map((p: { employee: { id: string } }) => p.employee.id);
    expect(ids).toContain('e4');
    expect(ids).toContain('e13');
  });

  it('el offboarding sembrado (e15) aparece en la pestaña OFFBOARDING', async () => {
    const res = await request(http).get('/api/procesos?tipo=OFFBOARDING').set('Authorization', `Bearer ${adminToken}`).expect(200);
    const proc = res.body.find((p: { employee: { id: string } }) => p.employee.id === 'e15');
    expect(proc).toBeTruthy();
    expect(proc.completadas).toBeGreaterThan(0);
    expect(proc.completadas).toBeLessThan(proc.total);
  });

  it('RBAC: EMPLEADO no puede crear procesos ni ver plantillas', async () => {
    await request(http)
      .post('/api/procesos')
      .set('Authorization', `Bearer ${empleadoToken}`)
      .send({ employeeId: 'e6', tipo: 'ONBOARDING', fechaInicio: '2026-07-16' })
      .expect(403);
    await request(http).get('/api/procesos/plantillas?tipo=ONBOARDING').set('Authorization', `Bearer ${empleadoToken}`).expect(403);
  });

  it('RBAC: MANAGER ve solo los procesos de su equipo directo', async () => {
    const res = await request(http).get('/api/procesos?tipo=ONBOARDING').set('Authorization', `Bearer ${managerToken}`).expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body.every((p: { employee: { id: string } }) => p.employee.id === 'e4')).toBe(true);
  });

  it('editor de plantilla: crea plantilla, añade tarea, la edita, y aparece en el listado', async () => {
    const plantilla = await request(http)
      .post('/api/procesos/plantillas')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: 'Plantilla de prueba Fase G', tipo: 'OFFBOARDING' })
      .expect(201);
    plantillaId = plantilla.body.id;
    expect(plantilla.body.activa).toBe(true);

    const tarea = await request(http)
      .post(`/api/procesos/plantillas/${plantillaId}/tareas`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ label: 'Tarea de prueba', fase: 'Fase de prueba', responsable: 'RRHH' })
      .expect(201);
    plantillaTareaId = tarea.body.id;

    await request(http)
      .patch(`/api/procesos/plantillas/tareas/${plantillaTareaId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ label: 'Tarea de prueba (editada)' })
      .expect(200);

    const detalle = await request(http).get(`/api/procesos/plantillas/${plantillaId}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(detalle.body.tareas).toHaveLength(1);
    expect(detalle.body.tareas[0].label).toBe('Tarea de prueba (editada)');
  });

  it('duplicar plantilla: copia las tareas y nace archivada', async () => {
    const copia = await request(http)
      .post(`/api/procesos/plantillas/${plantillaId}/duplicar`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect(copia.body.activa).toBe(false);
    expect(copia.body.tareas).toHaveLength(1);
    expect(copia.body.tareas[0].label).toBe('Tarea de prueba (editada)');

    // limpieza de la copia (no forma parte de las variables de afterAll)
    await db.plantillaProcesoTarea.deleteMany({ where: { plantillaId: copia.body.id } });
    await db.plantillaProceso.delete({ where: { id: copia.body.id } });
  });

  it('archivar plantilla: persiste activa=false', async () => {
    const archivada = await request(http)
      .patch(`/api/procesos/plantillas/${plantillaId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ activa: false })
      .expect(200);
    expect(archivada.body.activa).toBe(false);

    // Reactivamos para poder usarla como plantilla explícita en el siguiente test.
    await request(http).patch(`/api/procesos/plantillas/${plantillaId}`).set('Authorization', `Bearer ${adminToken}`).send({ activa: true }).expect(200);
  });

  it('iniciar un proceso copia las tareas de la plantilla elegida (congelado)', async () => {
    const res = await request(http)
      .post('/api/procesos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeId: 'e6', tipo: 'OFFBOARDING', plantillaId, fechaInicio: '2026-07-16' })
      .expect(201);
    procesoId = res.body.id;
    expect(res.body.tareas).toHaveLength(1);
    expect(res.body.tareas[0].label).toBe('Tarea de prueba (editada)');
    expect(res.body.tareas[0].estado).toBe('PENDIENTE');

    const audit = await db.auditLog.findFirst({ where: { entity: 'Proceso', entityId: procesoId, action: 'CREATE' } });
    expect(audit).not.toBeNull();
  });

  it('editar la plantilla después de iniciar el proceso no afecta las tareas ya copiadas', async () => {
    await request(http)
      .patch(`/api/procesos/plantillas/tareas/${plantillaTareaId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ label: 'Cambiada tras iniciar el proceso' })
      .expect(200);

    const detalle = await request(http).get(`/api/procesos/${procesoId}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(detalle.body.tareas[0].label).toBe('Tarea de prueba (editada)'); // no cambió
  });

  it('marcar una tarea completada sube el progreso y persiste completadaAt', async () => {
    const detalle = await request(http).get(`/api/procesos/${procesoId}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    const tareaId = detalle.body.tareas[0].id;

    const actualizada = await request(http)
      .patch(`/api/procesos/tareas/${tareaId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ estado: 'COMPLETADA' })
      .expect(200);
    expect(actualizada.body.estado).toBe('COMPLETADA');
    expect(actualizada.body.completadaAt).not.toBeNull();

    const lista = await request(http).get('/api/procesos?tipo=OFFBOARDING').set('Authorization', `Bearer ${adminToken}`).expect(200);
    const proc = lista.body.find((p: { id: string }) => p.id === procesoId);
    expect(proc.completadas).toBe(1);
  });

  it('cambiar el estado del proceso persiste y audita', async () => {
    const actualizado = await request(http)
      .patch(`/api/procesos/${procesoId}/estado`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ estado: 'COMPLETADO' })
      .expect(200);
    expect(actualizado.body.estado).toBe('COMPLETADO');

    const audit = await db.auditLog.findFirst({ where: { entity: 'Proceso', entityId: procesoId, action: 'UPDATE' } });
    expect(audit).not.toBeNull();
  });

  it('eliminar una tarea de plantilla persiste', async () => {
    await request(http).delete(`/api/procesos/plantillas/tareas/${plantillaTareaId}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    plantillaTareaId = undefined;

    const detalle = await request(http).get(`/api/procesos/plantillas/${plantillaId}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(detalle.body.tareas).toHaveLength(0);
  });
});
