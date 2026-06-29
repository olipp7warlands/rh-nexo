import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Mail, MapPin, Phone } from 'lucide-react';
import { Avatar, Badge, Button, Card, DeptChip, EmpStatus, Field } from '@nucleo/ui';
import { useAuth } from '../auth/AuthContext';
import {
  useDeleteEmployee,
  useEmployee,
  useEmployees,
  useUpdateEmployee,
  type EmployeeStatus,
} from './useEmployees';
import { EmployeeModal } from './EmployeeModal';
import { CONTRACT_LABEL, formatDate, formatEuro, LEVEL_LABEL, seniority } from '../../lib/format';

const TABS = [
  'Resumen',
  'Información personal',
  'Puesto y contrato',
  'Compensación',
  'Ausencias',
  'Documentos',
  'Desempeño',
] as const;
type Tab = (typeof TABS)[number];

export function EmployeeDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'RRHH';

  const { data: emp, isLoading, error } = useEmployee(id);
  const { data: all } = useEmployees({});
  const update = useUpdateEmployee(id);
  const remove = useDeleteEmployee(id);

  const [tab, setTab] = useState<Tab>('Resumen');
  const [editing, setEditing] = useState(false);

  if (isLoading) {
    return <div className="max-w-[1400px] mx-auto px-10 py-10 text-[13px] text-[var(--ink-tertiary)]">Cargando ficha…</div>;
  }
  if (error || !emp) {
    return (
      <div className="max-w-[1400px] mx-auto px-10 py-10">
        <Link to="/empleados" className="text-[13px] text-[var(--accent-ink)] inline-flex items-center gap-1.5 mb-4">
          <ArrowLeft className="w-4 h-4" /> Volver al directorio
        </Link>
        <Card>
          <p className="text-[var(--danger)] text-[13px]">No se pudo cargar la ficha: {(error as Error)?.message ?? 'no encontrada'}</p>
        </Card>
      </div>
    );
  }

  const balance = emp.balances?.find((b) => b.year === new Date().getFullYear()) ?? emp.balances?.[0];

  return (
    <div className="max-w-[1400px] mx-auto px-10 py-10">
      <Link to="/empleados" className="text-[13px] text-[var(--accent-ink)] inline-flex items-center gap-1.5 mb-5">
        <ArrowLeft className="w-4 h-4" /> Volver al directorio
      </Link>

      {/* Header de la ficha */}
      <div className="flex items-start justify-between gap-6 mb-7">
        <div className="flex items-start gap-5">
          <Avatar name={emp.fullName} size="xl" />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[26px] font-bold tracking-[-0.02em] leading-tight">{emp.fullName}</h1>
              <EmpStatus status={emp.status} />
              {emp.fromRecruitment && <Badge variant="accent">Contratado vía VITAE</Badge>}
            </div>
            <div className="flex items-center gap-2 text-[14px] text-[var(--ink-secondary)] mt-1.5">
              <span>{emp.jobTitle}</span>
              {emp.department && (
                <>
                  <span className="text-[var(--ink-tertiary)]">·</span>
                  <DeptChip name={emp.department.name} color={emp.department.color} />
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-[12px] text-[var(--ink-secondary)] mt-3">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[var(--ink-tertiary)]" /> {emp.email}
              </span>
              {emp.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[var(--ink-tertiary)]" /> {emp.phone}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[var(--ink-tertiary)]" /> {emp.location}
                {emp.remote && ' · Remoto'}
              </span>
            </div>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <select
              className="h-9 px-3 bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md text-[13px] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
              value={emp.status}
              disabled={update.isPending}
              onChange={(e) => update.mutate({ status: e.target.value as EmployeeStatus })}
              aria-label="Cambiar estado"
            >
              <option value="ACTIVO">Activo</option>
              <option value="ONBOARDING">Onboarding</option>
              <option value="AUSENTE">Ausente</option>
              <option value="BAJA">Baja</option>
            </select>
            <Button variant="primary" onClick={() => setEditing(true)}>
              Editar
            </Button>
          </div>
        )}
      </div>

      {/* Pestañas */}
      <div className="flex gap-1 border-b border-[var(--line)] mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative px-3 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors ${
              tab === t ? 'text-[var(--ink-primary)]' : 'text-[var(--ink-tertiary)] hover:text-[var(--ink-secondary)]'
            }`}
          >
            {t}
            {tab === t && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-[var(--accent)]" />}
          </button>
        ))}
      </div>

      {tab === 'Resumen' && (
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 flex flex-col gap-5">
            <Card>
              <h3 className="text-[14px] font-semibold mb-4">Información general</h3>
              <div className="grid grid-cols-3 gap-x-6 gap-y-5">
                <Field label="Puesto" value={emp.jobTitle} />
                <Field label="Departamento" value={emp.department?.name ?? '—'} />
                <Field label="Manager" value={emp.manager?.fullName ?? '—'} />
                <Field label="Ubicación" value={emp.location} />
                <Field label="Fecha de alta" value={formatDate(emp.startDate)} mono />
                <Field label="Contrato" value={CONTRACT_LABEL[emp.contractType] ?? emp.contractType} />
                <Field label="Email" value={emp.email} />
                <Field label="Teléfono" value={emp.phone ?? '—'} />
                <Field label="Cumpleaños" value={emp.birthday ?? '—'} />
              </div>
            </Card>
            {emp.reports && emp.reports.length > 0 && (
              <Card>
                <h3 className="text-[14px] font-semibold mb-4">Equipo directo · {emp.reports.length}</h3>
                <div className="flex flex-col gap-1">
                  {emp.reports.map((r) => (
                    <Link
                      key={r.id}
                      to={`/empleados/${r.id}`}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-[var(--bg-subtle)]"
                    >
                      <Avatar name={r.fullName} size="sm" />
                      <div className="flex-1">
                        <div className="text-[13px] font-medium">{r.fullName}</div>
                        <div className="text-[11px] text-[var(--ink-tertiary)]">{r.jobTitle}</div>
                      </div>
                      <EmpStatus status={r.status as EmployeeStatus} />
                    </Link>
                  ))}
                </div>
              </Card>
            )}
          </div>
          <div className="flex flex-col gap-5">
            <Card>
              <h3 className="text-[14px] font-semibold mb-1">Saldo de vacaciones</h3>
              {balance ? (
                <>
                  <div className="mono text-[28px] font-bold leading-tight mt-2">
                    {balance.total - balance.used}
                    <span className="text-[14px] text-[var(--ink-tertiary)] font-medium"> / {balance.total} días</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--bg-hover)] mt-3 overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent)]"
                      style={{ width: `${Math.min(100, (balance.used / Math.max(1, balance.total)) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-[var(--ink-tertiary)] mt-2">{balance.pending} días pendientes de aprobar</p>
                </>
              ) : (
                <p className="text-[13px] text-[var(--ink-tertiary)] mt-2">Sin saldo registrado.</p>
              )}
            </Card>
            <Card>
              <h3 className="text-[14px] font-semibold mb-1">Antigüedad</h3>
              <p className="text-[15px] font-medium mt-2">{seniority(emp.startDate)}</p>
              <p className="text-[12px] text-[var(--ink-tertiary)] mt-1">Desde {formatDate(emp.startDate)}</p>
            </Card>
          </div>
        </div>
      )}

      {tab === 'Información personal' && (
        <div className="grid grid-cols-2 gap-5">
          <Card>
            <h3 className="text-[14px] font-semibold mb-4">Datos personales</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              <Field label="Nombre completo" value={emp.fullName} />
              <Field label="DNI / NIE" value={emp.dni ?? '—'} mono />
              <Field label="Cumpleaños" value={emp.birthday ?? '—'} />
              <Field label="Dirección" value={emp.address ?? '—'} />
            </div>
          </Card>
          <div className="flex flex-col gap-5">
            <Card>
              <h3 className="text-[14px] font-semibold mb-4">Contacto de emergencia</h3>
              <p className="text-[13px]">{emp.emergency ?? '—'}</p>
            </Card>
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-[14px] font-semibold">Datos bancarios</h3>
                <Badge variant="neutral">Cifrado</Badge>
              </div>
              <Field label="IBAN" value={emp.iban ?? (canManage ? '—' : 'Restringido')} mono />
              <p className="text-[11px] text-[var(--ink-tertiary)] mt-3">Visible solo para RRHH/Administración y el propio empleado.</p>
            </Card>
          </div>
        </div>
      )}

      {tab === 'Puesto y contrato' && (
        <div className="grid grid-cols-2 gap-5">
          <Card>
            <h3 className="text-[14px] font-semibold mb-4">Puesto</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              <Field label="Cargo" value={emp.jobTitle} />
              <Field label="Departamento" value={emp.department?.name ?? '—'} />
              <Field label="Nivel" value={LEVEL_LABEL[emp.level] ?? emp.level} />
              <Field label="Manager" value={emp.manager?.fullName ?? '—'} />
              <Field label="Personas a cargo" value={String(emp.reports?.length ?? 0)} />
              <Field label="Ubicación" value={`${emp.location}${emp.remote ? ' · Remoto' : ''}`} />
            </div>
          </Card>
          <Card>
            <h3 className="text-[14px] font-semibold mb-4">Contrato</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              <Field label="Tipo" value={CONTRACT_LABEL[emp.contractType] ?? emp.contractType} />
              <Field label="Fecha de alta" value={formatDate(emp.startDate)} mono />
              <Field label="Antigüedad" value={seniority(emp.startDate)} />
              <Field label="Modalidad" value={emp.remote ? 'Remoto' : 'Presencial'} />
            </div>
          </Card>
        </div>
      )}

      {tab === 'Compensación' && (
        <div className="grid grid-cols-3 gap-5">
          <Card className="col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-[14px] font-semibold">Retribución actual</h3>
              <Badge variant="warning">Confidencial</Badge>
            </div>
            {emp.salary !== null && emp.salary !== undefined ? (
              <>
                <div className="mono text-[36px] font-bold leading-none">{formatEuro(emp.salary)}</div>
                <p className="text-[12px] text-[var(--ink-tertiary)] mt-1">bruto anual</p>
              </>
            ) : (
              <p className="text-[13px] text-[var(--ink-tertiary)]">
                Solo visible para RRHH/Administración y el propio empleado.
              </p>
            )}
          </Card>
          <Card>
            <h3 className="text-[14px] font-semibold mb-3">Datos bancarios</h3>
            <Field label="IBAN" value={emp.iban ?? (canManage ? '—' : 'Restringido')} mono />
          </Card>
        </div>
      )}

      {tab === 'Ausencias' && (
        <Card>
          <h3 className="text-[14px] font-semibold mb-3">Saldo {balance?.year ?? new Date().getFullYear()}</h3>
          {balance ? (
            <p className="text-[13px] text-[var(--ink-secondary)]">
              {balance.total - balance.used} días disponibles · {balance.used} usados · {balance.pending} pendientes.
            </p>
          ) : (
            <p className="text-[13px] text-[var(--ink-tertiary)]">Sin saldo registrado.</p>
          )}
          <p className="text-[12px] text-[var(--ink-tertiary)] mt-4">
            El historial y la solicitud de ausencias se construyen en la Fase 2.
          </p>
        </Card>
      )}

      {tab === 'Documentos' && (
        <Card>
          <p className="text-[13px] text-[var(--ink-tertiary)]">La gestión documental se construye en la Fase 4.</p>
        </Card>
      )}

      {tab === 'Desempeño' && (
        <Card>
          <p className="text-[13px] text-[var(--ink-tertiary)]">Las evaluaciones y OKRs se construyen en la Fase 3.</p>
        </Card>
      )}

      {/* Baja */}
      {canManage && emp.status !== 'BAJA' && (
        <div className="mt-8 pt-6 border-t border-[var(--line)]">
          <Button
            variant="ghost"
            className="text-[var(--danger)] hover:bg-[var(--danger-soft)]"
            disabled={remove.isPending}
            onClick={() => {
              if (window.confirm(`¿Dar de baja a ${emp.fullName}? Conserva el histórico (baja lógica).`)) {
                remove.mutate();
              }
            }}
          >
            Dar de baja
          </Button>
        </div>
      )}

      {editing && <EmployeeModal mode="edit" employee={emp} allEmployees={all ?? []} onClose={() => setEditing(false)} />}
    </div>
  );
}
