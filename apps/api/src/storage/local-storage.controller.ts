import { Controller, ForbiddenException, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { promises as fs } from 'fs';
import * as path from 'path';
import { LOCAL_STORAGE_ROOT } from './local-storage.provider';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

/**
 * Sirve los ficheros subidos con `LocalStorageProvider` (solo dev/test sin Supabase
 * configurado). Requiere sesión (JWT global), como el resto de la API.
 *
 * Auditoría M1: antes solo exigía un JWT válido — cualquier usuario autenticado que
 * conociera/adivinara una clave podía descargar el fichero de otra persona, saltándose la
 * comprobación de propietario/firmante/RRHH-ADMIN que sí aplica `DocumentsService.download()`.
 * Las claves de documento tienen el formato `documents__<documentId>__<nombreFichero>`
 * (ver `flattenStorageKey`), así que aquí repetimos exactamente el mismo criterio de permiso.
 */
@Controller('storage/local')
export class LocalStorageController {
  constructor(private readonly db: PrismaService) {}

  @Get(':key')
  async get(@CurrentUser() user: AuthUser, @Param('key') key: string, @Res() res: Response) {
    if (key.includes('..') || key.includes('/') || key.includes('\\')) {
      throw new ForbiddenException('Ruta inválida.');
    }

    await this.assertCanAccessDocumentKey(key, user);

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

  /** Mismo criterio que `DocumentsService.download()`: propietario, firmante, o ADMIN/RRHH. */
  private async assertCanAccessDocumentKey(key: string, viewer: AuthUser): Promise<void> {
    const [prefix, documentId] = key.split('__');
    if (prefix !== 'documents' || !documentId) {
      // Toda clave real de este storage la genera DocumentsService con este prefijo — una
      // clave que no lo tiene no corresponde a ningún documento conocido.
      throw new NotFoundException('Fichero no encontrado.');
    }

    const doc = await this.db.document.findUnique({ where: { id: documentId }, include: { signatures: true } });
    if (!doc) throw new NotFoundException('Fichero no encontrado.');

    const privileged = viewer.role === 'ADMIN' || viewer.role === 'RRHH';
    const isOwner = viewer.employeeId === doc.ownerId;
    const isSigner = doc.signatures.some((s) => s.employeeId === viewer.employeeId);
    if (!privileged && !isOwner && !isSigner) {
      throw new ForbiddenException('No autorizado para descargar este documento.');
    }
  }
}
