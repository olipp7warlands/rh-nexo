import { useState, type ReactNode } from 'react';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input } from '@nucleo/ui';
import { Modal } from '../_shared/Modal';
import { useAuth } from '../auth/AuthContext';
import { useCreateEmployee, useUpdateEmployee, type Employee } from './useEmployees';
import { useDepartments, useCreateDepartment } from './useDepartments';
import {
  usePaises,
  useSociedades,
  useCreateSociedad,
  useLocalizaciones,
  useCreateLocalizacion,
  useTiposContrato,
  useCreateTipoContrato,
  useJornadas,
  useCreateJornada,
  useProyectos,
  useCreateProyecto,
  useRelacionesEmergencia,
  useCreateRelacionEmergencia,
  useIdiomas,
  useCreateIdioma,
} from '../estructura/useEstructura';
import { NACIONALIDAD_LABEL, SITUACION_IRPF_LABEL } from './listasFijas';

// Adaptador: Departamento crea con { name, color } (no { nombre }, y exige un color). La
// creación rápida desde este formulario solo pide nombre — mismo color por defecto que usa
// DepartmentModal.tsx — para que encaje en el mismo componente genérico que el resto de
// catálogos (todos { nombre } → { id, nombre }).
function useCreateDepartmentAsCatalog() {
  const create = useCreateDepartment();
  return {
    mutateAsync: (data: { nombre: string }) => create.mutateAsync({ name: data.nombre, color: '#0F1419' }),
    isPending: create.isPending,
  };
}

