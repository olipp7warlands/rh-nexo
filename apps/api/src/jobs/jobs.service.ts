import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { CreateJobDto, UpdateJobDto } from './jobs.dto';

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
        applications: { select: { stage: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
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
      },
    });
    if (!job) throw new NotFoundException('Oferta no encontrada');
    return job;
  }

  async create(dto: CreateJobDto, viewer: AuthUser) {
    const job = await this.db.job.create({ data: { ...dto } });
    await this.audit(viewer.id, 'CREATE', job.id, null, job);
    return job;
  }

  async update(id: string, dto: UpdateJobDto, viewer: AuthUser) {
    const before = await this.db.job.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Oferta no encontrada');
    const closing = dto.status === 'CERRADA' && before.status !== 'CERRADA';
    const after = await this.db.job.update({
      where: { id },
      data: { ...dto, ...(closing ? { closedAt: new Date() } : {}) },
    });
    await this.audit(viewer.id, 'UPDATE', id, before, after);
    return after;
  }

  private audit(actorId: string, action: string, entityId: string, before: unknown, after: unknown) {
    return this.db.auditLog.create({
      data: { actorId, action, entity: 'Job', entityId, before: before as object, after: after as object },
    });
  }
}
