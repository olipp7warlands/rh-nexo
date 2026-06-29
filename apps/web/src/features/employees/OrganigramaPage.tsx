import { Link } from 'react-router-dom';
import { Avatar, Card, PageHeader } from '@nucleo/ui';
import { useEmployees, type Employee } from './useEmployees';

function OrgCard({ emp, lead = false }: { emp: Employee; lead?: boolean }) {
  return (
    <Link to={`/empleados/${emp.id}`} className={`org-card${lead ? ' org-card-lead' : ''}`} title={emp.fullName}>
      <Avatar name={emp.fullName} size="sm" />
      <div className="min-w-0">
        <div className={`${lead ? 'text-[13px]' : 'text-[12px]'} font-semibold leading-tight truncate`}>{emp.fullName}</div>
        <div className="text-[10px] text-[var(--ink-tertiary)] truncate">{emp.jobTitle}</div>
      </div>
    </Link>
  );
}

export function OrganigramaPage() {
  const { data: employees, isLoading, error } = useEmployees({});

  const active = (employees ?? []).filter((e) => e.status !== 'BAJA');
  const ids = new Set(active.map((e) => e.id));
  const reportsOf = (managerId: string) => active.filter((e) => e.managerId === managerId);
  // Raíces: sin manager (o cuyo manager no está activo).
  const roots = active.filter((e) => !e.managerId || !ids.has(e.managerId));
  const ceo = roots[0];
  // Leads = reportes directos del CEO + cualquier otra raíz suelta.
  const leads = ceo ? [...reportsOf(ceo.id), ...roots.slice(1)] : [];

  return (
    <div className="max-w-[1400px] mx-auto px-10 py-10">
      <PageHeader eyebrow="Principal" title="Organigrama" subtitle="Estructura del grupo, generada desde la relación manager/reportes." />

      {error && (
        <Card>
          <p className="text-[var(--danger)] text-[13px]">No se pudo cargar: {(error as Error).message}</p>
        </Card>
      )}
      {isLoading && <Card><p className="text-[var(--ink-tertiary)] text-[13px]">Cargando organigrama…</p></Card>}

      {employees && !ceo && (
        <Card><p className="text-[13px] text-[var(--ink-tertiary)]">No hay una raíz clara en la jerarquía.</p></Card>
      )}

      {ceo && (
        <Card padding="p-8">
          <div className="overflow-x-auto">
            <div className="org-root">
              <OrgCard emp={ceo} lead />
              <div className="org-bus">
                {leads.map((lead) => {
                  const reports = reportsOf(lead.id);
                  return (
                    <div className="org-col" key={lead.id}>
                      <OrgCard emp={lead} lead />
                      {reports.length > 0 && (
                        <div className="org-reports">
                          {reports.map((r) => (
                            <OrgCard key={r.id} emp={r} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
