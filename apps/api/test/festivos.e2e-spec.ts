import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Festivos por ámbito: el cálculo de días de una ausencia solo descuenta los festivos de la persona
 * (su país + su localización), GET /holidays devuelve solo los de su ámbito, y ADMIN/RRHH pueden
 * revisarlos (validar / confirmar fecha) con auditoría. Todo con países y localizaciones PROPIOS del
 * test (marcador único) y fechas de 2031, para no depender ni tocar los festivos del seed.
 */
describe('Festivos por ámbito (integración)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let db: PrismaService;
  let rrhhToken: string;
  let empToken: string;
  const tag = `Fest${Date.now()}`;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const login = (email: string, password = 'nucleo123') =>
    request(http).post('/api/auth/login').send({ email, password }).then((r) => r.body.accessToken as string);

  // Lunes 3 a viernes 7 de marzo de 2031.
  const MON = '2031-03-03';
  const TUE = '2031-03-04';
  const WED = '2031-03-05';
  const THU = '2031-03-06';
  const FRI = '2031-03-07';

  const created = { paises: [] as string[], locs: [] as string[], socs: [] as string[], employees: [] as string[], users: [] as string[], holidays: [] as string[] };
  let paisEs: string, paisIn: string, locMadrid: string, locBangalore: string, locSinPais: string, socEs: string;
  const people: Record<string, { token: string; employeeId: string }> = {};

  async function mkPerson(key: string, localizacionId: string, sociedadId?: string) {
    const tipo = await db.tipoContrato.findFirstOrThrow();
    const emp = await db.employee.create({
      data: {
        fullName: `${tag} ${key}`,
        email: `${tag}.${key}@example.com`,
        jobTitle: 'Analista',
        level: 'mid',
        startDate: new Date('2026-01-01'),
        localizacionId,
        tipoContratoId: tipo.id,
        sociedadId,
      },
    });
    created.employees.push(emp.id);
    const user = await db.user.create({
      data: { email: emp.email, passwordHash: await bcrypt.hash('nucleo123', 4), role: 'EMPLEADO', employeeId: emp.id },
    });
    created.users.push(user.id);
    people[key] = { token: await login(emp.email), employeeId: emp.id };
  }

  async function mkHoliday(date: string, name: string, scope: { paisId?: string; localizacionId?: string }, extra: Record<string, unknown> = {}) {
    const h = await db.holiday.create({ data: { date: new Date(date), name: `${tag} ${name}`, ...scope, ...extra } });
    created.holidays.push(h.id);
    return h;
  }

  const absence = (key: string, start = MON, end = FRI) =>
    request(http).post('/api/absences').set(auth(people[key]!.token)).send({ type: 'PERSONAL', startDate: start, endDate: end });

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

    paisEs = (await db.pais.create({ data: { nombre: `${tag} España` } })).id;
    paisIn = (await db.pais.create({ data: { nombre: `${tag} India` } })).id;
    created.paises.push(paisEs, paisIn);
    locMadrid = (await db.localizacion.create({ data: { nombre: `${tag} Madrid`, paisId: paisEs } })).id;
    locBangalore = (await db.localizacion.create({ data: { nombre: `${tag} Bangalore`, paisId: paisIn } })).id;
    locSinPais = (await db.localizacion.create({ data: { nombre: `${tag} Sede sin país` } })).id;
    created.locs.push(locMadrid, locBangalore, locSinPais);
    socEs = (await db.sociedad.create({ data: { nombre: `${tag} Soc España`, paisId: paisEs } })).id;
    created.socs.push(socEs);

    // Lun: nacional ES · Mar: local Madrid · Mié: nacional IN · Jue: local Bangalore · Vie: local de la sede sin país.
    await mkHoliday(MON, 'Nacional ES', { paisId: paisEs });
    await mkHoliday(TUE, 'Local Madrid', { localizacionId: locMadrid });
    await mkHoliday(WED, 'Nacional IN', { paisId: paisIn });
    await mkHoliday(THU, 'Local Bangalore', { localizacionId: locBangalore });
    await mkHoliday(FRI, 'Local sede sin país', { localizacionId: locSinPais });

    await mkPerson('madrid', locMadrid);
    await mkPerson('bangalore', locBangalore);
    await mkPerson('sinpais', locSinPais);
    await mkPerson('sinpaisConSociedad', locSinPais, socEs);
  });

  afterAll(async () => {
    await db.absence.deleteMany({ where: { employeeId: { in: created.employees } } }).catch(() => undefined);
    await db.notification.deleteMany({ where: { userId: { in: created.users } } }).catch(() => undefined);
    await db.refreshToken.deleteMany({ where: { userId: { in: created.users } } }).catch(() => undefined);
    await db.auditLog.deleteMany({ where: { OR: [{ entityId: { in: [...created.holidays, ...created.users] } }, { actorId: { in: created.users } }] } }).catch(() => undefined);
    await db.user.deleteMany({ where: { id: { in: created.users } } }).catch(() => undefined);
    await db.employee.deleteMany({ where: { id: { in: created.employees } } }).catch(() => undefined);
    await db.holiday.deleteMany({ where: { id: { in: created.holidays } } }).catch(() => undefined);
    await db.sociedad.deleteMany({ where: { id: { in: created.socs } } }).catch(() => undefined);
    await db.localizacion.deleteMany({ where: { id: { in: created.locs } } }).catch(() => undefined);
    await db.pais.deleteMany({ where: { id: { in: created.paises } } }).catch(() => undefined);
    await app.close();
  });

  describe('cálculo de días por ámbito (lun–vie, 5 laborables)', () => {
    it('Madrid: descuenta el nacional de España y el local de Madrid, no los de India → 3 días', async () => {
      const res = await absence('madrid').expect(201);
      expect(res.body.days).toBe(3); // Mié, Jue, Vie
    });

    it('Bangalore (India): descuenta el nacional de India y el local de Bangalore, no los de España/Madrid → 3 días', async () => {
      const res = await absence('bangalore').expect(201);
      expect(res.body.days).toBe(3); // Lun, Mar, Vie
    });

    it('un festivo de otro ámbito no resta: solo el del martes (local Madrid) para quien cruza Mar–Mar', async () => {
      expect((await absence('madrid', TUE, TUE).then((r) => r.status))).toBe(400); // único día laborable es festivo suyo
      const bang = await absence('bangalore', TUE, TUE).expect(201);
      expect(bang.body.days).toBe(1); // el festivo local de Madrid NO le aplica
    });

    it('localización sin país y sin sociedad: solo cuentan los festivos de su localización → 4 días', async () => {
      const res = await absence('sinpais').expect(201);
      expect(res.body.days).toBe(4); // solo descuenta el local del viernes; el nacional de ES NO aplica
    });

    it('localización sin país con sociedad en España: el país sale de la sociedad → 3 días', async () => {
      const res = await absence('sinpaisConSociedad').expect(201);
      expect(res.body.days).toBe(3); // Lun (nacional ES vía sociedad) y Vie (local de la sede)
    });
  });

  describe('GET /holidays (ámbito del usuario)', () => {
    const names = (body: { name: string }[]) => body.map((h) => h.name.replace(`${tag} `, '')).sort();

    it('Madrid ve los de España y los locales de Madrid, y ninguno de India', async () => {
      const res = await request(http).get('/api/holidays').set(auth(people.madrid!.token)).expect(200);
      expect(names(res.body.filter((h: { name: string }) => h.name.startsWith(tag)))).toEqual(['Local Madrid', 'Nacional ES']);
    });

    it('Bangalore ve los de India y los locales de Bangalore', async () => {
      const res = await request(http).get('/api/holidays').set(auth(people.bangalore!.token)).expect(200);
      expect(names(res.body.filter((h: { name: string }) => h.name.startsWith(tag)))).toEqual(['Local Bangalore', 'Nacional IN']);
    });

    it('cada festivo trae su ámbito y su estado de revisión', async () => {
      const res = await request(http).get('/api/holidays').set(auth(people.madrid!.token)).expect(200);
      const nac = res.body.find((h: { name: string }) => h.name === `${tag} Nacional ES`);
      const loc = res.body.find((h: { name: string }) => h.name === `${tag} Local Madrid`);
      expect(nac.pais.nombre).toBe(`${tag} España`);
      expect(nac.localizacion).toBeNull();
      expect(loc.localizacion.nombre).toBe(`${tag} Madrid`);
      expect(nac).toMatchObject({ validado: false, aproximado: false });
    });
  });

  describe('revisión por RRHH', () => {
    it('GET /holidays/manage lista todos los ámbitos (solo ADMIN/RRHH)', async () => {
      const res = await request(http).get('/api/holidays/manage').set(auth(rrhhToken)).expect(200);
      expect(res.body.filter((h: { name: string }) => h.name.startsWith(tag))).toHaveLength(5);
      await request(http).get('/api/holidays/manage').set(auth(empToken)).expect(403);
    });

    it('RRHH marca un festivo como validado y queda auditado; EMPLEADO no puede', async () => {
      const h = await mkHoliday('2031-04-01', 'Revisable', { paisId: paisEs });
      await request(http).patch(`/api/holidays/${h.id}`).set(auth(empToken)).send({ validado: true }).expect(403);
      const res = await request(http).patch(`/api/holidays/${h.id}`).set(auth(rrhhToken)).send({ validado: true }).expect(200);
      expect(res.body.validado).toBe(true);
      const log = await db.auditLog.findFirstOrThrow({ where: { entity: 'Holiday', entityId: h.id, action: 'UPDATE' } });
      expect(log.before).toMatchObject({ validado: false });
      expect(log.after).toMatchObject({ validado: true });
    });

    it('confirmar la fecha de un festivo aproximado: nueva fecha + aproximado=false + validado', async () => {
      const h = await mkHoliday('2031-05-01', 'Lunar', { paisId: paisIn }, { aproximado: true });
      const res = await request(http)
        .patch(`/api/holidays/${h.id}`)
        .set(auth(rrhhToken))
        .send({ date: '2031-05-02', aproximado: false, validado: true })
        .expect(200);
      expect(res.body.date.slice(0, 10)).toBe('2031-05-02');
      expect(res.body).toMatchObject({ aproximado: false, validado: true });
    });

    it('mover la fecha sobre otro festivo igual del mismo ámbito → 409; cuerpo vacío o festivo inexistente → 400/404', async () => {
      await mkHoliday('2031-06-10', 'Duplicable', { paisId: paisEs });
      const other = await mkHoliday('2031-06-11', 'Duplicable', { paisId: paisEs });
      await request(http).patch(`/api/holidays/${other.id}`).set(auth(rrhhToken)).send({ date: '2031-06-10' }).expect(409);
      await request(http).patch(`/api/holidays/${other.id}`).set(auth(rrhhToken)).send({}).expect(400);
      await request(http).patch('/api/holidays/no-existe').set(auth(rrhhToken)).send({ validado: true }).expect(404);
    });
  });
});
