import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { CreateDocumentDto } from './documents.dto';
import { SIGNATURE_PROVIDER, SignatureProvider } from './signature.provider';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly db: PrismaService,
    @Inject(SIGNATURE_PROVIDER) private readonly signer: SignatureProvider,
  ) {}

  findAll(viewer: AuthUser, category?: DocumentCategory) {
    const privileged = viewer.role === 'ADMIN' || viewer.role === 'RRHH';
    const own = viewer.employeeId ?? '__none__';
    const where: Prisma.DocumentWhereInput = {
      ...(category ? { category } : {}),
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

  async create(dto: CreateDocumentDto, viewer: AuthUser) {
    const doc = await this.db.document.create({
      data: {
        name: dto.name,
        category: dto.category,
        ownerId: dto.ownerId ?? viewer.employeeId ?? '',
        fileUrl: `mock://documents/${encodeURIComponent(dto.name)}`,
        status: dto.signerIds?.length ? 'PENDIENTE' : 'VIGENTE',
        signatures: dto.signerIds?.length ? { create: dto.signerIds.map((employeeId) => ({ employeeId })) } : undefined,
      },
      include: { signatures: true },
    });
    await this.audit(viewer.id, 'CREATE', doc.id, null, { name: dto.name, category: dto.category });
    return doc;
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
}
