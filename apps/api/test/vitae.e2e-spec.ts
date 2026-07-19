import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Fase 6: VITAE de extremo a extremo. Blanca (RRHH) da de alta dos candidatos a la oferta
 * "Senior Frontend Engineer" (hiring manager: Carlos, e3) — uno sin CV y otro con CV — y
 * ejecuta el cribado automático; el sin-CV se descarta, el con-CV avanza a "Cribado". Carlos
 * (MANAGER, dueño de esa oferta) puede ver/gestionar su pipeline pero no el de otras ofertas
 * ni contratar. Blanca contrata al candidato con CV: se crea su Employee + Proceso (ONBOARDING)
 * con la plantilla estándar, todo auditado. Limpia los datos creados al terminar.
 */
describe('VITAE — Reclutamiento (integración)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let db: PrismaService;
  let rrhhToken: string;
  let mgrToken: string;
  let empToken: string;

  let jobFrontId: string;
  let jobDataId: string;
  let candidateSinCvId: string | undefined;
  let candidateConCvId: string | undefined;
  let appSinCvId: string | undefined;
  let appConCvId: string | undefined;
  let hiredEmployeeId: string | undefined;
  let onboardingProcessId: string | undefined;

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
    mgrToken = await login('carlos.soto@grupo.com'); // e3, hiring manager de "Senior Frontend Engineer"
    empToken = await login('diego.ortega@grupo.com');

    const jobFront = await db.job.findFirstOrThrow({ where: { title: 'Senior Frontend Engineer' } });
    const jobData = await db.job.findFirstOrThrow({ where: { title: 'Data Engineer' } });
    jobFrontId = jobFront.id;
    jobDataId = jobData.id;
  });

  afterAll(async () => {
    // El cribado automático audita sobre el Job real del seed (no se borra, solo su rastro de test).
    await db.auditLog.deleteMany({ where: { entity: 'Job', entityId: jobFrontId, action: 'AUTO_SCREEN' } });
    if (onboardingProcessId) {
      await db.procesoTarea.deleteMany({ where: { procesoId: onboardingProcessId } });
      await db.proceso.delete({ where: { id: onboardingProcessId } }).catch(() => undefined);
    }
    if (hiredEmployeeId) {
      await db.auditLog.deleteMany({ where: { entity: 'Employee', entityId: hiredEmployeeId } });
      await db.employee.delete({ where: { id: hiredEmployeeId } }).catch(() => undefined);
    }
    const appIds = [appSinCvId, appConCvId].filter((x): x is string => !!x);
    if (appIds.length) {
      await db.evaluation.deleteMany({ where: { applicationId: { in: appIds } } });
      await db.interview.deleteMany({ where: { applicationId: { in: appIds } } });
      await db.auditDecision.deleteMany({ where: { applicationId: { in: appIds } } });
      await db.auditLog.deleteMany({ where: { entity: 'Application', entityId: { in: appIds } } });
      await db.application.deleteMany({ where: { id: { in: appIds } } });
    }
    const candIds = [candidateSinCvId, candidateConCvId].filter((x): x is string => !!x);
    if (candIds.length) {
      await db.auditLog.deleteMany({ where: { entity: 'Candidate', entityId: { in: candIds } } });
      await db.candidate.deleteMany({ where: { id: { in: candIds } } });
    }
    await app.close();
  });

  it('RRHH da de alta un candidato sin CV y lo postula: arranca en "Nuevo"', async () => {
    const cand = await request(http)
      .post('/api/candidates')
      .set('Authorization', `Bearer ${rrhhToken}`)
      .send({ fullName: 'Test Sin CV', email: 'test.sincv.fase6@example.com', source: 'PORTAL' })
      .expect(201);
    candidateSinCvId = cand.body.id;

    const application = await request(http)
      .post('/api/applications')
      .set('Authorization', `Bearer ${rrhhToken}`)
      .send({ candidateId: candidateSinCvId, jobId: jobFrontId })
      .expect(201);
    appSinCvId = application.body.id;
    expect(application.body.stage.name).toBe('Nuevo');
    expect(application.body.status).toBe('ACTIVO');
  });

  it('RRHH da de alta un candidato con CV y lo postula a la misma oferta', async () => {
    const cand = await request(http)
      .post('/api/candidates')
      .set('Authorization', `Bearer ${rrhhToken}`)
      .send({
        fullName: 'Test Con CV',
        email: 'test.concv.fase6@example.com',
        source: 'LINKEDIN',
        resumeUrl: 'https://example.com/cv-test.pdf',
      })
      .expect(201);
    candidateConCvId = cand.body.id;

    const application = await request(http)
      .post('/api/applications')
      .set('Authorization', `Bearer ${rrhhToken}`)
      .send({ candidateId: candidateConCvId, jobId: jobFrontId })
      .expect(201);
    appConCvId = application.body.id;
    expect(application.body.stage.name).toBe('Nuevo');
  });

  it('el empleado no tiene acceso a VITAE (403)', async () => {
    await request(http).get(`/api/applications?jobId=${jobFrontId}`).set('Authorization', `Bearer ${empToken}`).expect(403);
  });

  it('el manager dueño de la oferta ve su pipeline', async () => {
    const res = await request(http)
      .get(`/api/applications?jobId=${jobFrontId}`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .expect(200);
    const ids = res.body.map((a: { id: string }) => a.id);
    expect(ids).toContain(appSinCvId);
    expect(ids).toContain(appConCvId);
  });

  it('el manager NO puede ver el pipeline de una oferta ajena (403)', async () => {
    await request(http).get(`/api/applications?jobId=${jobDataId}`).set('Authorization', `Bearer ${mgrToken}`).expect(403);
  });

  it('MANAGER y EMPLEADO no pueden contratar (403)', async () => {
    await request(http)
      .post(`/api/applications/${appConCvId}/hire`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ startDate: '2026-08-01' })
      .expect(403);
    await request(http)
      .post(`/api/applications/${appConCvId}/hire`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({ startDate: '2026-08-01' })
      .expect(403);
  });

  it('cribado automático: descarta al candidato sin CV y avanza al que sí tiene', async () => {
    const res = await request(http)
      .post(`/api/applications/screen/${jobFrontId}`)
      .set('Authorization', `Bearer ${rrhhToken}`)
      .expect(201);
    expect(res.body).toEqual({ advanced: 1, rejected: 1, total: 2 });

    const sinCv = await db.application.findUniqueOrThrow({ where: { id: appSinCvId } });
    expect(sinCv.status).toBe('RECHAZADO');
    const decisionSinCv = await db.auditDecision.findFirst({
      where: { applicationId: appSinCvId, type: 'AUTO_SCREEN', automated: true },
    });
    expect(decisionSinCv).not.toBeNull();
    expect(decisionSinCv?.reason).toContain('sin CV');

    const conCv = await db.application.findUniqueOrThrow({ where: { id: appConCvId }, include: { stage: true } });
    expect(conCv.stage?.name).toBe('Cribado');
    expect(conCv.status).toBe('ACTIVO');
    const decisionConCv = await db.auditDecision.findFirst({
      where: { applicationId: appConCvId, type: 'AUTO_SCREEN', automated: true },
    });
    expect(decisionConCv).not.toBeNull();
  });

  it('el manager avanza manualmente la etapa, programa una entrevista y añade una evaluación', async () => {
    const entrevista = await db.stage.findUniqueOrThrow({ where: { name: 'Entrevista' } });
    const moved = await request(http)
      .patch(`/api/applications/${appConCvId}/stage`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ stageId: entrevista.id })
      .expect(200);
    expect(moved.body.stage.name).toBe('Entrevista');
    const advanceDecision = await db.auditDecision.findFirst({
      where: { applicationId: appConCvId, type: 'ADVANCE_STAGE', automated: false },
    });
    expect(advanceDecision).not.toBeNull();

    const interview = await request(http)
      .post(`/api/applications/${appConCvId}/interviews`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ type: 'tecnica', interviewerId: 'e3' })
      .expect(201);
    expect(interview.body.type).toBe('tecnica');

    await request(http)
      .patch(`/api/interviews/${interview.body.id}`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ status: 'COMPLETADA', feedback: 'Buen nivel técnico.' })
      .expect(200);

    const evaluation = await request(http)
      .post(`/api/applications/${appConCvId}/evaluations`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ score: 4.5, recommendation: 'contratar' })
      .expect(201);
    expect(evaluation.body.recommendation).toBe('contratar');
  });

  it('RRHH contrata al candidato con CV: crea Employee + Proceso (ONBOARDING) con la plantilla estándar', async () => {
    const res = await request(http)
      .post(`/api/applications/${appConCvId}/hire`)
      .set('Authorization', `Bearer ${rrhhToken}`)
      .send({ startDate: '2026-08-01' })
      .expect(201);

    hiredEmployeeId = res.body.employee.id;
    onboardingProcessId = res.body.onboarding.id;

    expect(res.body.employee.candidateId).toBe(candidateConCvId);
    expect(res.body.employee.status).toBe('ONBOARDING');
    expect(res.body.employee.jobTitle).toBe('Senior Frontend Engineer');
    expect(res.body.onboarding.tareas.length).toBeGreaterThan(0);
    expect(res.body.application.status).toBe('CONTRATADO');

    const auditLog = await db.auditLog.findFirst({
      where: { entity: 'Employee', entityId: hiredEmployeeId, action: 'CREATE' },
    });
    expect(auditLog).not.toBeNull();
    const hireDecision = await db.auditDecision.findFirst({
      where: { applicationId: appConCvId, type: 'HIRE' },
    });
    expect(hireDecision).not.toBeNull();
  });

  it('no se puede contratar dos veces la misma candidatura (400)', async () => {
    await request(http)
      .post(`/api/applications/${appConCvId}/hire`)
      .set('Authorization', `Bearer ${rrhhToken}`)
      .send({ startDate: '2026-08-01' })
      .expect(400);
  });
});
