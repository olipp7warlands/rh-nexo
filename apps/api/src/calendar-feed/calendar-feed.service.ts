import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { AbsencesService } from '../absences/absences.service';
import { AgendaService } from '../agenda/agenda.service';
import { buildCalendar, type IcsEvent } from '../lib/ics';

const DAY_MS = 24 * 60 * 60 * 1000;
const DIAS_ATRAS = 60;
const DIAS_ADELANTE = 365;
/** Los clientes de calendario refrescan cada varias horas: se publica como pista, no es tiempo real. */
const REFRESH_HOURS = 12;
/** 256 bits en hex. Cualquier otra forma se descarta sin tocar la base de datos. */
const TOKEN_RE = /^[0-9a-f]{64}$/;

const ABSENCE_LABEL: Record<string, string> = {
  VACACIONES: 'Vacaciones',
  ENFERMEDAD: 'Enfermedad',
  PERSONAL: 'Personal',
  MATERNIDAD: 'Maternidad/Paternidad',
};
const ALERT_LABEL: Record<string, string> = {
  FIN_PRUEBA: 'Fin del periodo de prueba',
  VENCIMIENTO_CONTRATO: 'Vencimiento de contrato',
};
const INTERVIEW_LABEL: Record<string, string> = {
  telefonica: 'telefónica',
  cultural: 'cultural',
  tecnica: 'técnica',
  final: 'final',
};

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * Feed ICS de solo lectura. El token (256 bits) solo existe en la URL que se muestra UNA vez al
 * generarlo; en base se guarda su SHA-256. Cada lectura revalida rol y estado de la cuenta, así que
 * desactivarla o regenerar el token corta el acceso al instante.
 *
 * Privacidad del contenido: nunca el motivo de una ausencia; el tipo solo en las propias y para
 * ADMIN/RRHH; las entrevistas llevan el puesto, JAMÁS el nombre del candidato (datos de terceros no
 * viajan a servidores de calendario externos).
 */
@Injectable()
export class CalendarFeedService {
  constructor(
    private readonly db: PrismaService,
    private readonly absences: AbsencesService,
    private readonly agenda: AgendaService,
  ) {}

  async status(userId: string) {
    const u = await this.db.user.findUnique({ where: { id: userId }, select: { calendarFeedTokenHash: true, calendarFeedTokenAt: true } });
    return { active: !!u?.calendarFeedTokenHash, createdAt: u?.calendarFeedTokenHash ? u.calendarFeedTokenAt : null };
  }

  /** Genera (o regenera: invalida el anterior al instante) el token. Devuelve la URL UNA sola vez. */
  async generate(viewer: AuthUser, baseUrl: string) {
    const token = randomBytes(32).toString('hex');
    const now = new Date();
    const before = await this.db.user.findUnique({ where: { id: viewer.id }, select: { calendarFeedTokenHash: true } });
    const regenerating = !!before?.calendarFeedTokenHash;
    await this.db.$transaction([
      this.db.user.update({ where: { id: viewer.id }, data: { calendarFeedTokenHash: hashToken(token), calendarFeedTokenAt: now } }),
      this.db.auditLog.create({
        data: {
          actorId: viewer.id,
          action: regenerating ? 'UPDATE' : 'CREATE',
          entity: 'CalendarFeed',
          entityId: viewer.id,
          // Nunca el token ni su hash: solo el estado.
          before: { active: regenerating },
          after: { active: true, createdAt: now.toISOString() },
        },
      }),
    ]);
    return { url: `${baseUrl}/api/calendar/feed/${token}.ics`, createdAt: now, regenerated: regenerating };
  }

