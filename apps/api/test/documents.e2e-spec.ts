import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { LOCAL_STORAGE_ROOT, flattenStorageKey } from '../src/storage/local-storage.provider';

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
  let fileDocumentId: string | undefined;
  let fileStoragePath: string | undefined;

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
    if (fileDocumentId) {
      await db.auditLog.deleteMany({ where: { entity: 'Document', entityId: fileDocumentId } });
      await db.document.delete({ where: { id: fileDocumentId } }).catch(() => undefined);
    }
    if (fileStoragePath) {
      const flat = flattenStorageKey(fileStoragePath);
      await fs.rm(path.join(LOCAL_STORAGE_ROOT, flat), { force: true });
      await fs.rm(path.join(LOCAL_STORAGE_ROOT, `${flat}.meta.json`), { force: true });
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

  it('RRHH sube un documento con un fichero real: fileUrl deja de ser mock', async () => {
    const res = await request(http)
      .post('/api/documents')
      .set('Authorization', `Bearer ${rrhhToken}`)
      .field('name', 'Contrato con fichero e2e')
      .field('category', 'CONTRATOS')
      .attach('file', Buffer.from('%PDF-1.4 contenido de prueba e2e'), { filename: 'contrato.pdf', contentType: 'application/pdf' })
      .expect(201);
    fileDocumentId = res.body.id;
    fileStoragePath = res.body.fileUrl;

    expect(res.body.fileUrl).not.toBeNull();
    expect(res.body.fileUrl).not.toMatch(/^mock:\/\//);
    expect(res.body.fileUrl).toBe(`documents/${fileDocumentId}/contrato.pdf`);
  });

  it('el propietario descarga: redirige a una URL que sirve el contenido subido', async () => {
    const redirect = await request(http)
      .get(`/api/documents/${fileDocumentId}/download`)
      .set('Authorization', `Bearer ${rrhhToken}`)
      .expect(302);
    expect(redirect.headers.location).toMatch(/^\/api\/storage\/local\//);

    const audit = await db.auditLog.findFirst({ where: { entity: 'Document', entityId: fileDocumentId, action: 'DOWNLOAD' } });
    expect(audit).not.toBeNull();

    const file = await request(http)
      .get(redirect.headers.location)
      .set('Authorization', `Bearer ${rrhhToken}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(file.headers['content-type']).toContain('application/pdf');
    expect((file.body as Buffer).toString('utf-8')).toContain('contenido de prueba e2e');
  });

  it('un empleado ajeno (no propietario, no firmante) no puede descargar (403)', async () => {
    await request(http).get(`/api/documents/${fileDocumentId}/download`).set('Authorization', `Bearer ${empToken}`).expect(403);
  });

  // Auditoría M1: antes, conocer/adivinar la clave de almacenamiento bastaba para descargar
  // el fichero de otra persona sin pasar por la comprobación de propietario/firmante de
  // DocumentsService.download() — golpeamos /storage/local directamente, sin el redirect.
  it('M1: un empleado ajeno no puede descargar el fichero yendo directo a /storage/local (403)', async () => {
    const flatKey = flattenStorageKey(fileStoragePath!);
    await request(http).get(`/api/storage/local/${flatKey}`).set('Authorization', `Bearer ${empToken}`).expect(403);
  });

  it('M1: el propietario sí puede descargarlo directamente por /storage/local', async () => {
    const flatKey = flattenStorageKey(fileStoragePath!);
    await request(http).get(`/api/storage/local/${flatKey}`).set('Authorization', `Bearer ${rrhhToken}`).expect(200);
  });

  it('rechaza ficheros de tipo no admitido (400)', async () => {
    await request(http)
      .post('/api/documents')
      .set('Authorization', `Bearer ${rrhhToken}`)
      .field('name', 'Fichero raro e2e')
      .field('category', 'CONTRATOS')
      .attach('file', Buffer.from('#!/bin/sh\necho hola'), { filename: 'script.sh', contentType: 'application/x-sh' })
      .expect(400);
  });

  // Auditoría M2: el Content-Type que manda el cliente es falseable — un HTML declarado como
  // "image/png" debe rechazarse aunque la extensión/MIME declarados estén en la lista blanca.
  it('M2: rechaza un fichero cuyo contenido real no coincide con el tipo declarado', async () => {
    await request(http)
      .post('/api/documents')
      .set('Authorization', `Bearer ${rrhhToken}`)
      .field('name', 'Disfrazado de PNG e2e')
      .field('category', 'CONTRATOS')
      .attach('file', Buffer.from('<script>alert(1)</script>'), { filename: 'foto.png', contentType: 'image/png' })
      .expect(400);
  });
});
