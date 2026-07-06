import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Fase 4: documentos y firma. Blanca (RRHH) sube un documento con un firmante (Diego, e6).
 * Carlos (MANAGER, no firmante ni privilegiado) no puede firmar; Diego sí, y el documento
 * se cierra al no quedar firmas pendientes. Verifica RBAC y audita, limpia lo creado.
 */
describe('Documentos (integración)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let db: PrismaService;
  let rrhhToken: string;
  let empToken: string;
  let mgrToken: string;
  let documentId: string | undefined;
  let signatureId: string | undefined;

  const SIGNER = 'e6'; // Diego Ortega

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
    mgrToken = await login('carlos.soto@grupo.com');
  });

  afterAll(async () => {
    if (documentId) {
      await db.auditLog.deleteMany({ where: { entity: 'Document', entityId: documentId } });
      await db.documentSignature.deleteMany({ where: { documentId } });
      await db.document.delete({ where: { id: documentId } }).catch(() => undefined);
    }
    await app.close();
  });

  it('el empleado NO puede subir documentos (403)', async () => {
    await request(http)
      .post('/api/documents')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ name: 'Test NDA e2e', category: 'CONTRATOS', signerIds: [SIGNER] })
      .expect(403);
  });

  it('RRHH sube un documento con un firmante: queda PENDIENTE con una firma PENDIENTE', async () => {
    const res = await request(http)
      .post('/api/documents')
      .set('Authorization', `Bearer ${rrhhToken}`)
      .send({ name: 'Test NDA e2e', category: 'CONTRATOS', signerIds: [SIGNER] })
      .expect(201);
    documentId = res.body.id;

    expect(res.body.status).toBe('PENDIENTE');
    expect(res.body.signatures.length).toBe(1);
    expect(res.body.signatures[0].employeeId).toBe(SIGNER);
    expect(res.body.signatures[0].status).toBe('PENDIENTE');
    signatureId = res.body.signatures[0].id;
  });

  it('otro empleado (no firmante, no privilegiado) no puede firmar (403)', async () => {
    await request(http).patch(`/api/documents/signatures/${signatureId}/sign`).set('Authorization', `Bearer ${mgrToken}`).expect(403);
  });

  it('el firmante firma: pasa a FIRMADA, tiene signedAt y queda auditado', async () => {
    const res = await request(http)
      .patch(`/api/documents/signatures/${signatureId}/sign`)
      .set('Authorization', `Bearer ${empToken}`)
      .expect(200);
    expect(res.body.status).toBe('FIRMADA');
    expect(res.body.signedAt).not.toBeNull();

    const audit = await db.auditLog.findFirst({ where: { entity: 'Document', entityId: documentId, action: 'SIGN' } });
    expect(audit).not.toBeNull();
  });

  it('al no quedar firmas pendientes, el documento pasa a FIRMADO', async () => {
    const doc = await db.document.findUnique({ where: { id: documentId } });
    expect(doc?.status).toBe('FIRMADO');
  });

  it('"mis documentos" del firmante incluye la firma ya FIRMADA', async () => {
    const res = await request(http).get('/api/documents/mine').set('Authorization', `Bearer ${empToken}`).expect(200);
    const found = res.body.find((s: { document: { id: string } }) => s.document.id === documentId);
    expect(found).toBeTruthy();
    expect(found.status).toBe('FIRMADA');
  });

  it('firmar de nuevo un documento ya firmado falla (400)', async () => {
    await request(http).patch(`/api/documents/signatures/${signatureId}/sign`).set('Authorization', `Bearer ${empToken}`).expect(400);
  });
});
