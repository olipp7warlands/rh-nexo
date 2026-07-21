import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Mail, MapPin, Phone } from 'lucide-react';
import { Avatar, Badge, Button, Card, DeptChip, EmpStatus, Field } from '@nucleo/ui';
import { useAuth } from '../auth/AuthContext';
import {
  useEmployee,
  useEmployees,
  useHistoricoPuestos,
  useHistoricoSalarial,
  useUpdateEmployee,
  type EmployeeStatus,
} from './useEmployees';
import { EmployeeModal } from './EmployeeModal';
import { DarDeBajaModal } from './DarDeBajaModal';
import { useAnotaciones, useMarcarHecha, useReabrir, type Anotacion } from '../anotaciones/useAnotaciones';
import { AnotacionModal } from '../anotaciones/AnotacionModal';
import { viewFile } from '../../lib/api';
import { useDocuments, DOCUMENT_CATEGORY_LABEL, hasRealFile } from '../documents/useDocuments';
import { DocumentStatusBadge } from '../documents/DocumentBadges';
import { NuevoDocumentoModal } from '../documents/NuevoDocumentoModal';
import { useAbsences } from '../absences/useAbsences';
import { AbsenceStatusBadge, AbsenceTypeBadge } from '../absences/AbsenceBadges';
import { useCycles, useCycle } from '../performance/usePerformance';
import { CONTRACT_LABEL, formatDate, formatEuro, LEVEL_LABEL, seniority } from '../../lib/format';

function CategoriaDot({ color }: { color: string }) {
  return <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />;
}

function AnotacionRow({ anotacion }: { anotacion: Anotacion }) {
  const marcarHecha = useMarcarHecha();
  const reabrir = useReabrir();
  return (
    <div className="flex items-start gap-2.5 py-2.5 border-b border-[var(--line-subtle)] last:border-0">
      <button
        onClick={() => (anotacion.estado === 'PENDIENTE' ? marcarHecha.mutate(anotacion.id) : reabrir.mutate(anotacion.id))}
        title={anotacion.estado === 'PENDIENTE' ? 'Marcar hecha' : 'Reabrir'}
        className="mt-1 shrink-0"
      >
        <span
          className={`block w-3 h-3 rounded-full ${anotacion.estado === 'HECHA' ? 'bg-[var(--ink-primary)]' : 'bg-transparent border-[1.5px] border-[var(--ink-primary)]'}`}
        />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          {anotacion.categoria && <CategoriaDot color={anotacion.categoria.color} />}
          {anotacion.categoria && <span className="text-[11px] font-medium" style={{ color: anotacion.categoria.color }}>{anotacion.categoria.nombre}</span>}
          <span className="mono text-[11px] text-[var(--ink-tertiary)]">{formatDate(anotacion.fecha)}</span>
        </div>
        <p className="text-[13px] mt-0.5">{anotacion.texto}</p>
      </div>
    </div>
  );
}

const TAB_KEYS = ['Resumen', 'Información personal', 'Puesto y contrato', 'Compensación', 'Ausencias', 'Documentos', 'Desempeño'] as const;
type Tab = (typeof TAB_KEYS)[number];

const TABS: { key: Tab; hidden?: boolean }[] = [
  { key: 'Resumen' },
  { key: 'Información personal' },
  { key: 'Puesto y contrato' },
  { key: 'Compensación' },
  // Oculta a petición: Ausencias no está expuesta a este cliente (ver nav.ts, mismo criterio).
  // El contenido de la pestaña sigue definido más abajo a propósito — reversible, basta con
  // quitar `hidden: true` para que reaparezca aquí.
  { key: 'Ausencias', hidden: true },
  { key: 'Documentos' },
  { key: 'Desempeño' },
];

