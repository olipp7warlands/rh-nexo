import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { CreateDocumentDto } from './documents.dto';
import { SIGNATURE_PROVIDER, SignatureProvider } from './signature.provider';
import { STORAGE_PROVIDER, StorageProvider } from '../storage/storage.provider';

export interface UploadedDocumentFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
]);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

@Injectable()
export class DocumentsService {
  constructor(
    private readonly db: PrismaService,
    @Inject(SIGNATURE_PROVIDER) private readonly signer: SignatureProvider,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  findAll(viewer: AuthUser, category?: DocumentCategory, ownerId?: string) {
    const privileged = viewer.role === 'ADMIN' || viewer.role === 'RRHH';
    const own = viewer.employeeId ?? '__none__';
    const where: Prisma.DocumentWhereInput = {
      ...(category ? { category } : {}),
      ...(ownerId ? { ownerId } : {}),
      // Sin privilegios, el filtro de propiedad/firma se aplica igual aunque se pida un
      // ownerId ajeno: como mucho da una lista vacía, nunca expone documentos de otra persona.
      ...(privileged ? {} : { OR: [{ ownerId: own }, { signatures: { some: { employeeId: own } } }] }),
    };
    return this.db.document.findMany({
      where,
      include: {
        owner: { select: { id: true, fullName: true } },
        signatures: { include: { employee: { select: { id: true, fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  templates() {
    return this.db.documentTemplate.findMany({ orderBy: { name: 'asc' } });
  }

  mine(viewer: AuthUser) {
    if (!viewer.employeeId) return [];
    return this.db.documentSignature.findMany({
      where: { employeeId: viewer.employeeId },
      include: { document: { select: { id: true, name: true, category: true, status: true } } },
      orderBy: { document: { createdAt: 'desc' } },
    });
  }

  async create(dto: CreateDocumentDto, file: UploadedDocumentFile | undefined, viewer: AuthUser) {
    if (file) {
      if (file.buffer.length > MAX_FILE_SIZE_BYTES) {
        throw new BadRequestException('El fichero supera el tamaño máximo (10 MB).');
      }
      if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        throw new BadRequestException('Tipo de fichero no admitido (PDF, Word, PNG o JPG).');
      }
      this.assertRealFileType(file.buffer, file.mimetype);
    }

    const doc = await this.db.document.create({
      data: {
        name: dto.name,
        category: dto.category,
        ownerId: dto.ownerId ?? viewer.employeeId ?? '',
        fileUrl: file ? null : `mock://documents/${encodeURIComponent(dto.name)}`,
        status: dto.signerIds?.length ? 'PENDIENTE' : 'VIGENTE',
        signatures: dto.signerIds?.length ? { create: dto.signerIds.map((employeeId) => ({ employeeId })) } : undefined,
      },
      include: { signatures: true },
    });

    if (file) {
      const safeName = file.originalname.replace(/[^\w.\-]+/g, '_');
      const storagePath = `documents/${doc.id}/${safeName}`;
      await this.storage.upload(storagePath, file.buffer, file.mimetype);
      await this.db.document.update({ where: { id: doc.id }, data: { fileUrl: storagePath } });
      doc.fileUrl = storagePath;
    }

    await this.audit(viewer.id, 'CREATE', doc.id, null, { name: dto.name, category: dto.category, hasFile: !!file });
    return doc;
  }

  /** Devuelve una URL de descarga temporal si el viewer puede ver este documento. */
  async download(id: string, viewer: AuthUser): Promise<string> {
    const doc = await this.db.document.findUnique({ where: { id }, include: { signatures: true } });
    if (!doc) throw new NotFoundException('Documento no encontrado');

    const privileged = viewer.role === 'ADMIN' || viewer.role === 'RRHH';
    const isOwner = viewer.employeeId === doc.ownerId;
    const isSigner = doc.signatures.some((s) => s.employeeId === viewer.employeeId);
    if (!privileged && !isOwner && !isSigner) {
      throw new ForbiddenException('No autorizado para descargar este documento.');
    }
    if (!doc.fileUrl || doc.fileUrl.startsWith('mock://')) {
      throw new NotFoundException('Este documento no tiene un fichero adjunto.');
    }

    await this.audit(viewer.id, 'DOWNLOAD', id, null, { fileUrl: doc.fileUrl });
    return this.storage.getDownloadUrl(doc.fileUrl);
  }

  async sign(signatureId: string, viewer: AuthUser) {
    const sig = await this.db.documentSignature.findUnique({ where: { id: signatureId }, include: { document: true } });
    if (!sig) throw new NotFoundException('Firma no encontrada');
    if (sig.status === 'FIRMADA') throw new BadRequestException('El documento ya está firmado.');
    const privileged = viewer.role === 'ADMIN' || viewer.role === 'RRHH';
    if (!privileged && viewer.employeeId !== sig.employeeId) {
      throw new ForbiddenException('Solo el firmante puede firmar este documento.');
    }

    const result = await this.signer.sign({ documentId: sig.documentId, employeeId: sig.employeeId });
    const updated = await this.db.documentSignature.update({
      where: { id: signatureId },
      data: { status: 'FIRMADA', signedAt: result.signedAt },
    });

    // Si todas las firmas del documento están completas, el documento queda FIRMADO.
    const pending = await this.db.documentSignature.count({ where: { documentId: sig.documentId, status: 'PENDIENTE' } });
    if (pending === 0) await this.db.document.update({ where: { id: sig.documentId }, data: { status: 'FIRMADO' } });

    await this.audit(viewer.id, 'SIGN', sig.documentId, { signatureId, status: 'PENDIENTE' }, { status: 'FIRMADA', ref: result.reference });
    return updated;
  }

  private audit(actorId: string, action: string, entityId: string, before: unknown, after: unknown) {
    return this.db.auditLog.create({ data: { actorId, action, entity: 'Document', entityId, before: before as object, after: after as object } });
  }

  /**
   * Auditoría M2: `file.mimetype` lo rellena Multer a partir del Content-Type que manda el
   * cliente — trivialmente falseable (`curl -F "file=@payload.html;type=image/png"`). Aquí se
   * comprueban los bytes reales del fichero (magic bytes) contra el tipo declarado, a mano:
   * el paquete `file-type` es ESM-only y no es cargable en el `module: commonjs` de este
   * proyecto (TypeScript reduce `import()` dinámico a `require()`, que revienta con un
   * paquete ESM-only) — para los 5 tipos fijos que admitimos, comprobar la cabecera basta y
   * evita esa incompatibilidad.
   */
  private assertRealFileType(buffer: Buffer, declaredMime: string): void {
    const matches = (sig: number[]) => sig.every((byte, i) => buffer[i] === byte);
    // application/msword (.doc) usa el contenedor OLE/CFB, el mismo que .xls/.ppt — no hay
    // forma de distinguir "es un .doc" de "es otro formato de Office pre-2007" solo por
    // cabecera; comprobar el contenedor ya descarta que sea, p. ej., un HTML/script disfrazado.
    const SIGNATURES: Record<string, number[][]> = {
      'application/pdf': [[0x25, 0x50, 0x44, 0x46, 0x2d]], // %PDF-
      'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
      'image/jpeg': [[0xff, 0xd8, 0xff]],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [[0x50, 0x4b, 0x03, 0x04]], // ZIP
      'application/msword': [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]], // OLE/CFB
    };
    const signatures = SIGNATURES[declaredMime];
    if (!signatures || !signatures.some(matches)) {
      throw new BadRequestException('El contenido del fichero no coincide con el tipo declarado.');
    }
  }
}
