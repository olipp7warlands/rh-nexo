import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { CreateCandidateDto, HistoricoQueryDto } from './candidates.dto';

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
    // Registro de accesos (RGPD): la ficha incluye CV, LinkedIn y datos de contacto de un
    // tercero. Solo en la apertura real, y solo si existe y el viewer puede verla.
    await this.db.auditLog.create({ data: { actorId: viewer.id, action: 'VIEW', entity: 'Candidate', entityId: id } });
    return candidate;
  }

  /**
   * Histórico transversal: una fila por CANDIDATURA (una persona con 3 procesos sale 3 veces),
   * de todas las ofertas. Solo ADMIN/RRHH — el controlador ya lo exige; se repite aquí como
   * defensa en profundidad, porque NO aplica scopeWhere (un MANAGER vería pipelines ajenos, el
   * IDOR de la auditoría A4). Registra UNA entrada de auditoría por consulta con sus filtros
   * (no una por fila): el acceso a la sección y lo que se buscó.
   */
  async historico(query: HistoricoQueryDto, viewer: AuthUser) {
    if (viewer.role !== 'ADMIN' && viewer.role !== 'RRHH') {
      throw new ForbiddenException('No autorizado para esta acción');
    }
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    const appliedAt: Prisma.DateTimeFilter = {};
    if (query.from) appliedAt.gte = new Date(query.from);
    if (query.to) {
      const to = new Date(query.to);
      // Solo fecha (YYYY-MM-DD) => inclusiva hasta el final de ese día.
      if (/^\d{4}-\d{2}-\d{2}$/.test(query.to)) to.setUTCHours(23, 59, 59, 999);
      appliedAt.lte = to;
    }

    const where: Prisma.ApplicationWhereInput = {
      ...(query.jobId ? { jobId: query.jobId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.sociedadId || query.proyectoId
        ? {
            job: {
              ...(query.sociedadId ? { sociedadId: query.sociedadId } : {}),
              ...(query.proyectoId ? { proyectoId: query.proyectoId } : {}),
            },
          }
        : {}),
      ...(query.q || query.location
        ? {
            candidate: {
              ...(query.q ? { fullName: { contains: query.q, mode: 'insensitive' as const } } : {}),
              ...(query.location ? { location: { contains: query.location, mode: 'insensitive' as const } } : {}),
            },
          }
        : {}),
      ...(Object.keys(appliedAt).length ? { appliedAt } : {}),
    };

    const [total, rows] = await this.db.$transaction([
      this.db.application.count({ where }),
      this.db.application.findMany({
        where,
        select: {
          id: true,
          status: true,
          appliedAt: true,
          fechaIncorporacion: true,
          candidate: { select: { id: true, fullName: true, resumeUrl: true, linkedinUrl: true, location: true } },
          job: {
            select: {
              id: true,
              title: true,
              openedAt: true,
              sociedad: { select: { id: true, nombre: true } },
              proyecto: { select: { id: true, nombre: true } },
            },
          },
        },
        orderBy: [{ appliedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    await this.db.auditLog.create({
      data: {
        actorId: viewer.id,
        action: 'VIEW',
        entity: 'CandidateHistory',
        after: {
          filters: {
            q: query.q ?? null,
            jobId: query.jobId ?? null,
            sociedadId: query.sociedadId ?? null,
            proyectoId: query.proyectoId ?? null,
            location: query.location ?? null,
            status: query.status ?? null,
            from: query.from ?? null,
            to: query.to ?? null,
          },
          page,
          pageSize,
          total,
        },
      },
    });

    return {
      total,
      page,
      pageSize,
      items: rows.map((a) => ({
        applicationId: a.id,
        candidateId: a.candidate.id,
        fullName: a.candidate.fullName,
        resumeUrl: a.candidate.resumeUrl,
        linkedinUrl: a.candidate.linkedinUrl,
        location: a.candidate.location,
        jobId: a.job.id,
        jobTitle: a.job.title,
        sociedad: a.job.sociedad,
        proyecto: a.job.proyecto,
        jobOpenedAt: a.job.openedAt,
        appliedAt: a.appliedAt,
        fechaIncorporacion: a.fechaIncorporacion,
        status: a.status,
      })),
    };
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
