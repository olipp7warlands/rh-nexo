import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';

const DIAS_ATRAS = 7;
const DIAS_ADELANTE = 42; // ~6 semanas

function diffDias(fecha: Date, desde: Date): number {
  return Math.round((fecha.getTime() - desde.getTime()) / (1000 * 60 * 60 * 24));
}

@Injectable()
export class AgendaService {
  constructor(private readonly db: PrismaService) {}

  /**
   * Alertas de contrato: lógica derivada de finPeriodoPrueba/vencimientoContrato — no es una
   * entidad, no hay tabla propia (ver PLAN-humanX.md §4). Ventana: desde unos días atrás
   * (para no perder algo que venció hace poco y sigue pendiente de gestionar) hasta ~6
   * semanas vista.
   */
  async alertas(viewer: AuthUser) {
    const hoy = new Date();
    const desde = new Date(hoy);
    desde.setDate(desde.getDate() - DIAS_ATRAS);
    const hasta = new Date(hoy);
    hasta.setDate(hasta.getDate() + DIAS_ADELANTE);

    const where: Prisma.EmployeeWhereInput = {
      status: { not: 'BAJA' },
      OR: [
        { finPeriodoPrueba: { gte: desde, lte: hasta } },
        { vencimientoContrato: { gte: desde, lte: hasta } },
      ],
    };
    if (viewer.role === 'MANAGER') where.managerId = viewer.employeeId ?? '__none__';
    if (viewer.role === 'EMPLEADO') where.id = viewer.employeeId ?? '__none__';

    const empleados = await this.db.employee.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        jobTitle: true,
        finPeriodoPrueba: true,
        vencimientoContrato: true,
        sociedad: { select: { nombre: true } },
      },
    });

    const alertas: {
      id: string;
      empleado: { id: string; fullName: string; jobTitle: string; sociedad: string | null };
      tipo: 'FIN_PRUEBA' | 'VENCIMIENTO_CONTRATO';
      fecha: Date;
      diasRestantes: number;
    }[] = [];

    for (const e of empleados) {
      const empleado = { id: e.id, fullName: e.fullName, jobTitle: e.jobTitle, sociedad: e.sociedad?.nombre ?? null };
      if (e.finPeriodoPrueba && e.finPeriodoPrueba >= desde && e.finPeriodoPrueba <= hasta) {
        alertas.push({ id: `${e.id}-prueba`, empleado, tipo: 'FIN_PRUEBA', fecha: e.finPeriodoPrueba, diasRestantes: diffDias(e.finPeriodoPrueba, hoy) });
      }
      if (e.vencimientoContrato && e.vencimientoContrato >= desde && e.vencimientoContrato <= hasta) {
        alertas.push({ id: `${e.id}-vencimiento`, empleado, tipo: 'VENCIMIENTO_CONTRATO', fecha: e.vencimientoContrato, diasRestantes: diffDias(e.vencimientoContrato, hoy) });
      }
    }

    return alertas.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  }
}
