import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EstadoProceso, EstadoTarea, Prisma, TipoProceso } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import {
  CreatePlantillaDto,
  CreatePlantillaTareaDto,
  CreateProcesoDto,
  UpdatePlantillaDto,
  UpdatePlantillaTareaDto,
} from './procesos.dto';

@Injectable()
export class ProcesosService {
  constructor(private readonly db: PrismaService) {}

  private scopeWhere(viewer: AuthUser): Prisma.ProcesoWhereInput {
    const own = viewer.employeeId ?? '__none__';
    if (viewer.role === 'ADMIN' || viewer.role === 'RRHH') return {};
    if (viewer.role === 'MANAGER') return { OR: [{ employeeId: own }, { employee: { managerId: own } }] };
    return { employeeId: own };
  }

  private readonly employeeSelect = {
    select: { id: true, fullName: true, jobTitle: true, department: { select: { name: true, color: true } } },
  };

  // Mismo criterio que en employees.service.ts/anotaciones.service.ts: tope de seguridad, no
  // paginación real todavía.
  private readonly DEFAULT_TAKE = 200;

  async findAll(viewer: AuthUser, tipo?: TipoProceso, take?: number, skip?: number) {
    const procesos = await this.db.proceso.findMany({
      where: { ...this.scopeWhere(viewer), ...(tipo ? { tipo } : {}) },
      include: {
        employee: this.employeeSelect,
        buddy: { select: { id: true, fullName: true } },
        tareas: { select: { estado: true } },
      },
      relationLoadStrategy: 'join',
      orderBy: { fechaInicio: 'desc' },
      take: take ?? this.DEFAULT_TAKE,
      skip,
    });
    return procesos.map(({ tareas, ...p }) => ({
      ...p,
      total: tareas.length,
      completadas: tareas.filter((t) => t.estado === 'COMPLETADA').length,
    }));
  }

  async findOne(id: string, viewer: AuthUser) {
    const proceso = await this.db.proceso.findFirst({
      where: { id, ...this.scopeWhere(viewer) },
      include: {
        employee: this.employeeSelect,
        buddy: { select: { id: true, fullName: true } },
        // Las tareas se copian de la plantilla en orden en `create()`; sin columna de orden
        // propia, el id (cuid, monótono en el momento de creación) reconstruye ese orden.
        tareas: { orderBy: { id: 'asc' } },
      },
      relationLoadStrategy: 'join',
    });
    if (!proceso) throw new NotFoundException('Proceso no encontrado');
    return proceso;
  }

  async create(dto: CreateProcesoDto, viewer: AuthUser) {
    const plantilla = dto.plantillaId
      ? await this.db.plantillaProceso.findUnique({ where: { id: dto.plantillaId }, include: { tareas: { orderBy: { orden: 'asc' } } } })
      : await this.db.plantillaProceso.findFirst({ where: { tipo: dto.tipo, activa: true }, include: { tareas: { orderBy: { orden: 'asc' } } } });

    const proceso = await this.db.proceso.create({
      data: {
        employeeId: dto.employeeId,
        tipo: dto.tipo,
        buddyId: dto.buddyId,
        plantillaId: plantilla?.id,
        nombre: dto.nombre,
        fechaInicio: new Date(dto.fechaInicio),
        fechaObjetivo: dto.fechaObjetivo ? new Date(dto.fechaObjetivo) : undefined,
        // Se COPIAN las tareas de la plantilla activa (no se referencian): así, editar la
        // plantilla más tarde no altera retroactivamente procesos ya iniciados.
        tareas: plantilla
          ? { create: plantilla.tareas.map((t) => ({ label: t.label, fase: t.fase, responsable: t.responsable })) }
          : undefined,
      },
      include: { tareas: true },
    });
    await this.audit(viewer.id, 'CREATE', 'Proceso', proceso.id, null, { employeeId: dto.employeeId, tipo: dto.tipo });
    return proceso;
  }

  async updateEstado(id: string, estado: EstadoProceso, viewer: AuthUser) {
    const proceso = await this.db.proceso.findUnique({ where: { id }, include: { employee: { select: { managerId: true } } } });
    if (!proceso) throw new NotFoundException('Proceso no encontrado');
    this.assertCanManage(viewer, proceso.employee.managerId);

    const updated = await this.db.proceso.update({ where: { id }, data: { estado } });
    await this.audit(viewer.id, 'UPDATE', 'Proceso', id, { estado: proceso.estado }, { estado });
    return updated;
  }

