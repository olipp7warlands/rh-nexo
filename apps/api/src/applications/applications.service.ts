import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Job } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import {
  AddEvaluationDto,
  AddInterviewDto,
  CreateApplicationDto,
  HireDto,
  MoveStageDto,
  UpdateInterviewDto,
} from './applications.dto';

@Injectable()
export class ApplicationsService {
  constructor(private readonly db: PrismaService) {}

  stages() {
    return this.db.stage.findMany({ orderBy: { order: 'asc' } });
  }

  /** RRHH/ADMIN operan sobre cualquier oferta; MANAGER solo sobre la suya (hiringManagerId). */
  private assertJobAccess(job: Pick<Job, 'hiringManagerId'>, viewer: AuthUser) {
    if (viewer.role === 'ADMIN' || viewer.role === 'RRHH') return;
    if (viewer.role === 'MANAGER' && job.hiringManagerId === viewer.employeeId) return;
    throw new ForbiddenException('No autorizado para esta oferta.');
  }

  private async requireJob(jobId: string, viewer: AuthUser) {
    const job = await this.db.job.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Oferta no encontrada');
    this.assertJobAccess(job, viewer);
    return job;
  }

  private async requireApplication(id: string, viewer: AuthUser) {
    const app = await this.db.application.findUnique({
      where: { id },
      include: { job: true, candidate: true, stage: true },
    });
    if (!app) throw new NotFoundException('Candidatura no encontrada');
    this.assertJobAccess(app.job, viewer);
    return app;
  }

  async findByJob(jobId: string, viewer: AuthUser) {
    await this.requireJob(jobId, viewer);
    return this.db.application.findMany({
      where: { jobId },
      include: {
        candidate: true,
        stage: true,
        interviews: { select: { id: true, type: true, status: true, scheduledAt: true } },
        evaluations: { select: { id: true, score: true, recommendation: true } },
      },
      orderBy: { appliedAt: 'desc' },
    });
  }

  async create(dto: CreateApplicationDto, viewer: AuthUser) {
    await this.requireJob(dto.jobId, viewer);
    const nuevo = await this.db.stage.findUnique({ where: { name: 'Nuevo' } });
    if (!nuevo) throw new BadRequestException('Falta la etapa "Nuevo" en el pipeline.');
    const app = await this.db.application.create({
      data: { jobId: dto.jobId, candidateId: dto.candidateId, stageId: nuevo.id },
      include: { job: true, candidate: true, stage: true },
    });
    await this.audit(viewer.id, 'CREATE', app.id, null, app);
    return app;
  }

  async moveStage(id: string, dto: MoveStageDto, viewer: AuthUser) {
    const app = await this.requireApplication(id, viewer);
    if (app.status !== 'ACTIVO') throw new BadRequestException('La candidatura ya no está activa.');
    const stage = await this.db.stage.findUnique({ where: { id: dto.stageId } });
    if (!stage) throw new NotFoundException('Etapa no encontrada');

    const updated = await this.db.application.update({
      where: { id },
      data: { stageId: stage.id },
      include: { job: true, candidate: true, stage: true },
    });
    await this.audit(viewer.id, 'UPDATE', id, { stageId: app.stageId }, { stageId: stage.id });
    await this.decide(id, 'ADVANCE_STAGE', false, viewer.id, `Avanza a "${stage.name}"`);
    return updated;
  }

  async reject(id: string, viewer: AuthUser, reason?: string) {
    const app = await this.requireApplication(id, viewer);
    if (app.status !== 'ACTIVO') throw new BadRequestException('La candidatura ya no está activa.');

    const updated = await this.db.application.update({ where: { id }, data: { status: 'RECHAZADO' } });
    await this.audit(viewer.id, 'REJECT', id, { status: app.status }, { status: 'RECHAZADO' });
    await this.decide(id, 'REJECT', false, viewer.id, reason ?? 'Descartado manualmente');
    return updated;
  }

  /**
   * Cribado automático (regla real, sin IA): sin CV adjunto -> descarte; con CV -> avanza de
   * "Nuevo" a "Cribado". Cada resultado queda en AuditDecision con automated=true.
   */
  async autoScreen(jobId: string, viewer: AuthUser) {
    await this.requireJob(jobId, viewer);
    const [nuevo, cribado] = await Promise.all([
      this.db.stage.findUnique({ where: { name: 'Nuevo' } }),
      this.db.stage.findUnique({ where: { name: 'Cribado' } }),
    ]);
    if (!nuevo || !cribado) throw new BadRequestException('Faltan etapas del pipeline en el seed.');

    const candidatas = await this.db.application.findMany({
      where: { jobId, stageId: nuevo.id, status: 'ACTIVO' },
      include: { candidate: true },
    });

    let advanced = 0;
    let rejected = 0;
    for (const app of candidatas) {
      if (app.candidate.resumeUrl) {
        await this.db.application.update({ where: { id: app.id }, data: { stageId: cribado.id } });
        await this.decide(app.id, 'AUTO_SCREEN', true, undefined, 'Cribado automático: CV recibido, avanza a Cribado');
        advanced++;
      } else {
        await this.db.application.update({ where: { id: app.id }, data: { status: 'RECHAZADO' } });
        await this.decide(app.id, 'AUTO_SCREEN', true, undefined, 'Cribado automático: sin CV adjunto');
        rejected++;
      }
    }
    await this.audit(viewer.id, 'AUTO_SCREEN', jobId, null, { advanced, rejected, total: candidatas.length }, 'Job');
    return { advanced, rejected, total: candidatas.length };
  }

