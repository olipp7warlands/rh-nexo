import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Fase 4: nómina de extremo a extremo. Blanca (RRHH) genera un periodo nuevo (2026-07, no
 * colisiona con el 2026-06 del seed), añade una incidencia, procesa y exporta. Diego
 * (EMPLEADO, e6) solo ve/descarga lo suyo. Verifica RBAC y limpia lo creado.
 */
describe('Nómina (integración)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let db: PrismaService;
  let rrhhToken: string;
  let empToken: string;
  let runId: string | undefined;

  const PERIOD = '2026-07';
  const EMP = 'e6'; // Diego Ortega, salario 52000

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

    rrhhToken = await login('blanca.ruiz@grupo.com');
    empToken = await login('diego.ortega@grupo.com');
  });

  afterAll(async () => {
    if (runId) {
      await db.auditLog.deleteMany({ where: { entity: 'PayrollRun', entityId: runId } });
      await db.payrollItem.deleteMany({ where: { runId } });
      await db.payslip.deleteMany({ where: { runId } });
      await db.payrollRun.delete({ where: { id: runId } }).catch(() => undefined);
    }
    await app.close();
  });

  it('RRHH genera una nómina: crea un payslip por empleado con salario', async () => {
    // No comparamos contra un count() en vivo: otras suites (p. ej. employees.e2e-spec.ts)
    // crean/borran un empleado de prueba en paralelo y contaminarían el número. En su lugar,
    // comprobamos que cada empleado del seed original (e1 sin salario, e2..e17 con salario)
    // aparece —o no— exactamente como se espera.
    const res = await request(http)
      .post('/api/payroll/runs')
      .set('Authorization', `Bearer ${rrhhToken}`)
      .send({ period: PERIOD })
      .expect(201);
    runId = res.body.id;

    expect(res.body.status).toBe('BORRADOR');
    expect(res.body.period).toBe(PERIOD);
    const ids: string[] = res.body.payslips.map((p: { employeeId: string }) => p.employeeId);
    // e2..e17 con salario, salvo e15 (Carmen Iglesias): en el seed humanX está BAJA (caso de
    // ejemplo de Offboarding) y generate() excluye explícitamente `status: { not: 'BAJA' }'.
    const seededSalaried = Array.from({ length: 16 }, (_, i) => `e${i + 2}`).filter((id) => id !== 'e15');
    expect(seededSalaried.every((id) => ids.includes(id))).toBe(true);
    expect(ids).not.toContain('e1'); // CEO, sin salario en el seed
    expect(ids).not.toContain('e15'); // BAJA en el seed, no genera nómina
  });

  it('el empleado NO puede generar, listar ni procesar nóminas (403)', async () => {
    await request(http).post('/api/payroll/runs').set('Authorization', `Bearer ${empToken}`).send({ period: '2026-08' }).expect(403);
    await request(http).get('/api/payroll/runs').set('Authorization', `Bearer ${empToken}`).expect(403);
    await request(http).patch(`/api/payroll/runs/${runId}/process`).set('Authorization', `Bearer ${empToken}`).expect(403);
  });

  it('RRHH añade una incidencia (bonus): recalcula bruto/irpf/ss/neto', async () => {
    const res = await request(http)
      .post(`/api/payroll/runs/${runId}/items`)
      .set('Authorization', `Bearer ${rrhhToken}`)
      .send({ employeeId: EMP, type: 'BONUS', concept: 'Test e2e', amount: 500 })
      .expect(201);

    const gross = Math.round(52000 / 12) + 500;
    const irpf = Math.round(gross * 0.22); // tramo 45000-60000
    const ss = Math.round(gross * 0.0635);
    const net = gross - irpf - ss;

    const payslip = res.body.payslips.find((p: { employeeId: string }) => p.employeeId === EMP);
    expect(payslip.gross).toBe(gross);
    expect(payslip.irpf).toBe(irpf);
    expect(payslip.ss).toBe(ss);
    expect(payslip.net).toBe(net);
  });

  it('RRHH procesa la nómina: pasa a PROCESADA, payslips EMITIDA con pdfUrl, y audita', async () => {
    const res = await request(http)
      .patch(`/api/payroll/runs/${runId}/process`)
      .set('Authorization', `Bearer ${rrhhToken}`)
      .expect(200);

    expect(res.body.status).toBe('PROCESADA');
    for (const p of res.body.payslips) {
      expect(p.status).toBe('EMITIDA');
      expect(p.pdfUrl).toMatch(/^\/api\/payroll\/payslips\/.+\/document$/);
    }

    const audit = await db.auditLog.findFirst({ where: { entity: 'PayrollRun', entityId: runId, action: 'PROCESS' } });
    expect(audit).not.toBeNull();
  });

  it('procesar una nómina ya procesada falla (400)', async () => {
    await request(http).patch(`/api/payroll/runs/${runId}/process`).set('Authorization', `Bearer ${rrhhToken}`).expect(400);
  });

  it('exporta CSV con cabecera de transferencias', async () => {
    const res = await request(http)
      .get(`/api/payroll/runs/${runId}/export`)
      .set('Authorization', `Bearer ${rrhhToken}`)
      .expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const lines = res.text.split('\n');
    expect(lines[1]).toBe('Empleado;IBAN;Bruto;IRPF;SS;Neto');
    expect(res.text).toContain('Diego Ortega Marín');
  });

  // Auditoría M3: un IBAN con payload de fórmula se interpreta como fórmula al abrir el CSV
  // de transferencias en Excel/LibreOffice — debe llegar neutralizado, nunca crudo.
  it('M3: un IBAN con payload de fórmula llega neutralizado en el CSV de transferencias', async () => {
    const original = await db.employee.findUniqueOrThrow({ where: { id: EMP } });
    const payload = '=HYPERLINK("http://evil.example","click")';
    await db.employee.update({ where: { id: EMP }, data: { iban: payload } });

    const res = await request(http).get(`/api/payroll/runs/${runId}/export`).set('Authorization', `Bearer ${rrhhToken}`).expect(200);
    // Igual que en absences.e2e-spec.ts: el payload sigue siendo subcadena del texto
    // neutralizado (apóstrofo antepuesto), así que la comprobación real es esa, no su ausencia.
    expect(res.text).toContain(`'${payload}`);

    await db.employee.update({ where: { id: EMP }, data: { iban: original.iban } });
  });

  it('"mis nóminas" del empleado solo devuelve las suyas, incluida la nueva', async () => {
    const res = await request(http).get('/api/payroll/mine').set('Authorization', `Bearer ${empToken}`).expect(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((p: { employeeId: string }) => p.employeeId === EMP)).toBe(true);
    expect(res.body.some((p: { run: { period: string } }) => p.run.period === PERIOD)).toBe(true);
  });

  it('el recibo HTML: el propio empleado lo ve, otro empleado no (403)', async () => {
    const run = await request(http).get(`/api/payroll/runs/${runId}`).set('Authorization', `Bearer ${rrhhToken}`).expect(200);
    const myPayslip = run.body.payslips.find((p: { employeeId: string }) => p.employeeId === EMP);
    const otherPayslip = run.body.payslips.find((p: { employeeId: string }) => p.employeeId !== EMP);

    const mine = await request(http)
      .get(`/api/payroll/payslips/${myPayslip.id}/document`)
      .set('Authorization', `Bearer ${empToken}`)
      .expect(200);
    expect(mine.headers['content-type']).toContain('text/html');
    expect(mine.text).toContain('Diego Ortega Marín');

    await request(http)
      .get(`/api/payroll/payslips/${otherPayslip.id}/document`)
      .set('Authorization', `Bearer ${empToken}`)
      .expect(403);
  });

  // Auditoría A5: el recibo interpolaba jobTitle/fullName/dni sin escapar en un documento
  // text/html — un puesto como <img src=x onerror=...> se ejecutaba tal cual.
  it('el recibo HTML escapa el jobTitle: un payload no se ejecuta como marcado', async () => {
    const original = await db.employee.findUniqueOrThrow({ where: { id: EMP } });
    const payload = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
    await db.employee.update({ where: { id: EMP }, data: { jobTitle: payload } });

    const run = await request(http).get(`/api/payroll/runs/${runId}`).set('Authorization', `Bearer ${rrhhToken}`).expect(200);
    const myPayslip = run.body.payslips.find((p: { employeeId: string }) => p.employeeId === EMP);

    const doc = await request(http)
      .get(`/api/payroll/payslips/${myPayslip.id}/document`)
      .set('Authorization', `Bearer ${empToken}`)
      .expect(200);

    expect(doc.text).not.toContain('<img src=x onerror');
    expect(doc.text).not.toContain('<script>alert(2)</script>');
    expect(doc.text).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(doc.text).toContain('&lt;script&gt;alert(2)&lt;/script&gt;');

    await db.employee.update({ where: { id: EMP }, data: { jobTitle: original.jobTitle } });
  });
});