  async updateTareaEstado(tareaId: string, estado: EstadoTarea, viewer: AuthUser) {
    const tarea = await this.db.procesoTarea.findUnique({
      where: { id: tareaId },
      include: { proceso: { include: { employee: { select: { managerId: true } } } } },
    });
    if (!tarea) throw new NotFoundException('Tarea no encontrada');
    this.assertCanManage(viewer, tarea.proceso.employee.managerId);

    const updated = await this.db.procesoTarea.update({
      where: { id: tareaId },
      data: { estado, completadaAt: estado === 'COMPLETADA' ? new Date() : null },
    });
    await this.audit(viewer.id, 'UPDATE', 'ProcesoTarea', tareaId, { estado: tarea.estado }, { estado });
    return updated;
  }

  // --- Plantillas (editor maestro) ---

  plantillas(tipo?: TipoProceso) {
    return this.db.plantillaProceso.findMany({
      where: tipo ? { tipo } : undefined,
      include: { tareas: { orderBy: { orden: 'asc' } }, _count: { select: { procesos: true } } },
      orderBy: { nombre: 'asc' },
    });
  }

  async plantilla(id: string) {
    const plantilla = await this.db.plantillaProceso.findUnique({
      where: { id },
      include: { tareas: { orderBy: { orden: 'asc' } } },
    });
    if (!plantilla) throw new NotFoundException('Plantilla no encontrada');
    return plantilla;
  }

  async createPlantilla(dto: CreatePlantillaDto, viewer: AuthUser) {
    const plantilla = await this.db.plantillaProceso.create({ data: dto });
    await this.audit(viewer.id, 'CREATE', 'PlantillaProceso', plantilla.id, null, dto);
    return plantilla;
  }

  async updatePlantilla(id: string, dto: UpdatePlantillaDto, viewer: AuthUser) {
    const before = await this.plantilla(id);
    const plantilla = await this.db.plantillaProceso.update({ where: { id }, data: dto });
    await this.audit(viewer.id, 'UPDATE', 'PlantillaProceso', id, { nombre: before.nombre, activa: before.activa }, dto);
    return plantilla;
  }

  async duplicarPlantilla(id: string, viewer: AuthUser) {
    const original = await this.plantilla(id);
    // La copia nace archivada (activa: false): evita que dos plantillas del mismo tipo
    // queden activas a la vez y se disputen el "+ Iniciar" por defecto.
    const copia = await this.db.plantillaProceso.create({
      data: {
        nombre: `${original.nombre} (copia)`,
        tipo: original.tipo,
        activa: false,
        tareas: { create: original.tareas.map((t) => ({ label: t.label, fase: t.fase, responsable: t.responsable, orden: t.orden })) },
      },
      include: { tareas: true },
    });
    await this.audit(viewer.id, 'CREATE', 'PlantillaProceso', copia.id, null, { duplicadaDe: id });
    return copia;
  }

  async createTarea(plantillaId: string, dto: CreatePlantillaTareaDto, viewer: AuthUser) {
    await this.plantilla(plantillaId);
    const tarea = await this.db.plantillaProcesoTarea.create({
      data: { plantillaId, label: dto.label, fase: dto.fase, responsable: dto.responsable, orden: dto.orden ?? 0 },
    });
    await this.audit(viewer.id, 'CREATE', 'PlantillaProcesoTarea', tarea.id, null, dto);
    return tarea;
  }

  async updateTarea(tareaId: string, dto: UpdatePlantillaTareaDto, viewer: AuthUser) {
    const before = await this.db.plantillaProcesoTarea.findUnique({ where: { id: tareaId } });
    if (!before) throw new NotFoundException('Tarea de plantilla no encontrada');
    const tarea = await this.db.plantillaProcesoTarea.update({ where: { id: tareaId }, data: dto });
    await this.audit(viewer.id, 'UPDATE', 'PlantillaProcesoTarea', tareaId, before, dto);
    return tarea;
  }

  async removeTarea(tareaId: string, viewer: AuthUser) {
    const before = await this.db.plantillaProcesoTarea.findUnique({ where: { id: tareaId } });
    if (!before) throw new NotFoundException('Tarea de plantilla no encontrada');
    await this.db.plantillaProcesoTarea.delete({ where: { id: tareaId } });
    await this.audit(viewer.id, 'DELETE', 'PlantillaProcesoTarea', tareaId, before, null);
    return { ok: true };
  }

  private assertCanManage(viewer: AuthUser, employeeManagerId: string | null) {
    if (viewer.role === 'ADMIN' || viewer.role === 'RRHH') return;
    if (viewer.role === 'MANAGER' && employeeManagerId === viewer.employeeId) return;
    throw new ForbiddenException('No autorizado para modificar este proceso.');
  }

  private audit(actorId: string, action: string, entity: string, entityId: string, before: unknown, after: unknown) {
    return this.db.auditLog.create({
      data: { actorId, action, entity, entityId, before: before as object, after: after as object },
    });
  }
}
