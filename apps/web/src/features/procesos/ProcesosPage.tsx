import { useEffect, useState } from 'react';
import { Avatar, Badge, Card, DeptChip, PageHeader } from '@nucleo/ui';
import { useAuth } from '../auth/AuthContext';
import { formatDate } from '../../lib/format';
import {
  ESTADO_PROCESO_LABEL,
  ESTADO_TAREA_LABEL,
  useProceso,
  useProcesos,
  useUpdateProcesoEstado,
  useUpdateTareaEstado,
  type EstadoProceso,
  type EstadoTarea,
  type TipoProceso,
} from './useProcesos';
import { IniciarProcesoModal } from './IniciarProcesoModal';
import { PlantillaEditorModal } from './PlantillaEditorModal';

const selectClass =
  'h-7 px-2 bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md text-[11px] text-[var(--ink-primary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none';

const ESTADO_PROCESO_VARIANT: Record<EstadoProceso, 'success' | 'info' | 'warning' | 'neutral' | 'danger'> = {
  NO_INICIADO: 'neutral',
  EN_CURSO: 'info',
  COMPLETADO: 'success',
  CANCELADO: 'danger',
};

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div>
      <div className="h-2 rounded-full bg-[var(--bg-hover)] overflow-hidden">
        <div className="h-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-[var(--ink-tertiary)] mt-1">
        {done}/{total} tareas · {pct}%
      </p>
    </div>
  );
}

