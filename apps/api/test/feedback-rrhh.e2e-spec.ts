import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Mini-tanda «Feedback RRHH»:
 *  - Fuente ampliada + fuenteDetalle del candidato (alta, ficha, histórico).
 *  - Descripción estructurada de la oferta y PDF adjunto (magic bytes, solo ADMIN/RRHH, auditado).
 *  - DELETE /jobs/:id solo con 0 candidaturas; DELETE /applications/:id en cascada (entrevistas, evaluaciones, decisiones); ambos auditados.
 *  - Entrevistas: tipos telefónica/cultural/técnica/final, varias por candidatura, cada una con su entrevistador.
 * Crea sus datos con un marcador único y los limpia. Requiere Postgres de TEST migrado y sembrado.
 */
describe('Feedback RRHH (integración)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let db: PrismaService;
  let rrhhToken: string;
  let managerToken: string;
  let empToken: string;
  const tag = `FbRrhh${Date.now()}`;
  const jobIds: string[] = [];
  const candidateIds: string[] = [];
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const login = (email: string) =>
    request(http).post('/api/auth/login').send({ email, password: 'nucleo123' }).then((r) => r.body.accessToken as string);

  const newJob = async (body: Record<string, unknown> = {}) => {
    const res = await request(http)
      .post('/api/jobs')
      .set(auth(rrhhToken))
      .send({ title: `${tag} ${Math.random()}`, location: 'Madrid', level: 'mid', ...body })
      .expect(201);
    jobIds.push(res.body.id);
    return res.body as { id: string; [k: string]: unknown };
  };
  const newCandidate = async (body: Record<string, unknown> = {}) => {
    const res = await request(http)
      .post('/api/candidates')
      .set(auth(rrhhToken))
      .send({ fullName: `${tag} Candidato`, email: `${tag}.${Math.random().toString(36).slice(2)}@example.com`, ...body })
      .expect(201);
    candidateIds.push(res.body.id);
    return res.body as { id: string; [k: string]: unknown };
  };
  const newApplication = (jobId: string, candidateId: string) =>
    request(http).post('/api/applications').set(auth(rrhhToken)).send({ jobId, candidateId });
  const pdf = (name = 'oferta.pdf') => ({ buffer: Buffer.from('%PDF-1.4 oferta de prueba e2e'), opts: { filename: name, contentType: 'application/pdf' } });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    http = app.getHttpServer();
    db = moduleRef.get(PrismaService);
    rrhhToken = await login('blanca.ruiz@grupo.com');
    managerToken = await login('carlos.soto@grupo.com');
    empToken = await login('diego.ortega@grupo.com');
  });

  afterAll(async () => {
    const apps = await db.application.findMany({ where: { jobId: { in: jobIds } }, select: { id: true } });
    const appIds = apps.map((a) => a.id);
    await db.interview.deleteMany({ where: { applicationId: { in: appIds } } }).catch(() => undefined);
    await db.evaluation.deleteMany({ where: { applicationId: { in: appIds } } }).catch(() => undefined);
    await db.auditDecision.deleteMany({ where: { applicationId: { in: appIds } } }).catch(() => undefined);
    await db.application.deleteMany({ where: { id: { in: appIds } } }).catch(() => undefined);
    await db.candidate.deleteMany({ where: { id: { in: candidateIds } } }).catch(() => undefined);
    await db.auditLog
      .deleteMany({ where: { OR: [{ entityId: { in: [...jobIds, ...appIds, ...candidateIds] } }] } })
      .catch(() => undefined);
    await db.job.deleteMany({ where: { id: { in: jobIds } } }).catch(() => undefined);
    await app.close();
  });

  describe('fuente y detalle del candidato', () => {
    it.each(['STRATOS', 'IMPULSYN', 'UNIVERSIDAD', 'INFOJOBS', 'INDEED', 'WEB_EMPRESA', 'REFERIDO'])(
      'acepta la fuente %s con su detalle',
      async (source) => {
        const c = await newCandidate({ source, fuenteDetalle: `Detalle ${source}` });
        expect(c.source).toBe(source);
        expect(c.fuenteDetalle).toBe(`Detalle ${source}`);
      },
    );

    it('el detalle es opcional (null) y la fuente por defecto sigue siendo PORTAL', async () => {
      const c = await newCandidate();
      expect(c.source).toBe('PORTAL');
      expect(c.fuenteDetalle).toBeNull();
    });

    it('rechaza una fuente desconocida (400) y un detalle de más de 200 caracteres (400)', async () => {
      await request(http)
        .post('/api/candidates')
        .set(auth(rrhhToken))
        .send({ fullName: 'X', email: `${tag}.bad1@example.com`, source: 'TWITTER' })
        .expect(400);
      await request(http)
        .post('/api/candidates')
        .set(auth(rrhhToken))
        .send({ fullName: 'X', email: `${tag}.bad2@example.com`, fuenteDetalle: 'a'.repeat(201) })
        .expect(400);
    });

    it('la ficha y el histórico devuelven fuente y detalle', async () => {
      const job = await newJob();
      const c = await newCandidate({ source: 'UNIVERSIDAD', fuenteDetalle: 'UPM' });
      await newApplication(job.id, c.id).expect(201);

      const ficha = await request(http).get(`/api/candidates/${c.id}`).set(auth(rrhhToken)).expect(200);
      expect(ficha.body.source).toBe('UNIVERSIDAD');
      expect(ficha.body.fuenteDetalle).toBe('UPM');

      const hist = await request(http).get(`/api/candidates/historico?jobId=${job.id}`).set(auth(rrhhToken)).expect(200);
      expect(hist.body.items).toHaveLength(1);
      expect(hist.body.items[0].source).toBe('UNIVERSIDAD');
      expect(hist.body.items[0].fuenteDetalle).toBe('UPM');
    });
  });

  describe('descripción estructurada de la oferta', () => {
    const campos = {
      objetivoPuesto: 'Liderar el diseño',
      funciones: 'Prototipar y validar',
      requisitosEducacion: 'Grado en Diseño',
      requisitosExperiencia: '5 años',
      seValorara: 'Inglés C1',
    };

    it('se guarda al crear, se devuelve en lista y detalle, y el legado `description` se conserva', async () => {
      const job = await newJob({ ...campos, description: 'Texto antiguo' });
      expect(job).toMatchObject({ ...campos, description: 'Texto antiguo', tienePdf: false });
      const one = await request(http).get(`/api/jobs/${job.id}`).set(auth(rrhhToken)).expect(200);
      expect(one.body).toMatchObject(campos);
      const list = await request(http).get('/api/jobs').set(auth(rrhhToken)).expect(200);
      expect(list.body.find((j: { id: string }) => j.id === job.id)).toMatchObject(campos);
    });

    it('se edita (incluso vaciando un campo) y solo ADMIN/RRHH escriben', async () => {
      const job = await newJob(campos);
      const upd = await request(http)
        .patch(`/api/jobs/${job.id}`)
        .set(auth(rrhhToken))
        .send({ funciones: '', seValorara: 'Catalán' })
        .expect(200);
      expect(upd.body.funciones).toBe('');
      expect(upd.body.seValorara).toBe('Catalán');
      expect(upd.body.objetivoPuesto).toBe(campos.objetivoPuesto);
      await request(http).patch(`/api/jobs/${job.id}`).set(auth(managerToken)).send({ funciones: 'x' }).expect(403);
    });

    it('rechaza un campo de más de 5000 caracteres (400)', async () => {
      await request(http)
        .post('/api/jobs')
        .set(auth(rrhhToken))
        .send({ title: `${tag} largo`, location: 'Madrid', level: 'mid', funciones: 'a'.repeat(5001) })
        .expect(400);
    });
  });

  describe('PDF adjunto de la oferta', () => {
    it('ADMIN/RRHH lo suben; la API no expone la ruta del storage, solo tienePdf y el nombre', async () => {
      const job = await newJob();
      const f = pdf('Descripción Puesto.pdf');
      const res = await request(http)
        .post(`/api/jobs/${job.id}/pdf`)
        .set(auth(rrhhToken))
        .attach('file', f.buffer, f.opts)
        .expect(201);
      expect(res.body.tienePdf).toBe(true);
      expect(res.body.descripcionPdfNombre).toBe('Descripción Puesto.pdf');
      expect(res.body).not.toHaveProperty('descripcionPdfPath');
      const one = await request(http).get(`/api/jobs/${job.id}`).set(auth(rrhhToken)).expect(200);
      expect(one.body).not.toHaveProperty('descripcionPdfPath');
      expect(one.body.tienePdf).toBe(true);
    });

    it('rechaza un fichero que declara ser PDF pero no lo es (magic bytes) y un tipo no PDF (400)', async () => {
      const job = await newJob();
      await request(http)
        .post(`/api/jobs/${job.id}/pdf`)
        .set(auth(rrhhToken))
        .attach('file', Buffer.from('<html><script>alert(1)</script></html>'), { filename: 'x.pdf', contentType: 'application/pdf' })
        .expect(400);
      await request(http)
        .post(`/api/jobs/${job.id}/pdf`)
        .set(auth(rrhhToken))
        .attach('file', Buffer.from('%PDF-1.4 ok'), { filename: 'x.png', contentType: 'image/png' })
        .expect(400);
      await request(http).post(`/api/jobs/${job.id}/pdf`).set(auth(rrhhToken)).expect(400);
      const one = await request(http).get(`/api/jobs/${job.id}`).set(auth(rrhhToken)).expect(200);
      expect(one.body.tienePdf).toBe(false);
    });

    it('MANAGER y EMPLEADO no pueden subir, descargar ni quitar (403)', async () => {
      const job = await newJob();
      const f = pdf();
      for (const t of [managerToken, empToken]) {
        await request(http).post(`/api/jobs/${job.id}/pdf`).set(auth(t)).attach('file', f.buffer, f.opts).expect(403);
        await request(http).get(`/api/jobs/${job.id}/pdf`).set(auth(t)).expect(403);
        await request(http).delete(`/api/jobs/${job.id}/pdf`).set(auth(t)).expect(403);
      }
    });

    it('la descarga redirige al fichero, deja rastro DOWNLOAD y 404 si no hay PDF', async () => {
      const job = await newJob();
      await request(http).get(`/api/jobs/${job.id}/pdf`).set(auth(rrhhToken)).expect(404);
      const f = pdf();
      await request(http).post(`/api/jobs/${job.id}/pdf`).set(auth(rrhhToken)).attach('file', f.buffer, f.opts).expect(201);
      const res = await request(http).get(`/api/jobs/${job.id}/pdf`).set(auth(rrhhToken)).redirects(0).expect(302);
      expect(res.headers.location).toContain('/api/storage/local/');
      const log = await db.auditLog.findFirst({ where: { entity: 'Job', entityId: job.id, action: 'DOWNLOAD' } });
      expect(log).not.toBeNull();
    });

    it('reemplazar y quitar actualizan el estado y se auditan', async () => {
      const job = await newJob();
      const a = pdf('a.pdf');
      const b = pdf('b.pdf');
      await request(http).post(`/api/jobs/${job.id}/pdf`).set(auth(rrhhToken)).attach('file', a.buffer, a.opts).expect(201);
      const rep = await request(http).post(`/api/jobs/${job.id}/pdf`).set(auth(rrhhToken)).attach('file', b.buffer, b.opts).expect(201);
      expect(rep.body.descripcionPdfNombre).toBe('b.pdf');
      const del = await request(http).delete(`/api/jobs/${job.id}/pdf`).set(auth(rrhhToken)).expect(200);
      expect(del.body.tienePdf).toBe(false);
      await request(http).delete(`/api/jobs/${job.id}/pdf`).set(auth(rrhhToken)).expect(404);
      const logs = await db.auditLog.count({ where: { entity: 'Job', entityId: job.id, action: 'UPDATE' } });
      expect(logs).toBeGreaterThanOrEqual(3);
    });
  });

  describe('DELETE /jobs/:id (solo con 0 candidaturas)', () => {
    it('elimina una oferta sin candidaturas y audita el borrado con el estado anterior', async () => {
      const job = await newJob({ funciones: 'Se borrará' });
      await request(http).delete(`/api/jobs/${job.id}`).set(auth(rrhhToken)).expect(200);
      await request(http).get(`/api/jobs/${job.id}`).set(auth(rrhhToken)).expect(404);
      const log = await db.auditLog.findFirst({ where: { entity: 'Job', entityId: job.id, action: 'DELETE' } });
      expect(log).not.toBeNull();
      expect((log!.before as { funciones?: string }).funciones).toBe('Se borrará');
      expect(log!.actorId).not.toBeNull();
    });

    it('con candidaturas responde 409 y la oferta (y su historial) siguen ahí', async () => {
      const job = await newJob();
      const c = await newCandidate();
      await newApplication(job.id, c.id).expect(201);
      const res = await request(http).delete(`/api/jobs/${job.id}`).set(auth(rrhhToken)).expect(409);
      expect(res.body.message).toContain('el historial no se borra');
      await request(http).get(`/api/jobs/${job.id}`).set(auth(rrhhToken)).expect(200);
      expect(await db.application.count({ where: { jobId: job.id } })).toBe(1);
    });

    it('MANAGER y EMPLEADO no pueden (403) aunque la oferta no tenga candidaturas; id inexistente 404', async () => {
      const job = await newJob();
      await request(http).delete(`/api/jobs/${job.id}`).set(auth(managerToken)).expect(403);
      await request(http).delete(`/api/jobs/${job.id}`).set(auth(empToken)).expect(403);
      await request(http).get(`/api/jobs/${job.id}`).set(auth(rrhhToken)).expect(200);
      await request(http).delete('/api/jobs/no-existe').set(auth(rrhhToken)).expect(404);
    });

    it('al eliminar una oferta con PDF no queda la referencia (la oferta desaparece entera)', async () => {
      const job = await newJob();
      const f = pdf();
      await request(http).post(`/api/jobs/${job.id}/pdf`).set(auth(rrhhToken)).attach('file', f.buffer, f.opts).expect(201);
      await request(http).delete(`/api/jobs/${job.id}`).set(auth(rrhhToken)).expect(200);
      expect(await db.job.count({ where: { id: job.id } })).toBe(0);
    });
  });

  describe('DELETE /applications/:id (en cascada; el candidato permanece)', () => {
    it('elimina una candidatura recién creada, conserva al candidato y audita', async () => {
      const job = await newJob();
      const c = await newCandidate();
      const app1 = await newApplication(job.id, c.id).expect(201);
      await request(http).delete(`/api/applications/${app1.body.id}`).set(auth(rrhhToken)).expect(200);
      expect(await db.application.count({ where: { id: app1.body.id } })).toBe(0);
      expect(await db.candidate.count({ where: { id: c.id } })).toBe(1);
      const log = await db.auditLog.findFirst({ where: { entity: 'Application', entityId: app1.body.id, action: 'DELETE' } });
      expect(log).not.toBeNull();
    });

    it('borra en cascada entrevistas, evaluaciones y decisiones de ESA candidatura y deja el resumen en AuditLog', async () => {
      const job = await newJob();
      const c = await newCandidate();
      const other = await newCandidate();
      const app1 = await newApplication(job.id, c.id).expect(201);
      const app2 = await newApplication(job.id, other.id).expect(201);
      const id = app1.body.id as string;
      for (const type of ['telefonica', 'tecnica']) {
        await request(http).post(`/api/applications/${id}/interviews`).set(auth(rrhhToken)).send({ type, interviewerId: 'e3' }).expect(201);
      }
      await request(http).post(`/api/applications/${id}/evaluations`).set(auth(rrhhToken)).send({ score: 4, recommendation: 'contratar' }).expect(201);
      await request(http).patch(`/api/applications/${id}/reject`).set(auth(rrhhToken)).send({ reason: 'No encaja' }).expect(200);
      // actividad de la OTRA candidatura: no debe tocarse
      await request(http).post(`/api/applications/${app2.body.id}/interviews`).set(auth(rrhhToken)).send({ type: 'cultural' }).expect(201);

      const res = await request(http).delete(`/api/applications/${id}`).set(auth(rrhhToken)).expect(200);
      expect(res.body.borrado).toEqual({ entrevistas: 2, evaluaciones: 1, decisiones: 1, etapas: 1 });  // la etapa inicial «Nuevo» (historial de etapas) se borra en cascada con la candidatura

      expect(await db.application.count({ where: { id } })).toBe(0);
      expect(await db.interview.count({ where: { applicationId: id } })).toBe(0);
      expect(await db.evaluation.count({ where: { applicationId: id } })).toBe(0);
      expect(await db.auditDecision.count({ where: { applicationId: id } })).toBe(0);
      expect(await db.candidate.count({ where: { id: c.id } })).toBe(1);
      expect(await db.interview.count({ where: { applicationId: app2.body.id } })).toBe(1);

      const log = await db.auditLog.findFirst({ where: { entity: 'Application', entityId: id, action: 'DELETE' } });
      expect(log).not.toBeNull();
      expect(log!.actorId).not.toBeNull();
      expect(log!.after).toEqual({ borrado: { entrevistas: 2, evaluaciones: 1, decisiones: 1, etapas: 1 } });
      // El AuditLog nunca se borra: las entradas previas de esa candidatura (CREATE, REJECT) siguen ahí.
      expect(await db.auditLog.count({ where: { entity: 'Application', entityId: id } })).toBeGreaterThanOrEqual(3);
    });

    it('si falla algo a mitad, no se borra nada (transacción): id inexistente responde 404 sin efectos', async () => {
      await request(http).delete('/api/applications/no-existe').set(auth(rrhhToken)).expect(404);
    });

    it('MANAGER (incluso hiring manager) y EMPLEADO no pueden (403)', async () => {
      const job = await newJob();
      const c = await newCandidate();
      const app1 = await newApplication(job.id, c.id).expect(201);
      await request(http).delete(`/api/applications/${app1.body.id}`).set(auth(managerToken)).expect(403);
      await request(http).delete(`/api/applications/${app1.body.id}`).set(auth(empToken)).expect(403);
      await request(http).delete('/api/applications/no-existe').set(auth(rrhhToken)).expect(404);
      expect(await db.application.count({ where: { id: app1.body.id } })).toBe(1);
    });
  });

  describe('entrevistas', () => {
    it('Telefónica, Cultural y Técnica, varias por candidatura, cada una con su entrevistador', async () => {
      const job = await newJob();
      const c = await newCandidate();
      const app1 = await newApplication(job.id, c.id).expect(201);
      const plan = [
        { type: 'telefonica', interviewerId: 'e2' },
        { type: 'cultural', interviewerId: 'e3' },
        { type: 'tecnica', interviewerId: 'e4' },
        { type: 'tecnica', interviewerId: 'e5' }, // segunda técnica, otro entrevistador
      ];
      for (const p of plan) {
        await request(http).post(`/api/applications/${app1.body.id}/interviews`).set(auth(rrhhToken)).send(p).expect(201);
      }
      const ficha = await request(http).get(`/api/candidates/${c.id}`).set(auth(rrhhToken)).expect(200);
      const interviews = ficha.body.applications[0].interviews as { type: string; interviewerId: string }[];
      expect(interviews).toHaveLength(4);
      expect(interviews.map((i) => `${i.type}:${i.interviewerId}`).sort()).toEqual(
        plan.map((p) => `${p.type}:${p.interviewerId}`).sort(),
      );
    });

    it('conserva el tipo `final` ya existente y rechaza tipos desconocidos (400)', async () => {
      const job = await newJob();
      const c = await newCandidate();
      const app1 = await newApplication(job.id, c.id).expect(201);
      await request(http).post(`/api/applications/${app1.body.id}/interviews`).set(auth(rrhhToken)).send({ type: 'final' }).expect(201);
      await request(http).post(`/api/applications/${app1.body.id}/interviews`).set(auth(rrhhToken)).send({ type: 'karaoke' }).expect(400);
    });
  });
});