  /** Revoca el feed. Idempotente: sin feed activo no hace nada ni audita. */
  async revoke(viewer: AuthUser) {
    const before = await this.db.user.findUnique({ where: { id: viewer.id }, select: { calendarFeedTokenHash: true } });
    if (!before?.calendarFeedTokenHash) return { active: false };
    await this.db.$transaction([
      this.db.user.update({ where: { id: viewer.id }, data: { calendarFeedTokenHash: null, calendarFeedTokenAt: null } }),
      this.db.auditLog.create({
        data: { actorId: viewer.id, action: 'DELETE', entity: 'CalendarFeed', entityId: viewer.id, before: { active: true }, after: { active: false } },
      }),
    ]);
    return { active: false };
  }

  /**
   * Resuelve el token y construye el .ics. Devuelve `null` —el controlador responde un 404 idéntico—
   * para token mal formado, desconocido, revocado o de una cuenta desactivada: no se distingue el caso.
   */
  async render(rawToken: string): Promise<{ body: string; etag: string } | null> {
    if (!TOKEN_RE.test(rawToken)) return null;
    const user = await this.db.user.findUnique({
      where: { calendarFeedTokenHash: hashToken(rawToken) },
      select: { id: true, email: true, role: true, isActive: true, employeeId: true, calendarFeedTokenAt: true },
    });
    if (!user || !user.isActive) return null;

    const viewer: AuthUser = { id: user.id, email: user.email, role: user.role, employeeId: user.employeeId, mustChangePassword: false };
    const from = new Date(Date.now() - DIAS_ATRAS * DAY_MS);
    const to = new Date(Date.now() + DIAS_ADELANTE * DAY_MS);
    const events: IcsEvent[] = [];

    // Ausencias APROBADAS con el mismo alcance por rol que la Agenda.
    const absences = await this.db.absence.findMany({
      where: { ...this.absences.scopeWhere(viewer), status: 'APROBADA', endDate: { gte: from }, startDate: { lte: to } },
      select: { id: true, type: true, startDate: true, endDate: true, employeeId: true, employee: { select: { fullName: true } } },
      orderBy: { startDate: 'asc' },
    });
    const seesType = user.role === 'ADMIN' || user.role === 'RRHH';
    for (const a of absences) {
      const showType = seesType || (!!user.employeeId && a.employeeId === user.employeeId);
      events.push({
        uid: `abs-${a.id}@humanx`,
        summary: `${showType ? (ABSENCE_LABEL[a.type] ?? 'Ausencia') : 'Ausencia'} — ${a.employee.fullName}`,
        startDate: a.startDate,
        endDate: a.endDate,
      });
    }

    // Alertas de contrato (misma lógica y alcance que la Agenda).
    for (const al of await this.agenda.alertas(viewer)) {
      events.push({
        uid: `alert-${al.id}@humanx`,
        summary: `${ALERT_LABEL[al.tipo] ?? 'Alerta'} — ${al.empleado.fullName}`,
        startDate: al.fecha,
      });
    }

    // Entrevistas programadas donde el usuario es el entrevistador: puesto sí, candidato NO.
    if (user.employeeId) {
      const interviews = await this.db.interview.findMany({
        where: { interviewerId: user.employeeId, status: 'PROGRAMADA', scheduledAt: { gte: from, lte: to } },
        select: { id: true, type: true, scheduledAt: true, application: { select: { job: { select: { title: true } } } } },
        orderBy: { scheduledAt: 'asc' },
      });
      for (const i of interviews) {
        const at = i.scheduledAt!;
        const hasTime = at.getUTCHours() + at.getUTCMinutes() + at.getUTCSeconds() > 0; // medianoche UTC = «solo fecha»
        const base = {
          uid: `int-${i.id}@humanx`,
          summary: `Entrevista — ${i.application.job.title}`,
          description: `Entrevista ${INTERVIEW_LABEL[i.type] ?? i.type}`,
        };
        events.push(hasTime ? { ...base, start: at } : { ...base, startDate: at });
      }
    }

    const body = buildCalendar({ name: 'humanX', events, stamp: user.calendarFeedTokenAt ?? new Date(0), refreshHours: REFRESH_HOURS });
    return { body, etag: `"${createHash('sha256').update(body).digest('hex').slice(0, 32)}"` };
  }
}