function ProcesoDetailPanel({ id, canManage }: { id: string; canManage: boolean }) {
  const { data: detail } = useProceso(id);
  const toggle = useUpdateTareaEstado();
  const updateEstado = useUpdateProcesoEstado();

  if (!detail) return null;

  // Las fases se agrupan en el orden de aparición de las tareas (que ya vienen ordenadas por
  // creación, reflejando el `orden` de la plantilla en el momento en que se copiaron).
  const fases = [...new Set(detail.tareas.map((t) => t.fase))];

  return (
    <Card>
      <div className="flex items-center gap-3 mb-5">
        <Avatar name={detail.employee.fullName} size="md" />
        <div className="flex-1">
          <h3 className="font-serif text-[15px] font-medium">{detail.employee.fullName}</h3>
          <div className="flex items-center gap-2 text-[12px] text-[var(--ink-secondary)]">
            {detail.employee.jobTitle}
            {detail.employee.department && <DeptChip name={detail.employee.department.name} color={detail.employee.department.color} />}
          </div>
        </div>
        {detail.buddy && (
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-[var(--ink-tertiary)]">Buddy</div>
            <div className="text-[12px] font-medium">{detail.buddy.fullName}</div>
          </div>
        )}
        {canManage ? (
          <select
            className={selectClass}
            value={detail.estado}
            onChange={(e) => updateEstado.mutate({ id: detail.id, estado: e.target.value as EstadoProceso })}
            disabled={updateEstado.isPending}
            aria-label="Estado del proceso"
          >
            {Object.entries(ESTADO_PROCESO_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        ) : (
          <Badge variant={ESTADO_PROCESO_VARIANT[detail.estado]} dot>
            {ESTADO_PROCESO_LABEL[detail.estado]}
          </Badge>
        )}
      </div>

      {fases.map((fase) => {
        const tareas = detail.tareas.filter((t) => t.fase === fase);
        return (
          <div key={fase} className="mb-5 last:mb-0">
            <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--ink-tertiary)] mb-2">{fase}</div>
            <div className="flex flex-col gap-1">
              {tareas.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[var(--bg-subtle)]">
                  <input
                    type="checkbox"
                    checked={t.estado === 'COMPLETADA'}
                    disabled={!canManage || toggle.isPending}
                    onChange={(e) => toggle.mutate({ tareaId: t.id, estado: e.target.checked ? 'COMPLETADA' : 'PENDIENTE' })}
                    className="w-4 h-4 accent-[var(--accent)]"
                    aria-label={t.label}
                  />
                  <span className={`flex-1 text-[13px] ${t.estado === 'COMPLETADA' ? 'line-through text-[var(--ink-tertiary)]' : ''}`}>{t.label}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--bg-hover)] text-[var(--ink-secondary)]">{t.responsable}</span>
                  {canManage ? (
                    <select
                      className={selectClass}
                      value={t.estado}
                      onChange={(e) => toggle.mutate({ tareaId: t.id, estado: e.target.value as EstadoTarea })}
                      disabled={toggle.isPending}
                      aria-label={`Estado de ${t.label}`}
                    >
                      {Object.entries(ESTADO_TAREA_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-[11px] text-[var(--ink-tertiary)] w-[90px] text-right">{ESTADO_TAREA_LABEL[t.estado]}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </Card>
  );
}

function ProcesosTab({ tipo, canManage }: { tipo: TipoProceso; canManage: boolean }) {
  const { data: procesos, isLoading } = useProcesos(tipo);
  const [selected, setSelected] = useState<string>('');

  useEffect(() => {
    setSelected('');
  }, [tipo]);

  useEffect(() => {
    const first = procesos?.[0];
    if (!selected && first) setSelected(first.id);
  }, [procesos, selected]);

  if (isLoading) return <Card><p className="text-[13px] text-[var(--ink-tertiary)]">Cargando…</p></Card>;
  if (procesos && procesos.length === 0) {
    return (
      <Card>
        <p className="text-[13px] text-[var(--ink-tertiary)]">
          No hay procesos de {tipo === 'ONBOARDING' ? 'onboarding' : 'offboarding'} activos.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-5">
      <div className="flex flex-col gap-3">
        {procesos?.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelected(p.id)}
            className={`text-left rounded-xl border p-4 transition-colors ${
              selected === p.id ? 'border-[var(--accent)] bg-[var(--accent-soft)]/40' : 'border-[var(--line)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)]'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <Avatar name={p.employee.fullName} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold truncate">{p.employee.fullName}</div>
                <div className="text-[11px] text-[var(--ink-tertiary)] truncate">{p.employee.jobTitle}</div>
              </div>
              <Badge variant={ESTADO_PROCESO_VARIANT[p.estado]} dot>
                {ESTADO_PROCESO_LABEL[p.estado]}
              </Badge>
            </div>
            <ProgressBar done={p.completadas} total={p.total} />
            {p.fechaObjetivo && (
              <p className="text-[11px] text-[var(--ink-tertiary)] mt-1.5">Objetivo: {formatDate(p.fechaObjetivo)}</p>
            )}
          </button>
        ))}
      </div>

      <div className="col-span-2">{selected && <ProcesoDetailPanel id={selected} canManage={canManage} />}</div>
    </div>
  );
}

export function ProcesosPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'RRHH' || user?.role === 'MANAGER';
  const canAdmin = user?.role === 'ADMIN' || user?.role === 'RRHH';

  const [tab, setTab] = useState<TipoProceso>('ONBOARDING');
  const [iniciando, setIniciando] = useState(false);
  const [editandoPlantilla, setEditandoPlantilla] = useState(false);

  return (
    <div className="max-w-[1400px] mx-auto px-10 py-10">
      <PageHeader
        eyebrow="Talento"
        title="Procesos"
        subtitle="Onboarding y offboarding: checklist por fases y estado."
        actions={
          canAdmin ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditandoPlantilla(true)}
                className="text-[12px] font-medium text-[var(--ink-secondary)] hover:underline"
              >
                Editar plantilla
              </button>
              <button
                onClick={() => setIniciando(true)}
                className="h-9 px-4 rounded-md text-[13px] font-medium bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
              >
                + Iniciar
              </button>
            </div>
          ) : undefined
        }
      />

      <div className="flex items-center gap-1 mb-6 border-b border-[var(--line)]">
        {(['ONBOARDING', 'OFFBOARDING'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-[var(--accent)] text-[var(--ink-primary)]' : 'border-transparent text-[var(--ink-tertiary)] hover:text-[var(--ink-secondary)]'
            }`}
          >
            {t === 'ONBOARDING' ? 'Onboarding' : 'Offboarding'}
          </button>
        ))}
      </div>

      <ProcesosTab tipo={tab} canManage={canManage} />

      {iniciando && <IniciarProcesoModal tipo={tab} onClose={() => setIniciando(false)} />}
      {editandoPlantilla && <PlantillaEditorModal tipo={tab} onClose={() => setEditandoPlantilla(false)} />}
    </div>
  );
}