const schema = z.object({
  fullName: z.string().min(1, 'Obligatorio'),
  email: z.string().min(1, 'Obligatorio').email('Email no válido'),
  phone: z.string().optional(),
  dni: z.string().optional(),
  address: z.string().optional(),
  jobTitle: z.string().min(1, 'Obligatorio'),
  level: z.string().min(1, 'Obligatorio'),
  remote: z.boolean().optional(),
  startDate: z.string().min(1, 'Obligatorio'),
  status: z.enum(['ACTIVO', 'ONBOARDING', 'AUSENTE', 'BAJA']).optional(),
  departmentId: z.string().optional(),
  managerId: z.string().optional(),
  salary: z.number().int().min(0, 'No puede ser negativo').optional(),
  codigo: z.string().optional(),
  vinculo: z.enum(['PLANTILLA', 'EXTERNO']).optional(),
  sociedadId: z.string().optional(),
  localizacionId: z.string().min(1, 'Obligatorio'),
  finPeriodoPrueba: z.string().optional(),
  vencimientoContrato: z.string().optional(),
  descripcionPuesto: z.string().optional(),
  // humanX Tanda 2 — bloque 3 "Datos laborales" (Información profesional)
  tipoContratoId: z.string().min(1, 'Obligatorio'),
  jornadaId: z.string().optional(),
  horario: z.string().optional(),
  proyectoId: z.string().optional(),
  // humanX Tanda 2 — bloque 1 "Datos personales"
  fechaNacimiento: z.string().optional(),
  nacionalidad: z.string().optional(),
  // humanX Tanda 2 — bloque 2 "Contacto de emergencia"
  contactoEmergenciaNombre: z.string().optional(),
  contactoEmergenciaRelacionId: z.string().optional(),
  contactoEmergenciaTelefono: z.string().optional(),
  // humanX Tanda 2 — bloque 4 "Datos administrativos" (ultra-sensible)
  numSeguridadSocial: z.string().optional(),
  iban: z.string().optional(),
  situacionIRPF: z.string().optional(),
  // humanX Tanda 2 — bloque 5 "Formación"
  titulacion: z.string().optional(),
  idiomaIds: z.array(z.string()).optional(),
  certificaciones: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const TABS = ['Personal', 'Información profesional'] as const;
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

// Desplegable de catálogo con creación al vuelo ("+ Nueva"), igual que la Categoría de
// AnotacionModal.tsx: alterna entre el <select> normal y una mini-fila de creación (nombre +
// Crear + ✕), y autoselecciona lo creado vía `onCreated` (setValue del formulario padre).
// Reutilizable para todo catálogo cuyo alta solo pida `{ nombre }` — Sociedad (pide también
// país) e Idiomas (checkboxes, no <select>) se gestionan aparte, fuera de este componente.
function CatalogSelectField({
  label,
  required,
  error,
  registerReturn,
  options,
  emptyLabel,
  canCreate,
  useCreateHook,
  onCreated,
  onError,
}: {
  label: string;
  required?: boolean;
  error?: string;
  registerReturn: UseFormRegisterReturn;
  options: { id: string; label: string }[];
  emptyLabel: string;
  canCreate: boolean;
  useCreateHook: () => { mutateAsync: (data: { nombre: string }) => Promise<{ id: string }>; isPending: boolean };
  onCreated: (id: string) => void;
  onError: (message: string) => void;
}) {
  const create = useCreateHook();
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const created = await create.mutateAsync({ nombre: newName.trim() });
      onCreated(created.id);
      setCreatingNew(false);
      setNewName('');
    } catch (e) {
      onError((e as Error).message);
    }
  };

  return (
    <Row label={label} required={required} error={error}>
      {!creatingNew ? (
        <div className="flex items-center gap-2">
          <select className={selectClass} {...registerReturn}>
            <option value="">{emptyLabel}</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          {canCreate && (
            <Button variant="secondary" type="button" size="sm" onClick={() => setCreatingNew(true)}>
              + Nueva
            </Button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Input autoFocus placeholder="Nombre" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button variant="secondary" type="button" size="sm" onClick={handleCreate} disabled={create.isPending}>
            Crear
          </Button>
          <Button variant="ghost" type="button" size="sm" onClick={() => setCreatingNew(false)}>
            ✕
          </Button>
        </div>
      )}
    </Row>
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
  const { data: paises } = usePaises();
  const { data: sociedades } = useSociedades();
  const { data: localizaciones } = useLocalizaciones();
  const { data: tiposContrato } = useTiposContrato();
  const { data: jornadas } = useJornadas();
  const { data: proyectos } = useProyectos();
  const { data: relacionesEmergencia } = useRelacionesEmergencia();
  const { data: idiomas } = useIdiomas();
  const create = useCreateEmployee();
  const update = useUpdateEmployee(employee?.id ?? '');
  const mutation = mode === 'create' ? create : update;
  const createSociedad = useCreateSociedad();
  const createIdioma = useCreateIdioma();

  const [tab, setTab] = useState<Tab>('Personal');
  const [serverError, setServerError] = useState<string | null>(null);
  const [creatingSociedad, setCreatingSociedad] = useState(false);
  const [newSociedadNombre, setNewSociedadNombre] = useState('');
  const [newSociedadPaisId, setNewSociedadPaisId] = useState('');
  const [creatingIdioma, setCreatingIdioma] = useState(false);
  const [newIdiomaNombre, setNewIdiomaNombre] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitted },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: employee
      ? {
          fullName: employee.fullName,
          email: employee.email,
          phone: employee.phone ?? '',
          dni: employee.dni ?? '',
          address: employee.address ?? '',
          jobTitle: employee.jobTitle,
          level: employee.level,
          remote: employee.remote,
          startDate: employee.startDate?.slice(0, 10),
          status: employee.status,
          departmentId: employee.departmentId ?? '',
          managerId: employee.managerId ?? '',
          salary: employee.salary ?? undefined,
          codigo: employee.codigo ?? '',
          vinculo: employee.vinculo,
          sociedadId: employee.sociedadId ?? '',
          localizacionId: employee.localizacionId,
          finPeriodoPrueba: employee.finPeriodoPrueba?.slice(0, 10) ?? '',
          vencimientoContrato: employee.vencimientoContrato?.slice(0, 10) ?? '',
          descripcionPuesto: employee.descripcionPuesto ?? '',
          tipoContratoId: employee.tipoContratoId,
          jornadaId: employee.jornadaId ?? '',
          horario: employee.horario ?? '',
          proyectoId: employee.proyectoId ?? '',
          fechaNacimiento: employee.fechaNacimiento?.slice(0, 10) ?? '',
          nacionalidad: employee.nacionalidad ?? '',
          contactoEmergenciaNombre: employee.contactoEmergenciaNombre ?? '',
          contactoEmergenciaRelacionId: employee.contactoEmergenciaRelacionId ?? '',
          contactoEmergenciaTelefono: employee.contactoEmergenciaTelefono ?? '',
          numSeguridadSocial: employee.numSeguridadSocial ?? '',
          iban: employee.iban ?? '',
          situacionIRPF: employee.situacionIRPF ?? '',
          titulacion: employee.titulacion ?? '',
          idiomaIds: employee.idiomas.map((i) => i.id),
          certificaciones: employee.certificaciones ?? '',
        }
      : { remote: false, status: 'ONBOARDING', vinculo: 'PLANTILLA' },
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

  // Sociedad es el único de los 8 catálogos cuya alta pide un segundo campo obligatorio
  // (país) — no encaja en CatalogSelectField, que asume creación con solo { nombre }.
  const onCreateSociedad = async () => {
    if (!newSociedadNombre.trim() || !newSociedadPaisId) return;
    try {
      const s = await createSociedad.mutateAsync({ nombre: newSociedadNombre.trim(), paisId: newSociedadPaisId });
      setValue('sociedadId', s.id);
      setCreatingSociedad(false);
      setNewSociedadNombre('');
      setNewSociedadPaisId('');
    } catch (e) {
      setServerError((e as Error).message);
    }
  };

  // Idiomas es checkboxes (selección múltiple), no un <select> — se añade el id creado al
  // array existente en vez de reemplazar un único valor.
  const onCreateIdioma = async () => {
    if (!newIdiomaNombre.trim()) return;
    try {
      const i = await createIdioma.mutateAsync({ nombre: newIdiomaNombre.trim() });
      setValue('idiomaIds', [...(getValues('idiomaIds') ?? []), i.id]);
      setCreatingIdioma(false);
      setNewIdiomaNombre('');
    } catch (e) {
      setServerError((e as Error).message);
    }
  };

  // Posibles managers: cualquier empleado distinto del que se edita.
  const managers = allEmployees.filter((e) => e.id !== employee?.id);

  // Los <select> de catálogo son inputs no controlados (register de RHF fija `.value` una sola
  // vez, al montar): si sus <option> llegan async DESPUÉS de ese montaje (catálogos nuevos de
  // Tanda 2, sin caché previa como sociedades/localizaciones), el valor guardado no se refleja
  // visualmente aunque sí viaje correcto en el submit — confuso para quien edita. Se espera a
  // que todos los catálogos estén cargados antes de montar el formulario.
  const catalogsReady =
    departments && sociedades && localizaciones && tiposContrato && jornadas && proyectos && relacionesEmergencia && idiomas;
  if (!catalogsReady) {
    return (
      <Modal title={mode === 'create' ? 'Añadir empleado' : `Editar · ${employee?.fullName}`} onClose={onClose}>
        <p className="text-[13px] text-[var(--ink-tertiary)] text-center py-8">Cargando…</p>
      </Modal>
    );
  }

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
          <div className="flex flex-col gap-6">
            {/* Bloque 1 — Datos personales */}
            <div>
              <h4 className="text-[11px] uppercase tracking-wider font-medium text-[var(--ink-tertiary)] mb-3">Datos personales</h4>
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
                <Row label="Fecha de nacimiento" error={errors.fechaNacimiento?.message}>
                  <Input type="date" {...register('fechaNacimiento')} />
                </Row>
                <Row label="Nacionalidad" error={errors.nacionalidad?.message}>
                  <select className={selectClass} {...register('nacionalidad')}>
                    <option value="">Sin especificar</option>
                    {Object.entries(NACIONALIDAD_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </Row>
                <div className="col-span-2">
                  <Row label="Dirección" error={errors.address?.message}>
                    <Input {...register('address')} />
                  </Row>
                </div>
              </div>
            </div>

            {/* Bloque 2 — Contacto de emergencia */}
            <div>
              <h4 className="text-[11px] uppercase tracking-wider font-medium text-[var(--ink-tertiary)] mb-3">Contacto de emergencia</h4>
              <div className="grid grid-cols-2 gap-4">
                <Row label="Nombre" error={errors.contactoEmergenciaNombre?.message}>
                  <Input {...register('contactoEmergenciaNombre')} />
                </Row>
                <CatalogSelectField
                  label="Relación"
                  error={errors.contactoEmergenciaRelacionId?.message}
                  registerReturn={register('contactoEmergenciaRelacionId')}
                  options={(relacionesEmergencia ?? []).map((r) => ({ id: r.id, label: r.nombre }))}
                  emptyLabel="Sin especificar"
                  canCreate={canComp}
                  useCreateHook={useCreateRelacionEmergencia}
                  onCreated={(id) => setValue('contactoEmergenciaRelacionId', id)}
                  onError={setServerError}
                />
                <Row label="Teléfono" error={errors.contactoEmergenciaTelefono?.message}>
                  <Input {...register('contactoEmergenciaTelefono')} />
                </Row>
              </div>
            </div>

            {/* Bloque 4 — Datos administrativos (ultra-sensible: ADMIN/RRHH, sin excepción de
                propio empleado, ver EmployeesService.maskAdminOnly) */}
            <div>
              <h4 className="text-[11px] uppercase tracking-wider font-medium text-[var(--ink-tertiary)] mb-3">Datos administrativos</h4>
              {canComp ? (
                <div className="grid grid-cols-2 gap-4">
                  <Row label="Nº Seguridad Social" error={errors.numSeguridadSocial?.message}>
                    <Input {...register('numSeguridadSocial')} />
                  </Row>
                  <Row label="IBAN" error={errors.iban?.message}>
                    <Input {...register('iban')} />
                  </Row>
                  <Row label="Situación IRPF" error={errors.situacionIRPF?.message}>
                    <select className={selectClass} {...register('situacionIRPF')}>
                      <option value="">Sin especificar</option>
                      {Object.entries(SITUACION_IRPF_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </Row>
                </div>
              ) : (
                <p className="text-[13px] text-[var(--ink-tertiary)]">Solo RRHH y Administración pueden ver y editar estos datos.</p>
              )}
            </div>

            {/* Bloque 5 — Formación */}
            <div>
              <h4 className="text-[11px] uppercase tracking-wider font-medium text-[var(--ink-tertiary)] mb-3">Formación</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Row label="Titulación" error={errors.titulacion?.message}>
                    <Input {...register('titulacion')} />
                  </Row>
                </div>
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[12px] font-medium text-[var(--ink-secondary)]">Idiomas</label>
                    {canComp && !creatingIdioma && (
                      <button
                        type="button"
                        className="text-[12px] font-medium text-[var(--accent-ink)] hover:underline"
                        onClick={() => setCreatingIdioma(true)}
                      >
                        + Nuevo idioma
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {idiomas?.map((i) => (
                      <label key={i.id} className="inline-flex items-center gap-1.5 text-[13px]">
                        <input type="checkbox" value={i.id} className="w-4 h-4 accent-[var(--accent)]" {...register('idiomaIds')} />
                        {i.nombre}
                      </label>
                    ))}
                  </div>
                  {creatingIdioma && (
                    <div className="flex items-center gap-2 mt-2">
                      <Input
                        autoFocus
                        placeholder="Nombre del idioma"
                        value={newIdiomaNombre}
                        onChange={(e) => setNewIdiomaNombre(e.target.value)}
                      />
                      <Button variant="secondary" type="button" size="sm" onClick={onCreateIdioma} disabled={createIdioma.isPending}>
                        Crear
                      </Button>
                      <Button variant="ghost" type="button" size="sm" onClick={() => setCreatingIdioma(false)}>
                        ✕
                      </Button>
                    </div>
                  )}
                </div>
                <div className="col-span-2">
                  <Row label="Certificaciones" error={errors.certificaciones?.message}>
                    <textarea
                      rows={2}
                      className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md text-[13px] text-[var(--ink-primary)] hover:border-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none transition-all resize-y"
                      {...register('certificaciones')}
                    />
                  </Row>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'Información profesional' && (
          <div className="grid grid-cols-2 gap-4">
            <Row label="Código" error={errors.codigo?.message}>
              <Input placeholder="p. ej. EMP-0018" {...register('codigo')} />
            </Row>
            <Row label="Vínculo" error={errors.vinculo?.message}>
              <select className={selectClass} {...register('vinculo')}>
                <option value="PLANTILLA">Plantilla interna</option>
                <option value="EXTERNO">Colaboradores externos</option>
              </select>
            </Row>
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
            <div className="col-span-2">
              <Row label="Descripción del puesto" error={errors.descripcionPuesto?.message}>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md text-[13px] text-[var(--ink-primary)] hover:border-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none transition-all resize-y"
                  {...register('descripcionPuesto')}
                />
              </Row>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Sociedad</label>
              {!creatingSociedad ? (
                <div className="flex items-center gap-2">
                  <select className={selectClass} {...register('sociedadId')}>
                    <option value="">Sin asignar</option>
                    {sociedades?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre} ({s.pais.nombre})
                      </option>
                    ))}
                  </select>
                  {canComp && (
                    <Button variant="secondary" type="button" size="sm" onClick={() => setCreatingSociedad(true)}>
                      + Nueva
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    autoFocus
                    placeholder="Nombre"
                    value={newSociedadNombre}
                    onChange={(e) => setNewSociedadNombre(e.target.value)}
                  />
                  <select
                    className={selectClass}
                    value={newSociedadPaisId}
                    onChange={(e) => setNewSociedadPaisId(e.target.value)}
                    aria-label="País de la nueva sociedad"
                  >
                    <option value="">País…</option>
                    {paises?.map((p) => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                  <Button variant="secondary" type="button" size="sm" onClick={onCreateSociedad} disabled={createSociedad.isPending}>
                    Crear
                  </Button>
                  <Button variant="ghost" type="button" size="sm" onClick={() => setCreatingSociedad(false)}>
                    ✕
                  </Button>
                </div>
              )}
              {errors.sociedadId && <p className="text-[12px] text-[var(--danger)] mt-1.5">{errors.sociedadId.message}</p>}
            </div>
            <CatalogSelectField
              label="Departamento"
              error={errors.departmentId?.message}
              registerReturn={register('departmentId')}
              options={(departments ?? []).map((d) => ({ id: d.id, label: d.name }))}
              emptyLabel="Sin asignar"
              canCreate={canComp}
              useCreateHook={useCreateDepartmentAsCatalog}
              onCreated={(id) => setValue('departmentId', id)}
              onError={setServerError}
            />
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
            <CatalogSelectField
              label="Centro de trabajo"
              required
              error={errors.localizacionId?.message}
              registerReturn={register('localizacionId')}
              options={(localizaciones ?? []).map((l) => ({ id: l.id, label: l.nombre }))}
              emptyLabel="Selecciona…"
              canCreate={canComp}
              useCreateHook={useCreateLocalizacion}
              onCreated={(id) => setValue('localizacionId', id)}
              onError={setServerError}
            />
            <CatalogSelectField
              label="Proyecto"
              error={errors.proyectoId?.message}
              registerReturn={register('proyectoId')}
              options={(proyectos ?? []).map((p) => ({ id: p.id, label: p.nombre }))}
              emptyLabel="Sin asignar"
              canCreate={canComp}
              useCreateHook={useCreateProyecto}
              onCreated={(id) => setValue('proyectoId', id)}
              onError={setServerError}
            />
            <Row label="Fecha de alta" required error={errors.startDate?.message}>
              <Input type="date" {...register('startDate')} />
            </Row>
            <CatalogSelectField
              label="Tipo de contrato"
              required
              error={errors.tipoContratoId?.message}
              registerReturn={register('tipoContratoId')}
              options={(tiposContrato ?? []).map((t) => ({ id: t.id, label: t.nombre }))}
              emptyLabel="Selecciona…"
              canCreate={canComp}
              useCreateHook={useCreateTipoContrato}
              onCreated={(id) => setValue('tipoContratoId', id)}
              onError={setServerError}
            />
            <CatalogSelectField
              label="Jornada"
              error={errors.jornadaId?.message}
              registerReturn={register('jornadaId')}
              options={(jornadas ?? []).map((j) => ({ id: j.id, label: j.nombre }))}
              emptyLabel="Sin especificar"
              canCreate={canComp}
              useCreateHook={useCreateJornada}
              onCreated={(id) => setValue('jornadaId', id)}
              onError={setServerError}
            />
            <Row label="Horario" error={errors.horario?.message}>
              <Input placeholder="p. ej. 9:00–18:00" {...register('horario')} />
            </Row>
            <Row label="Fin de periodo de prueba" error={errors.finPeriodoPrueba?.message}>
              <Input type="date" {...register('finPeriodoPrueba')} />
            </Row>
            <Row label="Vencimiento de contrato" error={errors.vencimientoContrato?.message}>
              <Input type="date" {...register('vencimientoContrato')} />
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
            {canComp ? (
              <Row label="Salario bruto anual (€)" error={errors.salary?.message}>
                <Input
                  type="number"
                  min={0}
                  {...register('salary', { setValueAs: (v) => (v === '' || v === null ? undefined : Number(v)) })}
                />
              </Row>
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
