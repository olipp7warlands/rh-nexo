import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JobStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { CreateJobDto, UpdateJobDto } from './jobs.dto';

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
  constructor(private readonly db: PrismaService) {}

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
      ...job,
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
    return job;
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
    return job;
  }

  async update(id: string, dto: UpdateJobDto, viewer: AuthUser) {
    await this.assertSociedadExists(dto.sociedadId);
    await this.assertProyectoExists(dto.proyectoId);
    const before = await this.db.job.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Oferta no encontrada');
    const dates = resolveJobDates(before, dto);
    const after = await this.db.job.update({ where: { id }, data: { ...dto, ...dates } });
    await this.audit(viewer.id, 'UPDATE', id, before, after);
    return after;
  }

  private audit(actorId: string, action: string, entityId: string, before: unknown, after: unknown) {
    return this.db.auditLog.create({
      data: { actorId, action, entity: 'Job', entityId, before: before as object, after: after as object },
    });
  }
}