export function EmployeeDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'RRHH';

  const { data: emp, isLoading, error } = useEmployee(id);
  const { data: all } = useEmployees({});
  const update = useUpdateEmployee(id);
  const canSeeSalary = canManage || user?.employeeId === id;
  const { data: historicoPuestos } = useHistoricoPuestos(id, canSeeSalary);
  const { data: historicoSalarial } = useHistoricoSalarial(id, canSeeSalary);
  const { data: anotaciones } = useAnotaciones({ empleadoId: id }, canManage);
  const { data: documentos } = useDocuments(undefined, id);
  const { data: absences } = useAbsences(undefined, id);
  const { data: cycles } = useCycles();
  const { data: cycleActual } = useCycle(cycles?.[0]?.id ?? '');

  const [tab, setTab] = useState<Tab>('Resumen');
  const [editing, setEditing] = useState(false);
  const [creatingAnotacion, setCreatingAnotacion] = useState(false);
  const [dandoBaja, setDandoBaja] = useState(false);
  const [subiendoDocumento, setSubiendoDocumento] = useState(false);

  if (isLoading) {
    return <div className="max-w-[1400px] mx-auto px-10 py-10 text-[13px] text-[var(--ink-tertiary)]">Cargando ficha…</div>;
  }
  if (error || !emp) {
    return (
      <div className="max-w-[1400px] mx-auto px-10 py-10">
        <Link to="/personas" className="text-[13px] text-[var(--accent-ink)] inline-flex items-center gap-1.5 mb-4">
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
      <Link to="/personas" className="text-[13px] text-[var(--accent-ink)] inline-flex items-center gap-1.5 mb-5">
        <ArrowLeft className="w-4 h-4" /> Volver al directorio
      </Link>

      {/* Header de la ficha */}
      <div className="flex items-start justify-between gap-6 mb-7">
        <div className="flex items-start gap-5">
          <Avatar name={emp.fullName} size="xl" />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-serif text-[26px] font-medium tracking-[-0.02em] leading-tight">{emp.fullName}</h1>
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
            {emp.status !== 'BAJA' && (
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
              </select>
            )}
            <Button variant="secondary" onClick={() => setCreatingAnotacion(true)}>
              + Anotación
            </Button>
            <Button variant="primary" onClick={() => setEditing(true)}>
              Editar
            </Button>
            {emp.status !== 'BAJA' && (
              <Button
                variant="ghost"
                className="text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                onClick={() => setDandoBaja(true)}
              >
                Dar de baja
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Pestañas */}
      <div className="flex gap-1 border-b border-[var(--line)] mb-6 overflow-x-auto">
        {TABS.filter((t) => !t.hidden).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative px-3 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors ${
              tab === t.key ? 'text-[var(--ink-primary)]' : 'text-[var(--ink-tertiary)] hover:text-[var(--ink-secondary)]'
            }`}
          >
            {t.key}
            {tab === t.key && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-[var(--accent)]" />}
          </button>
        ))}
      </div>

      {tab === 'Resumen' && (
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 flex flex-col gap-5">
            <Card>
              <h3 className="font-serif text-[14px] font-medium mb-4">Información general</h3>
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
                <h3 className="font-serif text-[14px] font-medium mb-4">Equipo directo · {emp.reports.length}</h3>
                <div className="flex flex-col gap-1">
                  {emp.reports.map((r) => (
                    <Link
                      key={r.id}
                      to={`/personas/${r.id}`}
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
            {canManage && (
              <Card>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-serif text-[14px] font-medium">Anotaciones</h3>
                  <button onClick={() => setCreatingAnotacion(true)} className="text-[12px] font-medium text-[var(--accent-ink)] hover:underline">
                    + Nueva anotación
                  </button>
                </div>
                {anotaciones && anotaciones.length > 0 ? (
                  <div className="flex flex-col">
                    {anotaciones.slice(0, 5).map((a) => (
                      <AnotacionRow key={a.id} anotacion={a} />
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-[var(--ink-tertiary)]">Sin anotaciones todavía.</p>
                )}
              </Card>
            )}
          </div>
          <div className="flex flex-col gap-5">
            <Card>
              <h3 className="font-serif text-[14px] font-medium mb-1">Saldo de vacaciones</h3>
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
              <h3 className="font-serif text-[14px] font-medium mb-1">Antigüedad</h3>
              <p className="text-[15px] font-medium mt-2">{seniority(emp.startDate)}</p>
              <p className="text-[12px] text-[var(--ink-tertiary)] mt-1">Desde {formatDate(emp.startDate)}</p>
            </Card>
          </div>
        </div>
      )}

      {tab === 'Información personal' && (
        <div className="grid grid-cols-2 gap-5">
          <Card>
            <h3 className="font-serif text-[14px] font-medium mb-4">Datos personales</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              <Field label="Nombre completo" value={emp.fullName} />
              <Field label="DNI / NIE" value={emp.dni ?? '—'} mono />
              <Field label="Cumpleaños" value={emp.birthday ?? '—'} />
              <Field label="Dirección" value={emp.address ?? '—'} />
            </div>
          </Card>
          <div className="flex flex-col gap-5">
            <Card>
              <h3 className="font-serif text-[14px] font-medium mb-4">Contacto de emergencia</h3>
              <p className="text-[13px]">{emp.emergency ?? '—'}</p>
            </Card>
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <h3 className="font-serif text-[14px] font-medium">Datos bancarios</h3>
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
            <h3 className="font-serif text-[14px] font-medium mb-4">Puesto</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              <Field label="Código" value={emp.codigo ?? '—'} mono />
              <Field label="Cargo" value={emp.jobTitle} />
              <Field label="Departamento" value={emp.department?.name ?? '—'} />
              <Field label="Nivel" value={LEVEL_LABEL[emp.level] ?? emp.level} />
              <Field label="Manager" value={emp.manager?.fullName ?? '—'} />
              <Field label="Personas a cargo" value={String(emp.reports?.length ?? 0)} />
              <Field label="Sociedad" value={emp.sociedad ? `${emp.sociedad.nombre} (${emp.sociedad.pais.nombre})` : '—'} />
              <Field label="Localización" value={emp.localizacion?.nombre ?? emp.location} />
              <Field label="Modalidad" value={emp.remote ? 'Remoto' : 'Presencial'} />
              {emp.descripcionPuesto && (
                <div className="col-span-2">
                  <Field label="Descripción del puesto" value={emp.descripcionPuesto} />
                </div>
              )}
            </div>
          </Card>
          <Card>
            <h3 className="font-serif text-[14px] font-medium mb-4">Contrato</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              <Field label="Vínculo" value={emp.vinculo === 'EXTERNO' ? 'Externo' : 'Plantilla'} />
              <Field label="Tipo" value={CONTRACT_LABEL[emp.contractType] ?? emp.contractType} />
              <Field label="Fecha de alta" value={formatDate(emp.startDate)} mono />
              <Field label="Antigüedad" value={seniority(emp.startDate)} />
              <Field label="Fin de periodo de prueba" value={emp.finPeriodoPrueba ? formatDate(emp.finPeriodoPrueba) : '—'} mono />
              <Field label="Vencimiento de contrato" value={emp.vencimientoContrato ? formatDate(emp.vencimientoContrato) : '—'} mono />
            </div>
          </Card>
          <Card className="col-span-2">
            <h3 className="font-serif text-[14px] font-medium mb-4">Histórico de puestos</h3>
            {!canSeeSalary ? (
              <p className="text-[13px] text-[var(--ink-tertiary)]">
                Solo visible para RRHH/Administración y el propio empleado.
              </p>
            ) : historicoPuestos && historicoPuestos.length > 0 ? (
              <div className="flex flex-col">
                {historicoPuestos.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2.5 border-b border-[var(--line-subtle)] last:border-0">
                    <div>
                      <div className="text-[13px] font-medium">{r.titulo}</div>
                      <div className="text-[11px] text-[var(--ink-tertiary)]">
                        {r.departamento?.name ?? '—'}
                        {r.sociedad && ` · ${r.sociedad.nombre}`}
                      </div>
                    </div>
                    <div className="mono text-[12px] text-[var(--ink-secondary)] text-right">
                      {formatDate(r.fechaInicio)} — {r.fechaFin ? formatDate(r.fechaFin) : <span className="text-[var(--ink-primary)] font-medium">Actual</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-[var(--ink-tertiary)]">Sin histórico registrado.</p>
            )}
          </Card>
        </div>
      )}

      {tab === 'Compensación' && (
        <div className="grid grid-cols-3 gap-5">
          <Card className="col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-serif text-[14px] font-medium">Retribución actual</h3>
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
            <h3 className="font-serif text-[14px] font-medium mb-3">Datos bancarios</h3>
            <Field label="IBAN" value={emp.iban ?? (canManage ? '—' : 'Restringido')} mono />
          </Card>
          {canSeeSalary && (
            <Card className="col-span-3">
              <h3 className="font-serif text-[14px] font-medium mb-4">Histórico salarial</h3>
              {historicoSalarial && historicoSalarial.length > 0 ? (
                <div className="flex flex-col">
                  {historicoSalarial.map((r, i) => {
                    const anterior = historicoSalarial[i + 1];
                    const delta = anterior ? r.brutoAnual - anterior.brutoAnual : null;
                    return (
                      <div key={r.id} className="flex items-center justify-between py-2.5 border-b border-[var(--line-subtle)] last:border-0">
                        <div>
                          <div className="text-[13px] font-medium">{r.concepto}</div>
                          <div className="mono text-[11px] text-[var(--ink-tertiary)]">{formatDate(r.fecha)}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          {delta !== null && delta !== 0 && (
                            <span className={`mono text-[12px] ${delta > 0 ? 'text-[var(--ink-primary)]' : 'text-[var(--ink-secondary)]'}`}>
                              {delta > 0 ? '↑' : '↓'} {formatEuro(Math.abs(delta))}
                            </span>
                          )}
                          <span className="mono text-[14px] font-medium">{formatEuro(r.brutoAnual)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[13px] text-[var(--ink-tertiary)]">Sin histórico registrado.</p>
              )}
            </Card>
          )}
        </div>
      )}

      {tab === 'Ausencias' && (
        <div className="flex flex-col gap-5">
          <Card>
            <h3 className="font-serif text-[14px] font-medium mb-3">Saldo {balance?.year ?? new Date().getFullYear()}</h3>
            {balance ? (
              <p className="text-[13px] text-[var(--ink-secondary)]">
                {balance.total - balance.used} días disponibles · {balance.used} usados · {balance.pending} pendientes.
              </p>
            ) : (
              <p className="text-[13px] text-[var(--ink-tertiary)]">Sin saldo registrado.</p>
            )}
          </Card>
          <Card padding="p-0">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)]">
              <h3 className="font-serif text-[14px] font-medium">Historial de ausencias</h3>
              <Link to="/ausencias" className="text-[12px] font-medium text-[var(--accent-ink)] hover:underline">
                Ir a Ausencias →
              </Link>
            </div>
            {(() => {
              // El backend ya filtra por employeeId (useAbsences(undefined, id)); solo ordenar.
              const propias = [...(absences ?? [])].sort((a, b) => b.startDate.localeCompare(a.startDate));
              return propias.length > 0 ? (
                <div className="divide-y divide-[var(--line-subtle)]">
                  {propias.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex-1">
                        <div className="text-[13px] font-medium flex items-center gap-2">
                          <AbsenceTypeBadge type={a.type} />
                          <span className="text-[var(--ink-secondary)]">
                            {formatDate(a.startDate)} – {formatDate(a.endDate)}
                          </span>
                        </div>
                        {a.reason && <div className="text-[12px] text-[var(--ink-tertiary)] mt-0.5">{a.reason}</div>}
                      </div>
                      <span className="mono text-[12px] text-[var(--ink-secondary)]">{a.days}d</span>
                      <AbsenceStatusBadge status={a.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-5 py-8 text-center text-[13px] text-[var(--ink-tertiary)]">Sin ausencias registradas.</p>
              );
            })()}
          </Card>
        </div>
      )}

      {tab === 'Documentos' && (
        <Card padding="p-0">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)]">
            <h3 className="font-serif text-[14px] font-medium">Documentos de {emp.fullName}</h3>
            {canManage && (
              <Button variant="secondary" size="sm" onClick={() => setSubiendoDocumento(true)}>
                Subir documento
              </Button>
            )}
          </div>
          {documentos && documentos.length === 0 && (
            <p className="px-5 py-8 text-center text-[13px] text-[var(--ink-tertiary)]">Sin documentos todavía.</p>
          )}
          {documentos && documentos.length > 0 && (
            <div className="divide-y divide-[var(--line-subtle)]">
              {documentos.map((d) => {
                const firmadas = d.signatures.filter((s) => s.status === 'FIRMADA').length;
                const mySignature = d.signatures.find((s) => s.employeeId === user?.employeeId && s.status === 'PENDIENTE');
                return (
                  <div key={d.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium truncate">{d.name}</div>
                      <div className="text-[11px] text-[var(--ink-tertiary)]">
                        {DOCUMENT_CATEGORY_LABEL[d.category]} · {formatDate(d.createdAt)}
                        {d.signatures.length > 0 && ` · ${firmadas}/${d.signatures.length} firmas`}
                      </div>
                    </div>
                    <DocumentStatusBadge status={d.status} />
                    {hasRealFile(d) && (
                      <Button variant="secondary" size="sm" onClick={() => viewFile(`/documents/${d.id}/download`)}>
                        Descargar
                      </Button>
                    )}
                    {mySignature && (
                      <Button variant="secondary" size="sm" onClick={() => viewFile(`/documents/${d.id}/download`)}>
                        Firmar
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {tab === 'Desempeño' && (
        <div className="grid grid-cols-3 gap-5">
          <Card padding="p-0" className="col-span-2">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)]">
              <h3 className="font-serif text-[14px] font-medium">Evaluación · {cycleActual?.name ?? 'sin ciclo activo'}</h3>
              <Link to="/desempeno" className="text-[12px] font-medium text-[var(--accent-ink)] hover:underline">
                Ir a Desempeño →
              </Link>
            </div>
            {(() => {
              const review = cycleActual?.reviews.find((r) => r.employeeId === id);
              if (!review) return <p className="px-5 py-8 text-center text-[13px] text-[var(--ink-tertiary)]">Sin evaluación en el ciclo actual.</p>;
              return (
                <div className="px-5 py-4 flex items-center gap-6">
                  <div className="flex items-center gap-4 flex-1">
                    <Badge variant={review.selfDone ? 'success' : 'warning'} dot>Auto</Badge>
                    <Badge variant={review.managerDone ? 'success' : 'warning'} dot>Manager</Badge>
                    <Badge variant={review.o2oDone ? 'success' : 'warning'} dot>1:1</Badge>
                  </div>
                  <div className="mono text-[20px] font-bold">{review.rating ?? '—'}<span className="text-[13px] text-[var(--ink-tertiary)] font-medium"> / 5</span></div>
                </div>
              );
            })()}
          </Card>
          <div className="flex flex-col gap-4">
            {(cycleActual?.objectives.filter((o) => o.owner.id === id) ?? []).map((o) => (
              <Card key={o.id}>
                <div className="text-[10px] uppercase tracking-wider text-[var(--ink-tertiary)] mb-1">{o.scope}</div>
                <h4 className="font-serif text-[13px] font-medium mb-3">{o.title}</h4>
                <div className="divide-y divide-[var(--line-subtle)]">
                  {o.keyResults.map((kr) => (
                    <div key={kr.id} className="flex items-center gap-3 py-2">
                      <span className="flex-1 text-[13px]">{kr.title}</span>
                      <div className="w-20 h-2 rounded-full bg-[var(--bg-hover)] overflow-hidden">
                        <div className="h-full bg-[var(--accent)]" style={{ width: `${kr.progress}%` }} />
                      </div>
                      <span className="mono text-[12px] text-[var(--ink-tertiary)] w-9 text-right">{kr.progress}%</span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
            {cycleActual && (cycleActual.objectives.filter((o) => o.owner.id === id) ?? []).length === 0 && (
              <Card>
                <p className="text-[13px] text-[var(--ink-tertiary)]">Sin objetivos propios en este ciclo.</p>
              </Card>
            )}
          </div>
        </div>
      )}

      {editing && <EmployeeModal mode="edit" employee={emp} allEmployees={all ?? []} onClose={() => setEditing(false)} />}
      {creatingAnotacion && <AnotacionModal mode="create" presetEmpleado={emp} onClose={() => setCreatingAnotacion(false)} />}
      {dandoBaja && <DarDeBajaModal employee={emp} onClose={() => setDandoBaja(false)} />}
      {subiendoDocumento && <NuevoDocumentoModal presetOwner={emp} onClose={() => setSubiendoDocumento(false)} />}
    </div>
  );
}
