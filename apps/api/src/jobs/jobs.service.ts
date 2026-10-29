import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { JobStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { STORAGE_PROVIDER, StorageProvider } from '../storage/storage.provider';
import { CreateJobDto, UpdateJobDto } from './jobs.dto';

const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB, en línea con DocumentsService
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

export interface UploadedPdf {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

/** La ruta interna del storage no sale de la API: se expone solo si hay PDF y su nombre original. */
function publicJob<T extends { descripcionPdfPath: string | null }>(job: T) {
  const { descripcionPdfPath, ...rest } = job;
  return { ...rest, tienePdf: !!descripcionPdfPath };
}

const day = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Ciclo de vida de fechas de una oferta (Selección II): estado final + apertura + cierre.
 * - closedAt solo existe con status CERRADA; al reabrir (o si nunca se cerró) vuelve a NULL.
 * - Al cerrar sin fecha explícita se conserva la que ya hubiera o se usa hoy.
 * - cierre >= apertura (comparación por día, para que "hoy" y una fecha sin hora no choquen).
 */
export function resolveJobDates(
  before: { status: JobStatus; openedAt: Date; closedAt: Date | null } | null,
  dto: { status?: JobStatus; openedAt?: string; closedAt?: string },
) {
  const status = dto.status ?? before?.status ?? 'ABIERTA';
  const openedAt = dto.openedAt ? new Date(dto.openedAt) : before?.openedAt ?? new Date();
  let closedAt: Date | null = null;
  if (status === 'CERRADA') {
    closedAt = dto.closedAt ? new Date(dto.closedAt) : before?.closedAt ?? new Date();
  } else if (dto.closedAt) {
    throw new BadRequestException('La fecha de cierre solo se admite en ofertas cerradas.');
  }
  if (closedAt && day(closedAt) < day(openedAt)) {
    throw new BadRequestException('La fecha de cierre no puede ser anterior a la de apertura.');
  }
  return { status, openedAt, closedAt };
}

@Injectable()
export class JobsService {
  constructor(
    private readonly db: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  /** RRHH/ADMIN ven todas las ofertas; MANAGER solo aquellas donde es el hiring manager. */
  private scopeWhere(viewer: AuthUser): Prisma.JobWhereInput {
    if (viewer.role === 'ADMIN' || viewer.role === 'RRHH') return {};
    return { hiringManagerId: viewer.employeeId ?? '__none__' };
  }

  private countByStage(applications: { stage: { name: string } | null }[]) {
    const counts: Record<string, number> = {};
    for (const a of applications) {
      const name = a.stage?.name ?? 'Sin etapa';
      counts[name] = (counts[name] ?? 0) + 1;
    }
    return counts;
  }

  async findAll(viewer: AuthUser) {
    const jobs = await this.db.job.findMany({
      where: this.scopeWhere(viewer),
      include: {
        department: { select: { name: true, color: true } },
        hiringManager: { select: { id: true, fullName: true } },
        sociedad: { select: { id: true, nombre: true } },
        proyecto: { select: { id: true, nombre: true } },
        applications: { select: { stage: { select: { name: true } } } },
      },
      orderBy: [{ openedAt: 'desc' }, { createdAt: 'desc' }],
    });
    return jobs.map(({ applications, ...job }) => ({
      ...publicJob(job),
      totalApplications: applications.length,
      byStage: this.countByStage(applications),
    }));
  }

  async findOne(id: string, viewer: AuthUser) {
    const job = await this.db.job.findFirst({
      where: { id, ...this.scopeWhere(viewer) },
      include: {
        department: { select: { name: true, color: true } },
        hiringManager: { select: { id: true, fullName: true } },
        sociedad: { select: { id: true, nombre: true } },
        proyecto: { select: { id: true, nombre: true } },
      },
    });
    if (!job) throw new NotFoundException('Oferta no encontrada');
    return publicJob(job);
  }

  /** Una FK inexistente daría un 500; se traduce a un 400 con mensaje claro. */
  private async assertSociedadExists(sociedadId?: string) {
    if (!sociedadId) return;
    const found = await this.db.sociedad.findUnique({ where: { id: sociedadId }, select: { id: true } });
    if (!found) throw new BadRequestException('La sociedad indicada no existe');
  }

  private async assertProyectoExists(proyectoId?: string) {
    if (!proyectoId) return;
    const found = await this.db.proyecto.findUnique({ where: { id: proyectoId }, select: { id: true } });
    if (!found) throw new BadRequestException('El proyecto indicado no existe');
  }

  async create(dto: CreateJobDto, viewer: AuthUser) {
    await this.assertSociedadExists(dto.sociedadId);
    await this.assertProyectoExists(dto.proyectoId);
    const dates = resolveJobDates(null, dto);
    const job = await this.db.job.create({ data: { ...dto, ...dates } });
    await this.audit(viewer.id, 'CREATE', job.id, null, job);
    return publicJob(job);
  }

  async update(id: string, dto: UpdateJobDto, viewer: AuthUser) {
    await this.assertSociedadExists(dto.sociedadId);
    await this.assertProyectoExists(dto.proyectoId);
    if (dto.departmentId) {
      const dep = await this.db.department.findUnique({ where: { id: dto.departmentId }, select: { id: true } });
      if (!dep) throw new BadRequestException('El departamento indicado no existe');
    }
    const before = await this.db.job.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Oferta no encontrada');
    const dates = resolveJobDates(before, dto);
    const after = await this.db.job.update({ where: { id }, data: { ...dto, ...dates } });
    await this.audit(viewer.id, 'UPDATE', id, before, after);
    return publicJob(after);
  }

  /**
   * Elimina una oferta SIN candidaturas (p. ej. creada por error). Con candidaturas se rechaza
   * (409): el historial no se borra, la oferta se cierra. La comprobación y el borrado van en la
   * misma transacción para que una candidatura que entre en medio no quede huérfana.
   */
  async remove(id: string, viewer: AuthUser) {
    const deleted = await this.db.$transaction(async (tx) => {
      const job = await tx.job.findUnique({ where: { id }, include: { _count: { select: { applications: true } } } });
      if (!job) throw new NotFoundException('Oferta no encontrada');
      if (job._count.applications > 0) {
        throw new ConflictException('La oferta tiene candidaturas: ciérrala, el historial no se borra.');
      }
      const { _count, ...before } = job;
      await tx.job.delete({ where: { id } });
      await tx.auditLog.create({
        data: { actorId: viewer.id, action: 'DELETE', entity: 'Job', entityId: id, before: before as object },
      });
      return before;
    });
    // Tras el commit; si falla, el PDF queda huérfano pero la base es coherente.
    if (deleted.descripcionPdfPath) await this.storage.remove(deleted.descripcionPdfPath).catch(() => undefined);
    return { id, deleted: true };
  }

  /** Adjunta (o reemplaza) el PDF de la oferta. Valida tamaño, MIME y magic bytes reales. */
  async uploadPdf(id: string, file: UploadedPdf | undefined, viewer: AuthUser) {
    if (!file) throw new BadRequestException('Falta el fichero PDF.');
    if (file.buffer.length > MAX_PDF_BYTES) throw new BadRequestException('El PDF supera el tamaño máximo (10 MB).');
    if (file.mimetype !== 'application/pdf' || !PDF_MAGIC.every((b, i) => file.buffer[i] === b)) {
      throw new BadRequestException('El fichero no es un PDF válido.');
    }
    const before = await this.db.job.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Oferta no encontrada');

    // Multer entrega el nombre como latin1; se recompone el UTF-8 original (tildes, ñ) para mostrarlo y descargarlo.
    const nombre = Buffer.from(file.originalname, 'latin1').toString('utf8').slice(0, 200);
    const safeName = nombre.replace(/[^\w.\-]+/g, '_');
    const path = `jobs/${id}/${Date.now()}-${safeName}`;
    await this.storage.upload(path, file.buffer, 'application/pdf');
    const after = await this.db.job.update({
      where: { id },
      data: { descripcionPdfPath: path, descripcionPdfNombre: nombre },
    });
    if (before.descripcionPdfPath) await this.storage.remove(before.descripcionPdfPath).catch(() => undefined);
    await this.audit(
      viewer.id,
      'UPDATE',
      id,
      { descripcionPdfNombre: before.descripcionPdfNombre },
      { descripcionPdfNombre: after.descripcionPdfNombre },
    );
    return publicJob(after);
  }

  async removePdf(id: string, viewer: AuthUser) {
    const before = await this.db.job.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Oferta no encontrada');
    if (!before.descripcionPdfPath) throw new NotFoundException('La oferta no tiene PDF adjunto.');
    const after = await this.db.job.update({ where: { id }, data: { descripcionPdfPath: null, descripcionPdfNombre: null } });
    await this.storage.remove(before.descripcionPdfPath).catch(() => undefined);
    await this.audit(viewer.id, 'UPDATE', id, { descripcionPdfNombre: before.descripcionPdfNombre }, { descripcionPdfNombre: null });
    return publicJob(after);
  }

  /** URL de descarga temporal del PDF. Solo ADMIN/RRHH (lo exige el controller). Auditado. */
  async pdfDownloadUrl(id: string, viewer: AuthUser): Promise<string> {
    const job = await this.db.job.findUnique({ where: { id }, select: { descripcionPdfPath: true, descripcionPdfNombre: true } });
    if (!job) throw new NotFoundException('Oferta no encontrada');
    if (!job.descripcionPdfPath) throw new NotFoundException('La oferta no tiene PDF adjunto.');
    await this.audit(viewer.id, 'DOWNLOAD', id, null, { descripcionPdfNombre: job.descripcionPdfNombre });
    return this.storage.getDownloadUrl(job.descripcionPdfPath);
  }

  private audit(actorId: string, action: string, entityId: string, before: unknown, after: unknown) {
    return this.db.auditLog.create({
      data: { actorId, action, entity: 'Job', entityId, before: before as object, after: after as object },
    });
  }
}
