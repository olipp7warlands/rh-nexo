import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { CreateProcessDto } from './onboarding.dto';

@Injectable()
export class OnboardingService {
  constructor(private readonly db: PrismaService) {}

  private scopeWhere(viewer: AuthUser): Prisma.OnboardingProcessWhereInput {
    const own = viewer.employeeId ?? '__none__';
    if (viewer.role === 'ADMIN' || viewer.role === 'RRHH') return {};
    if (viewer.role === 'MANAGER') return { OR: [{ employeeId: own }, { employee: { managerId: own } }] };
    return { employeeId: own };
  }

  private readonly employeeSelect = { select: { id: true, fullName: true, jobTitle: true, department: { select: { name: true, color: true } } } };

  async findAll(viewer: AuthUser) {
    const procs = await this.db.onboardingProcess.findMany({
      where: this.scopeWhere(viewer),
      include: {
        employee: this.employeeSelect,
        buddy: { select: { id: true, fullName: true } },
        tasks: { select: { done: true } },
      },
      orderBy: { startDate: 'desc' },
    });
    return procs.map(({ tasks, ...p }) => ({
      ...p,
      total: tasks.length,
      done: tasks.filter((t) => t.done).length,
    }));
  }

  async findOne(id: string, viewer: AuthUser) {
    const proc = await this.db.onboardingProcess.findFirst({
      where: { id, ...this.scopeWhere(viewer) },
      include: {
        employee: this.employeeSelect,
        buddy: { select: { id: true, fullName: true } },
        tasks: { orderBy: { id: 'asc' } },
      },
    });
    if (!proc) throw new NotFoundException('Proceso de onboarding no encontrado');
    return proc;
  }

  templates() {
    return this.db.onboardingTemplate.findMany({
      include: { tasks: { orderBy: { order: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async toggleTask(taskId: string, done: boolean, viewer: AuthUser) {
    const task = await this.db.onboardingTask.findUnique({
      where: { id: taskId },
      include: { process: { include: { employee: { select: { managerId: true } } } } },
    });
    if (!task) throw new NotFoundException('Tarea no encontrada');
    this.assertCanManage(viewer, task.process.employee.managerId);

    const updated = await this.db.onboardingTask.update({
      where: { id: taskId },
      data: { done, doneAt: done ? new Date() : null },
    });
    await this.audit(viewer.id, 'UPDATE', 'OnboardingTask', taskId, { done: task.done }, { done });
    return updated;
  }

  async create(dto: CreateProcessDto, viewer: AuthUser) {
    const existing = await this.db.onboardingProcess.findUnique({ where: { employeeId: dto.employeeId } });
    if (existing) throw new BadRequestException('El empleado ya tiene un proceso de onboarding.');

    const template = dto.templateId
      ? await this.db.onboardingTemplate.findUnique({ where: { id: dto.templateId }, include: { tasks: true } })
      : await this.db.onboardingTemplate.findFirst({ include: { tasks: true } });

    const proc = await this.db.onboardingProcess.create({
      data: {
        employeeId: dto.employeeId,
        buddyId: dto.buddyId,
        templateId: template?.id,
        startDate: new Date(dto.startDate),
        tasks: template
          ? { create: template.tasks.map((t) => ({ label: t.label, phase: t.phase, owner: t.owner })) }
          : undefined,
      },
      include: { tasks: true },
    });
    await this.audit(viewer.id, 'CREATE', 'OnboardingProcess', proc.id, null, { employeeId: dto.employeeId });
    return proc;
  }

  private assertCanManage(viewer: AuthUser, employeeManagerId: string | null) {
    if (viewer.role === 'ADMIN' || viewer.role === 'RRHH') return;
    if (viewer.role === 'MANAGER' && employeeManagerId === viewer.employeeId) return;
    throw new ForbiddenException('No autorizado para modificar este onboarding.');
  }

  private audit(actorId: string, action: string, entity: string, entityId: string, before: unknown, after: unknown) {
    return this.db.auditLog.create({
      data: { actorId, action, entity, entityId, before: before as object, after: after as object },
    });
  }
}
