import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Feed ICS (Tanda 3, nivel 1, solo lectura): alcance por rol, privacidad del contenido (nunca motivos
 * ni nombre de candidato), token (solo hash en BD, regenerar invalida el anterior), cuenta desactivada
 * → 404 indistinguible, auditoría sin token ni hash, ETag/Cache-Control. Datos propios con marcador.
 */
describe('Feed ICS de calendario (integración)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let db: PrismaService;
  let rrhhToken: string;
  const tag = `Feed${Date.now()}`;
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const sha = (s: string) => createHash('sha256').update(s).digest('hex');
  const SECRETO = `motivo-secreto-${tag}`;
  const CANDIDATO = `${tag}CandidatoApellido`;
  const PUESTO = `${tag} Puesto Visible`;

  type Person = { employeeId: string; userId: string; email: string; name: string; access: string; feedToken?: string; feedUrl?: string };
  const people: Record<string, Person> = {};
  const created = { employees: [] as string[], users: [] as string[], jobs: [] as string[], candidates: [] as string[], applications: [] as string[] };

  const login = (email: string) =>
    request(http).post('/api/auth/login').send({ email, password: 'nucleo123' }).then((r) => r.body.accessToken as string);

  async function mkPerson(key: string, role: 'EMPLEADO' | 'MANAGER' | 'RRHH' | 'ADMIN', managerId?: string) {
    const tipo = await db.tipoContrato.findFirstOrThrow();
    const name = `${tag} ${key}`;
    const emp = await db.employee.create({
      data: {
        fullName: name,
        email: `${tag}.${key}@example.com`,
        jobTitle: 'Analista',
        level: 'mid',
        startDate: new Date('2026-01-01'),
        localizacionId: 'loc-madrid',
        tipoContratoId: tipo.id,
        managerId,
        ...(key === 'miembro' ? { finPeriodoPrueba: new Date(`${day(5)}T00:00:00Z`) } : {}),
      },
    });
    const user = await db.user.create({ data: { email: emp.email, passwordHash: await bcrypt.hash('nucleo123', 4), role, employeeId: emp.id } });
    created.employees.push(emp.id);
    created.users.push(user.id);
    people[key] = { employeeId: emp.id, userId: user.id, email: emp.email, name, access: await login(emp.email) };
  }

  /** Genera el feed del usuario por la API y devuelve la ruta de petición (sin host). */
  async function generate(key: string) {
    const res = await request(http).post('/api/calendar/feed').set(auth(people[key]!.access)).expect(201);
    const url = res.body.url as string;
    const match = url.match(/\/api\/calendar\/feed\/([0-9a-f]{64})\.ics$/);
    expect(match).not.toBeNull();
    people[key]!.feedToken = match![1];
    people[key]!.feedUrl = `/api/calendar/feed/${match![1]}.ics`;
    return res;
  }
  const feed = (key: string) => request(http).get(people[key]!.feedUrl!);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    http = app.getHttpServer();
    db = moduleRef.get(PrismaService);
    rrhhToken = await login('blanca.ruiz@grupo.com');

    await mkPerson('jefe', 'MANAGER');
    await mkPerson('miembro', 'EMPLEADO', people.jefe!.employeeId);
    await mkPerson('ajeno', 'EMPLEADO');
    await mkPerson('rrhh', 'RRHH');
    await mkPerson('admin', 'ADMIN');

    const abs = (key: string, type: 'VACACIONES' | 'ENFERMEDAD' | 'PERSONAL', from: number, to: number, status: 'APROBADA' | 'PENDIENTE' = 'APROBADA') =>
      db.absence.create({
        data: { employeeId: people[key]!.employeeId, type, startDate: new Date(`${day(from)}T00:00:00Z`), endDate: new Date(`${day(to)}T00:00:00Z`), days: to - from + 1, status, reason: SECRETO },
      });
    await abs('miembro', 'VACACIONES', 10, 12);
    await abs('ajeno', 'ENFERMEDAD', 14, 15);
    await abs('jefe', 'PERSONAL', 20, 20);
    await abs('miembro', 'VACACIONES', 30, 31, 'PENDIENTE'); // sin aprobar: no debe aparecer

    // Entrevistas: el jefe entrevista (con hora) y el ajeno también (no debe aparecer en el feed del jefe).
    const job = await request(http).post('/api/jobs').set(auth(rrhhToken)).send({ title: PUESTO, location: 'Madrid', level: 'mid' }).expect(201);
    created.jobs.push(job.body.id);
    const mkInterview = async (interviewerKey: string, when: string) => {
      const cand = await request(http)
        .post('/api/candidates')
        .set(auth(rrhhToken))
        .send({ fullName: CANDIDATO, email: `${tag}.${Math.random().toString(36).slice(2)}@example.com` })
        .expect(201);
      created.candidates.push(cand.body.id);
      const app_ = await request(http).post('/api/applications').set(auth(rrhhToken)).send({ jobId: job.body.id, candidateId: cand.body.id }).expect(201);
      created.applications.push(app_.body.id);
      await request(http)
        .post(`/api/applications/${app_.body.id}/interviews`)
        .set(auth(rrhhToken))
        .send({ type: 'tecnica', interviewerId: people[interviewerKey]!.employeeId, scheduledAt: when })
        .expect(201);
    };
    await mkInterview('jefe', `${day(25)}T09:30:00Z`);
    await mkInterview('ajeno', `${day(26)}T09:30:00Z`);
  });

  afterAll(async () => {
    const apps = created.applications;
    await db.interview.deleteMany({ where: { applicationId: { in: apps } } }).catch(() => undefined);
    await db.auditDecision.deleteMany({ where: { applicationId: { in: apps } } }).catch(() => undefined);
    await db.applicationEtapa.deleteMany({ where: { applicationId: { in: apps } } }).catch(() => undefined);
    await db.application.deleteMany({ where: { id: { in: apps } } }).catch(() => undefined);
    await db.candidate.deleteMany({ where: { id: { in: created.candidates } } }).catch(() => undefined);
    await db.absence.deleteMany({ where: { employeeId: { in: created.employees } } }).catch(() => undefined);
    await db.auditLog.deleteMany({ where: { OR: [{ entityId: { in: [...created.users, ...created.jobs, ...apps, ...created.candidates] } }, { actorId: { in: created.users } }] } }).catch(() => undefined);
    await db.refreshToken.deleteMany({ where: { userId: { in: created.users } } }).catch(() => undefined);
    await db.user.deleteMany({ where: { id: { in: created.users } } }).catch(() => undefined);
    await db.employee.deleteMany({ where: { id: { in: created.employees } } }).catch(() => undefined);
    await db.job.deleteMany({ where: { id: { in: created.jobs } } }).catch(() => undefined);
    await app.close();
  });

  describe('gestión del token', () => {
    it('sin sesión no se puede gestionar el feed (401)', async () => {
      await request(http).get('/api/calendar/feed').expect(401);
      await request(http).post('/api/calendar/feed').expect(401);
      await request(http).delete('/api/calendar/feed').expect(401);
    });

    it('generar: URL con 256 bits (64 hex) una sola vez, en BD solo el hash, estado activo, y la URL no se vuelve a ofrecer', async () => {
      expect((await request(http).get('/api/calendar/feed').set(auth(people.miembro!.access)).expect(200)).body).toMatchObject({ active: false });
      const res = await generate('miembro');
      expect(res.headers['cache-control']).toContain('no-store');
      const token = people.miembro!.feedToken!;
      const row = await db.user.findUniqueOrThrow({ where: { id: people.miembro!.userId } });
      expect(row.calendarFeedTokenHash).toBe(sha(token));
      expect(JSON.stringify(row)).not.toContain(token);
      const status = await request(http).get('/api/calendar/feed').set(auth(people.miembro!.access)).expect(200);
      expect(status.body.active).toBe(true);
      expect(JSON.stringify(status.body)).not.toContain(token);
    });
  });

  describe('contenido por rol', () => {
    beforeAll(async () => {
      for (const k of ['jefe', 'ajeno', 'rrhh', 'admin']) await generate(k);
    });

    it('cabeceras: text/calendar, Cache-Control private, ETag; con If-None-Match → 304', async () => {
      const res = await feed('miembro').expect(200);
      expect(res.headers['content-type']).toContain('text/calendar');
      expect(res.headers['cache-control']).toContain('private');
      const etag = res.headers.etag as string;
      expect(etag).toBeTruthy();
      await request(http).get(people.miembro!.feedUrl!).set('If-None-Match', etag).expect(304);
      await request(http).get(people.miembro!.feedUrl!).set('If-None-Match', '"otro"').expect(200);
      expect(res.text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    });

    it('EMPLEADO: solo lo suyo — su ausencia con tipo y su alerta; nada del resto ni la pendiente', async () => {
      const t = (await feed('miembro').expect(200)).text;
      expect(t).toContain(`SUMMARY:Vacaciones — ${people.miembro!.name}`);
      expect(t).toContain(`SUMMARY:Fin del periodo de prueba — ${people.miembro!.name}`);
      expect(t).not.toContain(people.ajeno!.name);
      expect(t).not.toContain(people.jefe!.name);
      expect(t.match(/BEGIN:VEVENT/g)?.length).toBe(2);
    });

    it('MANAGER: su equipo SIN tipo («Ausencia — Nombre»), lo propio con tipo, la alerta del equipo y su entrevista con hora y puesto; nada ajeno', async () => {
      const t = (await feed('jefe').expect(200)).text;
      expect(t).toContain(`SUMMARY:Ausencia — ${people.miembro!.name}`); // del equipo: sin tipo
      expect(t).not.toContain(`Vacaciones — ${people.miembro!.name}`);
      expect(t).toContain(`SUMMARY:Personal — ${people.jefe!.name}`); // propia: con tipo
      expect(t).toContain(`SUMMARY:Fin del periodo de prueba — ${people.miembro!.name}`);
      expect(t).toContain(`SUMMARY:Entrevista — ${PUESTO}`);
      expect(t).toContain('DESCRIPTION:Entrevista técnica');
      expect(t).toMatch(/DTSTART;TZID=Europe\/Madrid:\d{8}T\d{6}/);
      expect(t).not.toContain(people.ajeno!.name);
      expect((t.match(/Entrevista — /g) ?? []).length).toBe(1); // la del «ajeno» no aparece
    });

    it('RRHH y ADMIN: todas las ausencias aprobadas con su tipo; sin motivos', async () => {
      for (const k of ['rrhh', 'admin']) {
        const t = (await feed(k).expect(200)).text;
        expect(t).toContain(`SUMMARY:Vacaciones — ${people.miembro!.name}`);
        expect(t).toContain(`SUMMARY:Enfermedad — ${people.ajeno!.name}`);
        expect(t).toContain(`SUMMARY:Personal — ${people.jefe!.name}`);
        expect(t).not.toContain('Entrevista —'); // no son entrevistadores
      }
    });

    it('en NINGÚN feed aparece el motivo de una ausencia ni el nombre del candidato', async () => {
      for (const k of ['miembro', 'jefe', 'ajeno', 'rrhh', 'admin']) {
        const t = (await feed(k).expect(200)).text;
        expect(t).not.toContain(SECRETO);
        expect(t).not.toContain(CANDIDATO);
        expect(t).not.toMatch(/ATTENDEE|ORGANIZER|mailto:/);
      }
    });

    it('evento con hora = 09:30 UTC → 10:30/11:30 hora de Madrid y VTIMEZONE; una entrevista solo con fecha sería de día completo', async () => {
      const t = (await feed('jefe').expect(200)).text;
      expect(t).toMatch(/DTSTART;TZID=Europe\/Madrid:\d{8}T(1030|1130)00/);
      expect(t).toContain('BEGIN:VTIMEZONE');
      expect(t).toContain('DTSTART;VALUE=DATE:'); // las ausencias/alertas son de día completo
    });
  });

  describe('autorización del token (404 indistinguible)', () => {
    const body404 = async (path: string) => {
      const r = await request(http).get(path).expect(404);
      return { status: r.status, text: r.text, type: r.headers['content-type'] };
    };

    it('token mal formado, desconocido o de longitud errónea → mismo 404', async () => {
      const a = await body404(`/api/calendar/feed/${'0'.repeat(64)}.ics`);
      const b = await body404('/api/calendar/feed/corto.ics');
      const c = await body404(`/api/calendar/feed/${'g'.repeat(64)}.ics`);
      expect(b).toEqual(a);
      expect(c).toEqual(a);
    });

    it('cuenta desactivada → 404 idéntico al de un token inexistente; al reactivarla vuelve a funcionar', async () => {
      const unknown = await body404(`/api/calendar/feed/${'f'.repeat(64)}.ics`);
      await db.user.update({ where: { id: people.ajeno!.userId }, data: { isActive: false } });
      expect(await body404(people.ajeno!.feedUrl!)).toEqual(unknown);
      await db.user.update({ where: { id: people.ajeno!.userId }, data: { isActive: true } });
      await feed('ajeno').expect(200);
    });

    it('el rol se evalúa en cada petición: bajar de MANAGER a EMPLEADO recorta el feed al instante', async () => {
      await db.user.update({ where: { id: people.jefe!.userId }, data: { role: 'EMPLEADO' } });
      const t = (await feed('jefe').expect(200)).text;
      expect(t).not.toContain(people.miembro!.name); // ya no ve a su equipo
      await db.user.update({ where: { id: people.jefe!.userId }, data: { role: 'MANAGER' } });
    });
  });

  describe('regenerar, revocar y auditoría', () => {
    it('regenerar invalida el anterior al instante; revocar corta; las acciones quedan auditadas sin token ni hash', async () => {
      await generate('rrhh');
      const old = people.rrhh!.feedUrl!;
      const oldToken = people.rrhh!.feedToken!;
      await generate('rrhh'); // regenera
      await request(http).get(old).expect(404);
      await feed('rrhh').expect(200);
      const newToken = people.rrhh!.feedToken!;
      expect(newToken).not.toBe(oldToken);

      await request(http).delete('/api/calendar/feed').set(auth(people.rrhh!.access)).expect(200);
      await feed('rrhh').expect(404);
      expect((await request(http).get('/api/calendar/feed').set(auth(people.rrhh!.access))).body.active).toBe(false);
      await request(http).delete('/api/calendar/feed').set(auth(people.rrhh!.access)).expect(200); // idempotente

      const logs = await db.auditLog.findMany({ where: { entity: 'CalendarFeed', entityId: people.rrhh!.userId }, orderBy: { createdAt: 'asc' } });
      // generate() del beforeAll + 2 en este test (la 2.ª ya es regeneración) + borrado.
      expect(logs.map((l) => l.action)).toEqual(['CREATE', 'UPDATE', 'UPDATE', 'DELETE']);
      expect(logs.every((l) => l.actorId === people.rrhh!.userId)).toBe(true);
      const blob = JSON.stringify(logs);
      for (const secret of [oldToken, newToken, sha(oldToken), sha(newToken)]) expect(blob).not.toContain(secret);
    });

    it('las lecturas del feed no se auditan', async () => {
      const antes = await db.auditLog.count({ where: { entity: 'CalendarFeed', entityId: people.miembro!.userId } });
      await feed('miembro').expect(200);
      await feed('miembro').expect(200);
      expect(await db.auditLog.count({ where: { entity: 'CalendarFeed', entityId: people.miembro!.userId } })).toBe(antes);
    });
  });
});
