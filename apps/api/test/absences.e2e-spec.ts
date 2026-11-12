import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Fase 2: flujo de ausencias de extremo a extremo.
 * Diego (EMPLEADO, e6) solicita → Carlos (MANAGER, e3, su manager) ve en cola y aprueba →
 * el saldo se actualiza. Verifica RBAC y limpia los datos creados.
 */
describe('Ausencias (integración)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let db: PrismaService;
  let empToken: string;
  let mgrToken: string;
  let absenceId: string | undefined;
  let original: { used: number; pending: number } | undefined;

  const EMP = 'e6'; // Diego
  const YEAR = 2026;

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

    empToken = await login('diego.ortega@grupo.com');
    mgrToken = await login('carlos.soto@grupo.com');
    const bal = await db.leaveBalance.findUnique({ where: { employeeId_year: { employeeId: EMP, year: YEAR } } });
    original = { used: bal!.used, pending: bal!.pending };
  });

  afterAll(async () => {
    if (absenceId) {
      await db.auditLog.deleteMany({ where: { entity: 'Absence', entityId: absenceId } });
      await db.absence.delete({ where: { id: absenceId } }).catch(() => undefined);
    }
    if (original) {
      await db.leaveBalance.update({
        where: { employeeId_year: { employeeId: EMP, year: YEAR } },
        data: original,
      });
    }
    await app.close();
  });

  it('el empleado crea una solicitud: calcula días laborables y suma a pending', async () => {
    // 2026-09-01 (mar) → 2026-09-07 (lun): 5 laborables (excluye 5 y 6, fin de semana).
    const res = await request(http)
      .post('/api/absences')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ type: 'VACACIONES', startDate: '2026-09-01', endDate: '2026-09-07', reason: 'Test' })
      .expect(201);
    absenceId = res.body.id;
    expect(res.body.days).toBe(5);
    expect(res.body.status).toBe('PENDIENTE');

    const bal = await db.leaveBalance.findUnique({ where: { employeeId_year: { employeeId: EMP, year: YEAR } } });
    expect(bal!.pending).toBe(original!.pending + 5);
  });

  it('aparece en la cola del manager (PENDIENTE)', async () => {
    const res = await request(http)
      .get('/api/absences?status=PENDIENTE')
      .set('Authorization', `Bearer ${mgrToken}`)
      .expect(200);
    expect(res.body.some((a: { id: string }) => a.id === absenceId)).toBe(true);
  });

  it('el empleado NO puede aprobar (403)', async () => {
    await request(http).patch(`/api/absences/${absenceId}/approve`).set('Authorization', `Bearer ${empToken}`).expect(403);
  });

  it('el manager aprueba: estado APROBADA y el saldo pasa de pending a used', async () => {
    const res = await request(http)
      .patch(`/api/absences/${absenceId}/approve`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .expect(200);
    expect(res.body.status).toBe('APROBADA');

    const bal = await db.leaveBalance.findUnique({ where: { employeeId_year: { employeeId: EMP, year: YEAR } } });
    expect(bal!.used).toBe(original!.used + 5);
    expect(bal!.pending).toBe(original!.pending);
  });

  it('exporta CSV con cabecera', async () => {
    const res = await request(http)
      .get('/api/absences/export')
      .set('Authorization', `Bearer ${mgrToken}`)
      .expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text.split('\n')[0]).toBe('Empleado;Tipo;Inicio;Fin;Días;Estado;Motivo');
  });

  // Auditoría M3: un "motivo" que empiece por = se interpreta como fórmula al abrir el CSV
  // en Excel/LibreOffice (p. ej. exfiltración vía HYPERLINK). Debe llegar neutralizado.
  it('M3: el motivo con payload de fórmula llega neutralizado en el CSV', async () => {
    const payload = '=HYPERLINK("http://evil.example","click")';
    const created = await request(http)
      .post('/api/absences')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ type: 'PERSONAL', startDate: '2026-10-01', endDate: '2026-10-01', reason: payload })
      .expect(201);

    const res = await request(http).get('/api/absences/export').set('Authorization', `Bearer ${mgrToken}`).expect(200);
    // La neutralización antepone un apóstrofo (mitigación estándar: Excel/LibreOffice lo
    // muestran como texto literal en vez de ejecutar la fórmula); el payload original sigue
    // presente como SUBCADENA de ese texto neutralizado, así que no tiene sentido comprobar
    // `not.toContain(payload)` — lo que importa es que llega precedido del apóstrofo, no crudo.
    expect(res.text).toContain(`'${payload}`);

    // limpieza
    await db.absence.delete({ where: { id: created.body.id } }).catch(() => undefined);
  });

  // Alcance por rol. El alcance se aplica SIEMPRE; los filtros del query (status, employeeId)
  // solo restringen dentro de él. Cada caso compara contra lo que hay en la BD y exige que el
  // dato «ajeno» exista de verdad: un test que pide las ausencias de alguien que no tiene
  // ninguna pasa aunque el alcance esté roto.
  describe('alcance por rol', () => {
    type Row = { id: string; employeeId: string };
    const TEAM = ['e3', 'e4', 'e5', 'e6']; // Carlos (e3) + sus reports directos
    const EN_EQUIPO = 'e5'; // report de Carlos, compañera de Diego
    const FUERA = 'e8'; // otro departamento, ajeno a Carlos y a Diego

    const list = (token: string, qs = '') =>
      request(http).get(`/api/absences${qs}`).set('Authorization', `Bearer ${token}`).expect(200).then((r) => r.body as Row[]);
    const exportLines = (token: string) =>
      request(http).get('/api/absences/export').set('Authorization', `Bearer ${token}`).expect(200).then((r) => r.text.split('\n').slice(1));
    const ids = (rows: Row[]) => rows.map((r) => r.id).sort();
    const dbIds = (employeeIds?: string[]) =>
      db.absence
        .findMany({ where: employeeIds ? { employeeId: { in: employeeIds } } : undefined, select: { id: true } })
        .then((rows) => rows.map((r) => r.id).sort());

    beforeAll(async () => {
      // Precondición: hay ausencias propias, del equipo y de fuera. Sin ellas los casos de abajo
      // serían vacuos.
      for (const e of [EMP, EN_EQUIPO, FUERA]) expect(await db.absence.count({ where: { employeeId: e } })).toBeGreaterThan(0);
    });

    it('EMPLEADO: lista solo las suyas', async () => {
      const rows = await list(empToken);
      expect(ids(rows)).toEqual(await dbIds([EMP]));
    });

    it('EMPLEADO: exporta solo las suyas', async () => {
      const lines = await exportLines(empToken);
      expect(lines).toHaveLength(await db.absence.count({ where: { employeeId: EMP } }));
      expect(lines.every((l) => l.startsWith('Diego Ortega'))).toBe(true);
    });

    it('EMPLEADO: el filtro status no amplía el alcance', async () => {
      const rows = await list(empToken, '?status=APROBADA');
      expect(rows.every((r) => r.employeeId === EMP)).toBe(true);
    });

    it('EMPLEADO: employeeId propio devuelve las suyas; el de otra persona, lista vacía', async () => {
      expect(ids(await list(empToken, `?employeeId=${EMP}`))).toEqual(await dbIds([EMP]));
      expect(await list(empToken, `?employeeId=${EN_EQUIPO}`)).toEqual([]);
      expect(await list(empToken, `?employeeId=${FUERA}`)).toEqual([]);
    });

    it('MANAGER: lista y exporta las suyas y las de su equipo, nada más', async () => {
      const esperado = await dbIds(TEAM);
      expect(ids(await list(mgrToken))).toEqual(esperado);
      expect(await exportLines(mgrToken)).toHaveLength(esperado.length);
    });

    it('MANAGER: employeeId de su equipo filtra; el de fuera de su equipo, lista vacía', async () => {
      expect(ids(await list(mgrToken, `?employeeId=${EN_EQUIPO}`))).toEqual(await dbIds([EN_EQUIPO]));
      expect(await list(mgrToken, `?employeeId=${FUERA}`)).toEqual([]);
    });

    it.each([
      ['RRHH', 'blanca.ruiz@grupo.com'],
      ['ADMIN', 'admin@grupo.com'],
    ])('%s: lista y exporta todo, y employeeId filtra', async (_rol, email) => {
      const token = await login(email);
      const todas = await dbIds();
      expect(ids(await list(token))).toEqual(todas);
      expect(await exportLines(token)).toHaveLength(todas.length);
      expect(ids(await list(token, `?employeeId=${FUERA}`))).toEqual(await dbIds([FUERA]));
    });
  });
});
