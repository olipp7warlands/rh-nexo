import { Controller, ForbiddenException, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { promises as fs } from 'fs';
import * as path from 'path';
import { LOCAL_STORAGE_ROOT } from './local-storage.provider';

/**
 * Sirve los ficheros subidos con `LocalStorageProvider` (solo dev/test sin Supabase
 * configurado). Requiere sesión (JWT global), como el resto de la API.
 */
@Controller('storage/local')
export class LocalStorageController {
  @Get(':key')
  async get(@Param('key') key: string, @Res() res: Response) {
    if (key.includes('..') || key.includes('/') || key.includes('\\')) {
      throw new ForbiddenException('Ruta inválida.');
    }
    const filePath = path.join(LOCAL_STORAGE_ROOT, key);
    const metaPath = path.join(LOCAL_STORAGE_ROOT, `${key}.meta.json`);

    let mimeType = 'application/octet-stream';
    try {
      const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
      mimeType = meta.mimeType ?? mimeType;
    } catch {
      // Sin metadatos: se sirve como octet-stream.
    }

    let buffer: Buffer;
    try {
      buffer = await fs.readFile(filePath);
    } catch {
      throw new NotFoundException('Fichero no encontrado.');
    }

    res.setHeader('Content-Type', mimeType);
    res.send(buffer);
  }
}
