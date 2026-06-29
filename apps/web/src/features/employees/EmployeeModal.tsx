import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input } from '@nucleo/ui';
import { Modal } from '../_shared/Modal';
import { useAuth } from '../auth/AuthContext';
import { useCreateEmployee, useUpdateEmployee, type Employee } from './useEmployees';
import { useDepartments } from './useDepartments';

const schema = z.object({
  fullName: z.string().min(1, 'Obligatorio'),
  email: z.string().min(1, 'Obligatorio').email('Email no válido'),
  phone: z.string().optional(),
  dni: z.string().optional(),
  birthday: z.string().optional(),
  address: z.string().optional(),
  emergency: z.string().optional(),
  jobTitle: z.string().min(1, 'Obligatorio'),
  level: z.string().min(1, 'Obligatorio'),
  location: z.string().min(1, 'Obligatorio'),
  remote: z.boolean().optional(),
  startDate: z.string().min(1, 'Obligatorio'),
  contractType: z.enum(['INDEFINIDO', 'TEMPORAL', 'PRACTICAS', 'FREELANCE']).optional(),
  status: z.enum(['ACTIVO', 'ONBOARDING', 'AUSENTE', 'BAJA']).optional(),
  departmentId: z.string().optional(),
  managerId: z.string().optional(),
  salary: z.number().int().min(0, 'No puede ser negativo').optional(),
  iban: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const TABS = ['Personal', 'Puesto y contrato', 'Compensación'] as const;
type Tab = (typeof TABS)[number];

const selectClass =
  'w-full h-9 px-3 bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md text-[13px] text-[var(--ink-primary)] hover:border-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none transition-all';

function Row({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">
        {label}
        {required && <span className="text-[var(--danger)]"> *</span>}
      </label>
      {children}
      {error && <p className="text-[12px] text-[var(--danger)] mt-1.5">{error}</p>}
    </div>
  );
}

function clean(data: FormData): Partial<Employee> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === '' || v === undefined || (typeof v === 'number' && Number.isNaN(v))) continue;
    out[k] = v;
  }
  return out as Partial<Employee>;
}

