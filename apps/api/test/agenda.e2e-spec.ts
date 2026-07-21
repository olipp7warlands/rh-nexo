import { beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Fase F (humanX): motor de alertas de contrato — lógica derivada de finPeriodoPrueba/
 * vencimientoContrato (sin entidad propia), con el scope de visibilidad por rol: ADMIN/RRHH
 * ven todas, MANAGER solo las de su equipo, EMPLEADO solo la suya. Requiere Postgres
 * sembrado (ver prisma/seed.ts — las fechas de alerta están pensadas para caer dentro de la
 * ventana de ~6 semanas en el momento de sembrar).
 */
describe('Agenda: alertas de contrato (integración)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let adminToken: string;
  let managerToken: string; // carlos.soto -> e3, manager de e4 (Sofía Navarro)
  let empleadoToken: string; // diego.ortega -> e6, sin alertas propias

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    http = app.getHttpServer();

    const admin = await request(http).post('/api/auth/login').send({ email: 'admin@grupo.com', password: 'nucleo123' });
    adminToken = admin.body.accessToken;
    const manager = await request(http).post('/api/auth/login').send({ email: 'carlos.soto@grupo.com', password: 'nucleo123' });
    managerToken = manager.body.accessToken;
    const empleado = await request(http).post('/api/auth/login').send({ email: 'diego.ortega@grupo.com', password: 'nucleo123' });
    empleadoToken = empleado.body.accessToken;
  });

  it('ADMIN ve todas las alertas sembradas (al menos 4: 2 personas con fin de prueba, 2 con vencimiento)', async () => {
    const res = await request(http).get('/api/agenda/alertas').set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(4);
    for (const a of res.body) {
      expect(['FIN_PRUEBA', 'VENCIMIENTO_CONTRATO']).toContain(a.tipo);
      expect(typeof a.diasRestantes).toBe('number');
      expect(a.empleado.fullName).toBeTruthy();
    }
  });

  it('MANAGER solo ve las alertas de su equipo directo (e4, no las de otros equipos)', async () => {
    const res = await request(http).get('/api/agenda/alertas').set('Authorization', `Bearer ${managerToken}`).expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body.every((a: { empleado: { id: string } }) => a.empleado.id === 'e4')).toBe(true);
  });

  it('EMPLEADO sin alertas propias ve una lista vacía', async () => {
    const res = await request(http).get('/api/agenda/alertas').set('Authorization', `Bearer ${empleadoToken}`).expect(200);
    expect(res.body).toEqual([]);
  });

  it('las alertas vienen ordenadas por fecha ascendente', async () => {
    const res = await request(http).get('/api/agenda/alertas').set('Authorization', `Bearer ${adminToken}`).expect(200);
    const fechas = res.body.map((a: { fecha: string }) => a.fecha);
    const ordenadas = [...fechas].sort();
    expect(fechas).toEqual(ordenadas);
  });
});
