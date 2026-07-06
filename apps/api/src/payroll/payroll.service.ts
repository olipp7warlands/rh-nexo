import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { AddItemDto } from './payroll.dto';

const irpfRate = (a: number) => (a >= 80000 ? 0.3 : a >= 60000 ? 0.26 : a >= 45000 ? 0.22 : a >= 30000 ? 0.18 : 0.14);
const euro = (n: number) => `${n.toLocaleString('es-ES')} €`;

@Injectable()
export class PayrollService {
  constructor(private readonly db: PrismaService) {}

  private calc(annual: number, extras: number) {
    const gross = Math.round(annual / 12) + extras;
    const irpf = Math.round(gross * irpfRate(annual));
    const ss = Math.round(gross * 0.0635);
    return { gross, irpf, ss, net: gross - irpf - ss };
  }

  runs() {
    return this.db.payrollRun.findMany({ include: { _count: { select: { payslips: true } } }, orderBy: { period: 'desc' } });
  }

  async run(id: string) {
    const run = await this.db.payrollRun.findUnique({
      where: { id },
      include: {
        payslips: { include: { employee: { select: { id: true, fullName: true, jobTitle: true, iban: true } } }, orderBy: { employee: { fullName: 'asc' } } },
        items: { include: { employee: { select: { id: true, fullName: true } } } },
      },
    });
    if (!run) throw new NotFoundException('Nómina no encontrada');
    return run;
  }

  async generate(period: string, viewer: AuthUser) {
    if (await this.db.payrollRun.findUnique({ where: { period } })) {
      throw new BadRequestException('Ya existe una nómina para ese periodo.');
    }
    const employees = await this.db.employee.findMany({ where: { status: { not: 'BAJA' }, salary: { not: null } } });
    const run = await this.db.payrollRun.create({ data: { period } });
    let totalGross = 0;
    for (const e of employees) {
      const p = this.calc(e.salary ?? 0, 0);
      totalGross += p.gross;
      await this.db.payslip.create({ data: { runId: run.id, employeeId: e.id, ...p } });
    }
    await this.db.payrollRun.update({ where: { id: run.id }, data: { totalGross, totalCost: Math.round(totalGross * 1.3) } });
    await this.audit(viewer.id, 'CREATE', run.id, null, { period, payslips: employees.length });
    return this.run(run.id);
  }

  async addItem(runId: string, dto: AddItemDto, viewer: AuthUser) {
    const run = await this.db.payrollRun.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException('Nómina no encontrada');
    if (run.status !== 'BORRADOR') throw new BadRequestException('La nómina ya está procesada; no admite cambios.');

    await this.db.payrollItem.create({ data: { runId, employeeId: dto.employeeId, type: dto.type, concept: dto.concept, amount: dto.amount } });
    await this.recomputePayslip(runId, dto.employeeId);
    await this.recomputeTotals(runId);
    await this.audit(viewer.id, 'UPDATE', runId, null, { addItem: dto });
    return this.run(runId);
  }

  private async recomputePayslip(runId: string, employeeId: string) {
    const emp = await this.db.employee.findUnique({ where: { id: employeeId } });
    const items = await this.db.payrollItem.findMany({ where: { runId, employeeId } });
    const extras = items.reduce((s, i) => s + i.amount, 0);
    const p = this.calc(emp?.salary ?? 0, extras);
    await this.db.payslip.update({ where: { runId_employeeId: { runId, employeeId } }, data: p });
  }

  private async recomputeTotals(runId: string) {
    const agg = await this.db.payslip.aggregate({ _sum: { gross: true }, where: { runId } });
    const totalGross = agg._sum.gross ?? 0;
    await this.db.payrollRun.update({ where: { id: runId }, data: { totalGross, totalCost: Math.round(totalGross * 1.3) } });
  }