export function EmployeeModal({
  mode,
  employee,
  allEmployees,
  onClose,
}: {
  mode: 'create' | 'edit';
  employee?: Employee;
  allEmployees: Employee[];
  onClose: () => void;
}) {
  const { user } = useAuth();
  const canComp = user?.role === 'ADMIN' || user?.role === 'RRHH';
  const { data: departments } = useDepartments();
  const create = useCreateEmployee();
  const update = useUpdateEmployee(employee?.id ?? '');
  const mutation = mode === 'create' ? create : update;

  const [tab, setTab] = useState<Tab>('Personal');
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitted },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: employee
      ? {
          fullName: employee.fullName,
          email: employee.email,
          phone: employee.phone ?? '',
          dni: employee.dni ?? '',
          birthday: employee.birthday ?? '',
          address: employee.address ?? '',
          emergency: employee.emergency ?? '',
          jobTitle: employee.jobTitle,
          level: employee.level,
          location: employee.location,
          remote: employee.remote,
          startDate: employee.startDate?.slice(0, 10),
          contractType: employee.contractType,
          status: employee.status,
          departmentId: employee.departmentId ?? '',
          managerId: employee.managerId ?? '',
          salary: employee.salary ?? undefined,
          iban: employee.iban ?? '',
        }
      : { remote: false, status: 'ONBOARDING', contractType: 'INDEFINIDO' },
  });

  const onSubmit = handleSubmit(async (data) => {
    setServerError(null);
    try {
      await mutation.mutateAsync(clean(data));
      onClose();
    } catch (e) {
      setServerError((e as Error).message);
    }
  });

  // Posibles managers: cualquier empleado distinto del que se edita.
  const managers = allEmployees.filter((e) => e.id !== employee?.id);

  return (
    <Modal
      wide
      title={mode === 'create' ? 'Añadir empleado' : `Editar · ${employee?.fullName}`}
      subtitle={mode === 'create' ? 'Crea la ficha; podrás completar el resto luego.' : undefined}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button variant="primary" onClick={onSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando…' : mode === 'create' ? 'Crear empleado' : 'Guardar cambios'}
          </Button>
        </>
      }
    >
      {/* Pestañas */}
      <div className="flex gap-1 border-b border-[var(--line)] mb-5 -mt-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`relative px-3 py-2 text-[13px] font-medium transition-colors ${
              tab === t ? 'text-[var(--ink-primary)]' : 'text-[var(--ink-tertiary)] hover:text-[var(--ink-secondary)]'
            }`}
          >
            {t}
            {tab === t && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-[var(--accent)]" />}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} noValidate>
        {tab === 'Personal' && (
          <div className="grid grid-cols-2 gap-4">
            <Row label="Nombre completo" required error={errors.fullName?.message}>
              <Input autoFocus {...register('fullName')} />
            </Row>
            <Row label="Email" required error={errors.email?.message}>
              <Input type="email" {...register('email')} />
            </Row>
            <Row label="Teléfono" error={errors.phone?.message}>
              <Input {...register('phone')} />
            </Row>
            <Row label="DNI / NIE" error={errors.dni?.message}>
              <Input {...register('dni')} />
            </Row>
            <Row label="Cumpleaños" error={errors.birthday?.message}>
              <Input placeholder="p. ej. 21 ene" {...register('birthday')} />
            </Row>
            <Row label="Dirección" error={errors.address?.message}>
              <Input {...register('address')} />
            </Row>
            <div className="col-span-2">
              <Row label="Contacto de emergencia" error={errors.emergency?.message}>
                <Input placeholder="Nombre · teléfono" {...register('emergency')} />
              </Row>
            </div>
          </div>
        )}

        {tab === 'Puesto y contrato' && (
          <div className="grid grid-cols-2 gap-4">
            <Row label="Cargo" required error={errors.jobTitle?.message}>
              <Input {...register('jobTitle')} />
            </Row>
            <Row label="Nivel" required error={errors.level?.message}>
              <select className={selectClass} {...register('level')}>
                <option value="">—</option>
                <option value="exec">Dirección</option>
                <option value="lead">Lead / Manager</option>
                <option value="senior">Senior</option>
                <option value="mid">Intermedio</option>
                <option value="junior">Junior</option>
              </select>
            </Row>
            <Row label="Departamento" error={errors.departmentId?.message}>
              <select className={selectClass} {...register('departmentId')}>
                <option value="">Sin asignar</option>
                {departments?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Manager" error={errors.managerId?.message}>
              <select className={selectClass} {...register('managerId')}>
                <option value="">Sin manager</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Ubicación" required error={errors.location?.message}>
              <Input {...register('location')} />
            </Row>
            <Row label="Fecha de alta" required error={errors.startDate?.message}>
              <Input type="date" {...register('startDate')} />
            </Row>
            <Row label="Tipo de contrato" error={errors.contractType?.message}>
              <select className={selectClass} {...register('contractType')}>
                <option value="INDEFINIDO">Indefinido</option>
                <option value="TEMPORAL">Temporal</option>
                <option value="PRACTICAS">Prácticas</option>
                <option value="FREELANCE">Freelance</option>
              </select>
            </Row>
            <Row label="Estado" error={errors.status?.message}>
              <select className={selectClass} {...register('status')}>
                <option value="ACTIVO">Activo</option>
                <option value="ONBOARDING">Onboarding</option>
                <option value="AUSENTE">Ausente</option>
                <option value="BAJA">Baja</option>
              </select>
            </Row>
            <label className="col-span-2 flex items-center gap-2 text-[13px] text-[var(--ink-secondary)] mt-1">
              <input type="checkbox" {...register('remote')} className="w-4 h-4 accent-[var(--accent)]" />
              Trabaja en remoto
            </label>
          </div>
        )}

        {tab === 'Compensación' && (
          <div className="grid grid-cols-2 gap-4">
            {canComp ? (
              <>
                <Row label="Salario bruto anual (€)" error={errors.salary?.message}>
                  <Input
                    type="number"
                    min={0}
                    {...register('salary', { setValueAs: (v) => (v === '' || v === null ? undefined : Number(v)) })}
                  />
                </Row>
                <Row label="IBAN" error={errors.iban?.message}>
                  <Input {...register('iban')} />
                </Row>
              </>
            ) : (
              <p className="col-span-2 text-[13px] text-[var(--ink-tertiary)]">
                Solo RRHH y Administración pueden ver y editar la compensación.
              </p>
            )}
          </div>
        )}

        {isSubmitted && Object.keys(errors).length > 0 && (
          <p role="alert" className="text-[12px] text-[var(--danger)] mt-4">
            Revisa los campos obligatorios marcados en las pestañas.
          </p>
        )}
        {serverError && (
          <div role="alert" className="text-[12px] text-[var(--danger)] bg-[var(--danger-soft)] rounded-md px-3 py-2 mt-4">
            {serverError}
          </div>
        )}
      </form>
    </Modal>
  );
}
