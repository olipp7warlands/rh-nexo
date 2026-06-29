import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { CreateCycleDto, CreateObjectiveDto, UpdateReviewDto } from './performance.dto';

@Injectable()
export class PerformanceService {
  constructor(private readonly db: PrismaService) {}

  cycles() {
    return this.db.performanceCycle.findMany({
      include: { _count: { select: { reviews: true, objectives: true } } },
      orderBy: { startDate: 'desc' },
    });
  }

  createCycle(dto: CreateCycleDto, viewer: AuthUser) {
    return this.db.performanceCycle
      .create({ data: { name: dto.name, startDate: new Date(dto.startDate), endDate: new Date(dto.endDate) } })
      .then(async (c) => {
        await this.audit(viewer.id, 'CREATE', 'PerformanceCycle', c.id, null, c);
        return c;
      });
  }

  async cycle(id: string) {
    const cycle = await this.db.performanceCycle.findUnique({
      where: { id },
      include: {
        reviews: {
          include: {
            employee: { select: { id: true, fullName: true, jobTitle: true, managerId: true, department: { select: { name: true, color: true } } } },
            reviewer: { select: { id: true, fullName: true } },
          },
          orderBy: { employee: { fullName: 'asc' } },
        },
        objectives: {
          include: { owner: { select: { id: true, fullName: true } }, keyResults: { orderBy: { id: 'asc' } } },
          orderBy: { scope: 'asc' },
        },
      },
    });
    if (!cycle) throw new NotFoundException('Ciclo no encontrado');
    return cycle;
  }

  async updateReview(id: string, dto: UpdateReviewDto, viewer: AuthUser) {
    const review = await this.db.review.findUnique({
      where: { id },
      include: { employee: { select: { id: true, managerId: true } } },
    });
    if (!review) throw new NotFoundException('Evaluación no encontrada');

    const isSelf = viewer.employeeId === review.employeeId;
    const isManager = viewer.role === 'MANAGER' && review.employee.managerId === viewer.employeeId;
    const privileged = viewer.role === 'ADMIN' || viewer.role === 'RRHH';
    if (!isSelf && !isManager && !privileged) {
      throw new ForbiddenException('No autorizado para esta evaluación.');
    }

    const before = { selfDone: review.selfDone, managerDone: review.managerDone, o2oDone: review.o2oDone, rating: review.rating };
    const updated = await this.db.review.update({ where: { id }, data: dto });
    await this.audit(viewer.id, 'UPDATE', 'Review', id, before, dto);
    return updated;
  }

  objectives(cycleId?: string) {
    return this.db.objective.findMany({
      where: cycleId ? { cycleId } : undefined,
      include: { owner: { select: { id: true, fullName: true } }, keyResults: { orderBy: { id: 'asc' } } },
      orderBy: { scope: 'asc' },
    });
  }

  async createObjective(dto: CreateObjectiveDto, viewer: AuthUser) {
    const obj = await this.db.objective.create({
      data: {
        cycleId: dto.cycleId,
        scope: dto.scope,
        ownerId: dto.ownerId,
        title: dto.title,
        keyResults: dto.keyResults?.length
          ? { create: dto.keyResults.map((k) => ({ title: k.title, progress: k.progress ?? 0 })) }
          : undefined,
      },
      include: { keyResults: true },
    });
    await this.audit(viewer.id, 'CREATE', 'Objective', obj.id, null, { title: dto.title });
    return obj;
  }

  async updateKeyResult(id: string, progress: number, viewer: AuthUser) {
    const kr = await this.db.keyResult.findUnique({ where: { id }, include: { objective: { select: { ownerId: true } } } });
    if (!kr) throw new NotFoundException('Key Result no encontrado');

    const isOwner = viewer.employeeId === kr.objective.ownerId;
    const privileged = viewer.role === 'ADMIN' || viewer.role === 'RRHH' || viewer.role === 'MANAGER';
    if (!isOwner && !privileged) throw new ForbiddenException('No autorizado para actualizar este OKR.');

    return this.db.keyResult.update({ where: { id }, data: { progress } });
  }

  private audit(actorId: string, action: string, entity: string, entityId: string, before: unknown, after: unknown) {
    return this.db.auditLog.create({
      data: { actorId, action, entity, entityId, before: before as object, after: after as object },
    });
  }
}