  async addInterview(applicationId: string, dto: AddInterviewDto, viewer: AuthUser) {
    await this.requireApplication(applicationId, viewer);
    const interview = await this.db.interview.create({
      data: {
        applicationId,
        type: dto.type,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        interviewerId: dto.interviewerId,
      },
    });
    await this.audit(viewer.id, 'CREATE', interview.id, null, interview, 'Interview');
    return interview;
  }

  async updateInterview(id: string, dto: UpdateInterviewDto, viewer: AuthUser) {
    const interview = await this.db.interview.findUnique({
      where: { id },
      include: { application: { include: { job: true } } },
    });
    if (!interview) throw new NotFoundException('Entrevista no encontrada');
    this.assertJobAccess(interview.application.job, viewer);

    const { application, ...before } = interview;
    const updated = await this.db.interview.update({
      where: { id },
      data: {
        status: dto.status,
        feedback: dto.feedback,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
      },
    });
    await this.audit(viewer.id, 'UPDATE', id, before, updated, 'Interview');
    return updated;
  }

  async addEvaluation(applicationId: string, dto: AddEvaluationDto, viewer: AuthUser) {
    await this.requireApplication(applicationId, viewer);
    const evaluation = await this.db.evaluation.create({
      data: { applicationId, evaluatorId: viewer.employeeId ?? undefined, ...dto },
    });
    await this.audit(viewer.id, 'CREATE', evaluation.id, null, evaluation, 'Evaluation');
    return evaluation;
  }

  /**
   * La automatización clave de la Fase 6: al contratar, crea el Employee (enlazado por
   * candidateId) y arranca su Proceso de tipo ONBOARDING con la plantilla activa, todo atómico.
   * Solo RRHH/ADMIN (el controller ya lo restringe vía @Roles).
   */
  async hire(applicationId: string, dto: HireDto, viewer: AuthUser) {
    const app = await this.db.application.findUnique({
      where: { id: applicationId },
      include: { job: true, candidate: true },
    });
    if (!app) throw new NotFoundException('Candidatura no encontrada');
    if (app.status !== 'ACTIVO') throw new BadRequestException('Solo se puede contratar una candidatura activa.');

    const existing = await this.db.employee.findUnique({ where: { candidateId: app.candidateId } });
    if (existing) throw new BadRequestException('Este candidato ya tiene una ficha de empleado.');

    const contratado = await this.db.stage.findUnique({ where: { name: 'Contratado' } });

    return this.db.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          fullName: app.candidate.fullName,
          email: app.candidate.email,
          phone: app.candidate.phone,
          jobTitle: dto.jobTitle ?? app.job.title,
          level: dto.level ?? app.job.level,
          location: dto.location ?? app.job.location,
          remote: app.job.remote,
          startDate: new Date(dto.startDate),
          contractType: dto.contractType ?? app.job.contractType,
          status: 'ONBOARDING',
          salary: dto.salary,
          departmentId: dto.departmentId ?? app.job.departmentId ?? undefined,
          managerId: dto.managerId ?? app.job.hiringManagerId ?? undefined,
          candidateId: app.candidateId,
          fromRecruitment: true,
        },
      });

      // Misma copia de plantilla que ProcesosService.create() (procesos.service.ts),
      // reimplementada aquí para que quede dentro de la misma transacción.
      const plantilla = await tx.plantillaProceso.findFirst({ where: { tipo: 'ONBOARDING', activa: true }, include: { tareas: { orderBy: { orden: 'asc' } } } });
      const onboarding = await tx.proceso.create({
        data: {
          employeeId: employee.id,
          tipo: 'ONBOARDING',
          buddyId: dto.buddyId,
          plantillaId: plantilla?.id,
          fechaInicio: new Date(dto.startDate),
          tareas: plantilla
            ? { create: plantilla.tareas.map((t) => ({ label: t.label, fase: t.fase, responsable: t.responsable })) }
            : undefined,
        },
        include: { tareas: true },
      });

      const application = await tx.application.update({
        where: { id: applicationId },
        data: { status: 'CONTRATADO', stageId: contratado?.id },
      });

      await tx.auditLog.create({
        data: {
          actorId: viewer.id,
          action: 'CREATE',
          entity: 'Employee',
          entityId: employee.id,
          before: null as unknown as object,
          after: employee as unknown as object,
        },
      });
      await tx.auditDecision.create({
        data: { applicationId, type: 'HIRE', automated: false, actorId: viewer.id, reason: 'Contratación confirmada' },
      });

      return { employee, onboarding, application };
    });
  }

  private decide(applicationId: string, type: string, automated: boolean, actorId: string | undefined, reason: string) {
    return this.db.auditDecision.create({ data: { applicationId, type, automated, actorId, reason } });
  }

  private audit(actorId: string, action: string, entityId: string, before: unknown, after: unknown, entity = 'Application') {
    return this.db.auditLog.create({
      data: { actorId, action, entity, entityId, before: before as object, after: after as object },
    });
  }
}
