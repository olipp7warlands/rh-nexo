import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { LocalStorageProvider, LOCAL_STORAGE_ROOT, flattenStorageKey } from './local-storage.provider';

describe('flattenStorageKey', () => {
  it('sustituye las barras por doble guion bajo (clave plana, sin barras, para la ruta)', () => {
    expect(flattenStorageKey('documents/abc123/contrato.pdf')).toBe('documents__abc123__contrato.pdf');
  });
});

describe('LocalStorageProvider', () => {
  const provider = new LocalStorageProvider();
  const testKey = `documents/__test__/${Date.now()}.txt`;

  afterEach(async () => {
    const flat = flattenStorageKey(testKey);
    await fs.rm(path.join(LOCAL_STORAGE_ROOT, flat), { force: true });
    await fs.rm(path.join(LOCAL_STORAGE_ROOT, `${flat}.meta.json`), { force: true });
  });

  it('upload() escribe el buffer y su metadato de mimeType en disco', async () => {
    await provider.upload(testKey, Buffer.from('hola mundo'), 'text/plain');
    const flat = flattenStorageKey(testKey);
    const content = await fs.readFile(path.join(LOCAL_STORAGE_ROOT, flat), 'utf-8');
    const meta = JSON.parse(await fs.readFile(path.join(LOCAL_STORAGE_ROOT, `${flat}.meta.json`), 'utf-8'));
    expect(content).toBe('hola mundo');
    expect(meta.mimeType).toBe('text/plain');
  });

  it('getDownloadUrl() devuelve la ruta servida por LocalStorageController, sin barras en la clave', async () => {
    const url = await provider.getDownloadUrl(testKey);
    expect(url).toMatch(/^\/api\/storage\/local\/[^/]+$/);
  });
});

describe('SupabaseStorageProvider', () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('lanza si faltan las credenciales de Supabase', async () => {
    process.env.SUPABASE_URL = '';
    process.env.SUPABASE_SERVICE_ROLE_KEY = '';
    const { SupabaseStorageProvider } = await import('./supabase-storage.provider');
    expect(() => new SupabaseStorageProvider()).toThrow(/Faltan SUPABASE_URL/);
  });

  it('upload()/getDownloadUrl() delegan en el cliente de Supabase Storage', async () => {
    process.env.SUPABASE_URL = 'https://test-project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    process.env.SUPABASE_STORAGE_BUCKET = 'test-bucket';

    const upload = vi.fn().mockResolvedValue({ error: null });
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.example/foo' }, error: null });
    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn(() => ({
        storage: { from: () => ({ upload, createSignedUrl }) },
      })),
    }));

    const { SupabaseStorageProvider } = await import('./supabase-storage.provider');
    const provider = new SupabaseStorageProvider();

    await provider.upload('documents/abc/foo.pdf', Buffer.from('x'), 'application/pdf');
    expect(upload).toHaveBeenCalledWith('documents/abc/foo.pdf', expect.any(Buffer), {
      contentType: 'application/pdf',
      upsert: true,
    });

    const url = await provider.getDownloadUrl('documents/abc/foo.pdf');
    expect(url).toBe('https://signed.example/foo');
    expect(createSignedUrl).toHaveBeenCalledWith('documents/abc/foo.pdf', 300);
  });
});
