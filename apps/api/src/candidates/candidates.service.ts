import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { CreateCandidateDto } from './candidates.dto';

@Injectable()
export class CandidatesService {
  constructor(private readonly db: PrismaService) {}

  /** RRHH/ADMIN ven todos los candidatos; MANAGER solo los que aplican a una oferta suya. */
  private scopeWhere(viewer: AuthUser): Prisma.CandidateWhereInput {
    if (viewer.role === 'ADMIN' || viewer.role === 'RRHH') return {};
    const own = viewer.employeeId ?? '__none__';
    return { applications: { some: { job: { hiringManagerId: own } } } };
  }

  /**
   * Auditoría A4: el filtro anterior solo decidía si el viewer podía ver AL candidato (le
   * bastaba con compartir UNA candidatura con una oferta propia), pero luego devolvía TODAS
   * sus candidaturas — incluidas las de pipelines de otros managers, con entrevistas,
   * evaluaciones y decisiones ajenas. Este segundo filtro se aplica a la relación
   * `applications` en sí, no solo a la existencia del candidato.
   */
  private applicationsWhere(viewer: AuthUser): Prisma.ApplicationWhereInput {
    if (viewer.role === 'ADMIN' || viewer.role === 'RRHH') return {};
    const own = viewer.employeeId ?? '__none__';
    return { job: { hiringManagerId: own } };
  }

  findAll(viewer: AuthUser, search?: string) {
    return this.db.candidate.findMany({
      where: {
        ...this.scopeWhere(viewer),
        ...(search ? { fullName: { contains: search, mode: 'insensitive' } } : {}),
      },
      include: {
        applications: {
          where: this.applicationsWhere(viewer),
          select: { id: true, status: true, job: { select: { id: true, title: true } }, stage: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, viewer: AuthUser) {
    const candidate = await this.db.candidate.findFirst({
      where: { id, ...this.scopeWhere(viewer) },
      include: {
        applications: {
          where: this.applicationsWhere(viewer),
          include: {
            job: { select: { id: true, title: true } },
            stage: true,
            interviews: { orderBy: { scheduledAt: 'asc' } },
            evaluations: { orderBy: { createdAt: 'desc' } },
            decisions: { orderBy: { createdAt: 'desc' } },
          },
          orderBy: { appliedAt: 'desc' },
        },
      },
    });
    if (!candidate) throw new NotFoundException('Candidato no encontrado');
    return candidate;
  }

  async create(dto: CreateCandidateDto, viewer: AuthUser) {
    const candidate = await this.db.candidate.create({ data: { ...dto } });
    await this.audit(viewer.id, 'CREATE', candidate.id, null, candidate);
    return candidate;
  }

  private audit(actorId: string, action: string, entityId: string, before: unknown, after: unknown) {
    return this.db.auditLog.create({
      data: { actorId, action, entity: 'Candidate', entityId, before: before as object, after: after as object },
    });
  }
}