  async process(runId: string, viewer: AuthUser) {
    const run = await this.db.payrollRun.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException('Nómina no encontrada');
    if (run.status !== 'BORRADOR') throw new BadRequestException('La nómina ya está procesada.');

    const payslips = await this.db.payslip.findMany({ where: { runId } });
    for (const ps of payslips) {
      await this.db.payslip.update({ where: { id: ps.id }, data: { status: 'EMITIDA', pdfUrl: `/api/payroll/payslips/${ps.id}/document` } });
    }
    await this.db.payrollRun.update({ where: { id: runId }, data: { status: 'PROCESADA', processedAt: new Date() } });
    await this.audit(viewer.id, 'PROCESS', runId, { status: 'BORRADOR' }, { status: 'PROCESADA', payslips: payslips.length });
    return this.run(runId);
  }

  mine(viewer: AuthUser) {
    if (!viewer.employeeId) return [];
    return this.db.payslip.findMany({
      where: { employeeId: viewer.employeeId },
      include: { run: { select: { period: true, status: true } } },
      orderBy: { run: { period: 'desc' } },
    });
  }

  async payslipDocument(id: string, viewer: AuthUser) {
    const ps = await this.db.payslip.findUnique({
      where: { id },
      include: { employee: { select: { id: true, fullName: true, jobTitle: true, dni: true } }, run: true },
    });
    if (!ps) throw new NotFoundException('Nómina no encontrada');
    if (!(viewer.role === 'ADMIN' || viewer.role === 'RRHH' || viewer.employeeId === ps.employeeId)) {
      throw new ForbiddenException('No autorizado para ver esta nómina.');
    }
    return this.renderHtml(ps);
  }

  async exportCsv(runId: string): Promise<string> {
    const run = await this.run(runId);
    const header = ['Empleado', 'IBAN', 'Bruto', 'IRPF', 'SS', 'Neto'];
    const lines = run.payslips.map((p) =>
      [p.employee.fullName, p.employee.iban ?? '', String(p.gross), String(p.irpf), String(p.ss), String(p.net)].join(';'),
    );
    return [`# Nómina ${run.period} — transferencias`, header.join(';'), ...lines].join('\n');
  }

  private renderHtml(ps: {
    gross: number; irpf: number; ss: number; net: number; status: string;
    employee: { fullName: string; jobTitle: string; dni: string | null };
    run: { period: string };
  }) {
    const row = (k: string, v: string, strong = false) =>
      `<tr><td>${k}</td><td style="text-align:right;font-family:monospace${strong ? ';font-weight:700' : ''}">${v}</td></tr>`;
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Nómina ${ps.run.period} · ${ps.employee.fullName}</title>
<style>body{font-family:Inter,system-ui,sans-serif;color:#0F1419;max-width:640px;margin:40px auto;padding:0 24px}
h1{font-size:20px;margin:0} .muted{color:#6B7280;font-size:13px} table{width:100%;border-collapse:collapse;margin-top:24px}
td{padding:10px 0;border-bottom:1px solid #E5E7EB;font-size:14px} .net td{border-top:2px solid #0F1419;border-bottom:none;font-size:16px}
.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0F1419;padding-bottom:16px}</style></head>
<body onload="window.print&&0">
<div class="head"><div><h1>Nexo · Recibo de nómina</h1><div class="muted">Periodo ${ps.run.period} · ${ps.status}</div></div>
<div style="text-align:right"><strong>${ps.employee.fullName}</strong><div class="muted">${ps.employee.jobTitle}<br>DNI ${ps.employee.dni ?? '—'}</div></div></div>
<table>
${row('Salario bruto', euro(ps.gross))}
${row('Retención IRPF', '− ' + euro(ps.irpf))}
${row('Seguridad Social', '− ' + euro(ps.ss))}
<tr class="net">${`<td><strong>Líquido a percibir</strong></td><td style="text-align:right;font-family:monospace;font-weight:700">${euro(ps.net)}</td>`}</tr>
</table>
<p class="muted" style="margin-top:32px">Documento generado por Nexo. Recibo simplificado (no sustituye al recibo oficial).</p>
</body></html>`;
  }

  private audit(actorId: string, action: string, entityId: string, before: unknown, after: unknown) {
    return this.db.auditLog.create({ data: { actorId, action, entity: 'PayrollRun', entityId, before: before as object, after: after as object } });
  }
}
