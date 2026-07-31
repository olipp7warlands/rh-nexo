import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PDFParse } from 'pdf-parse';
import { AppModule } from '../src/app.module';

async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

/**
 * Tanda 3 (RH feedback): Job Description en PDF, generado en el backend, con dos plantillas
 * según `vinculo`. Usa pdf-parse para extraer el texto del PDF y comprobar por script que cada
 * plantilla usa el lenguaje correcto, que los campos vacíos no dejan rastro, y que ningún dato
 * del bloque administrativo (IBAN/nº SS/situación IRPF) aparece en ningún caso.
 */
// Mismo patrón que documents.e2e-spec.ts para descargas binarias: supertest/superagent no
// trae un parser propio para application/pdf, así que se recoge el buffer a mano.
function downloadPdf(http: ReturnType<INestApplication['getHttpServer']>, url: string, bearer: string) {
  return request(http)
    .get(url)
    .set('Authorization', `Bearer ${bearer}`)
    .buffer(true)
    .parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
}

describe('Job Description PDF (integración)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let token: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    http = app.getHttpServer();

    const login = await request(http).post('/api/auth/login').send({ email: 'admin@grupo.com', password: 'nucleo123' });
    token = login.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('plantilla A (interna, e6 con responsable asignado): funciones, responsable, sin lenguaje de servicios ni IBAN', async () => {
    const res = await downloadPdf(http, '/api/employees/e6/job-description', token).expect(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('attachment');
    const buffer = res.body as Buffer;
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');

    // Las etiquetas de campo se renderizan en mayúsculas (textTransform), los valores y
    // títulos de sección tal cual — de ahí comparar cada uno con el "case" que corresponde.
    const text = await extractPdfText(buffer);
    const upper = text.toUpperCase();
    expect(text).toContain('Descripción de funciones');
    expect(upper).toContain('RESPONSABLE');
    expect(text).toContain('Carlos Soto Vega'); // manager de e6
    expect(text).toContain('Funciones');
    // Lenguaje de la plantilla B no debe aparecer en la A.
    expect(upper).not.toContain('INTERLOCUTOR');
    expect(text).not.toContain('Prestación de servicios');
    // Nada del bloque administrativo.
    expect(text).not.toContain('ES·· ···· ···· 7732'); // IBAN real de e6
    expect(upper).not.toContain('IBAN');
    expect(upper).not.toContain('SEGURIDAD SOCIAL');
  });

  it('plantilla A con campos opcionales vacíos (e1, sin responsable ni proyecto): se omiten enteros, sin "null"/"undefined"', async () => {
    const res = await downloadPdf(http, '/api/employees/e1/job-description', token).expect(200);
    const buffer = res.body as Buffer;
    const text = await extractPdfText(buffer);
    const upper = text.toUpperCase();

    expect(upper).not.toContain('RESPONSABLE');
    expect(upper).not.toContain('PROYECTO');
    expect(upper).not.toContain('NULL');
    expect(upper).not.toContain('UNDEFINED');
    expect(text).not.toContain('ES·· ···· ···· 4821'); // IBAN real de e1
  });

  it('plantilla B (externo, e9): interlocutor y servicio prestado, sin responsable/departamento/IBAN', async () => {
    const res = await downloadPdf(http, '/api/employees/e9/job-description', token).expect(200);
    const buffer = res.body as Buffer;
    const text = await extractPdfText(buffer);
    const upper = text.toUpperCase();

    expect(text).toContain('Prestación de servicios');
    expect(upper).toContain('INTERLOCUTOR');
    expect(text).toContain('Elena Castro Prat'); // manager de e9
    expect(text).toContain('Servicio prestado');
    // Lenguaje/campos de la plantilla A no deben aparecer en la B.
    expect(upper).not.toContain('RESPONSABLE');
    expect(upper).not.toContain('DEPARTAMENTO');
    expect(upper).not.toContain('TIPO DE CONTRATO');
    expect(upper).not.toContain('JORNADA');
    // Nada del bloque administrativo.
    expect(text).not.toContain('ES·· ···· ···· 1145'); // IBAN real de e9
  });

  it('MANAGER y EMPLEADO no pueden descargarlo (403)', async () => {
    const managerLogin = await request(http).post('/api/auth/login').send({ email: 'carlos.soto@grupo.com', password: 'nucleo123' });
    await request(http)
      .get('/api/employees/e6/job-description')
      .set('Authorization', `Bearer ${managerLogin.body.accessToken}`)
      .expect(403);

    const empLogin = await request(http).post('/api/auth/login').send({ email: 'diego.ortega@grupo.com', password: 'nucleo123' });
    await request(http)
      .get('/api/employees/e6/job-description')
      .set('Authorization', `Bearer ${empLogin.body.accessToken}`)
      .expect(403);
  });
});
