import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { StorageProvider } from './storage.provider';

/** Raíz de almacenamiento local (dev/test sin Supabase configurado). Fuera de git. */
export const LOCAL_STORAGE_ROOT = path.join(process.cwd(), 'storage-local');

/** `documents/<id>/foo.pdf` → `documents__<id>__foo.pdf` (clave plana, sin barras, para la ruta). */
export function flattenStorageKey(filePath: string): string {
  return filePath.replace(/\//g, '__');
}

/**
 * Almacenamiento real en disco local, servido por `LocalStorageController`. No es para
 * producción (Railway no tiene disco persistente) — ahí se usa `SupabaseStorageProvider`.
 */
@Injectable()
export class LocalStorageProvider implements StorageProvider {
  async upload(filePath: string, buffer: Buffer, mimeType: string): Promise<void> {
    const key = flattenStorageKey(filePath);
    await fs.mkdir(LOCAL_STORAGE_ROOT, { recursive: true });
    await fs.writeFile(path.join(LOCAL_STORAGE_ROOT, key), buffer);
    await fs.writeFile(path.join(LOCAL_STORAGE_ROOT, `${key}.meta.json`), JSON.stringify({ mimeType }));
  }

  async getDownloadUrl(filePath: string): Promise<string> {
    return `/api/storage/local/${encodeURIComponent(flattenStorageKey(filePath))}`;
  }
}
