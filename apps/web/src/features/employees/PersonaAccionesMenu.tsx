import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccionesMenu, type MenuAction } from '../_shared/AccionesMenu';
import { useAuth } from '../auth/AuthContext';
import { AnotacionModal } from '../anotaciones/AnotacionModal';
import { IniciarProcesoModal } from '../procesos/IniciarProcesoModal';
import type { TipoProceso } from '../procesos/useProcesos';
import { DarDeBajaModal } from './DarDeBajaModal';
import { EmployeeModal } from './EmployeeModal';
import type { Employee } from './useEmployees';

/**
 * Acciones de una fila de Personas. Una persona NUNCA se elimina (se da de baja). Todas son acciones
 * que ya existían en la ficha o en Procesos; aquí solo se recolocan. «Gestionar acceso» (solo ADMIN)
 * lleva a la pestaña Acceso de la ficha. Quien no gestiona personas conserva el clic de fila.
 */
export function PersonaAccionesMenu({ employee, allEmployees }: { employee: Employee; allEmployees: Employee[] }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canManage = user?.role === 'ADMIN' || user?.role === 'RRHH';
  const isAdmin = user?.role === 'ADMIN';

  const [editing, setEditing] = useState(false);
  const [anotando, setAnotando] = useState(false);
  const [proceso, setProceso] = useState<TipoProceso | null>(null);
  const [dandoBaja, setDandoBaja] = useState(false);

  if (!canManage) return null;

  const deBaja = employee.status === 'BAJA';
  const actions: MenuAction[] = [
    { key: 'ver', label: 'Ver ficha', onSelect: () => navigate(`/personas/${employee.id}`) },
    { key: 'editar', label: 'Editar', onSelect: () => setEditing(true) },
    { key: 'anotacion', label: '+ Anotación', onSelect: () => setAnotando(true) },
  ];
  if (employee.status === 'ONBOARDING') {
    actions.push({ key: 'onboarding', label: 'Iniciar onboarding', onSelect: () => setProceso('ONBOARDING') });
  }
  if (!deBaja) {
    actions.push({ key: 'offboarding', label: 'Iniciar offboarding', onSelect: () => setProceso('OFFBOARDING') });
  }
  if (isAdmin) {
    actions.push({ key: 'acceso', label: 'Gestionar acceso', onSelect: () => navigate(`/personas/${employee.id}?tab=acceso`) });
  }
  // Dar de baja es lo único «destructivo»: oculto si la persona ya está de baja (y exige su modal de confirmación).
  if (!deBaja) {
    actions.push({ key: 'baja', label: 'Dar de baja', danger: true, onSelect: () => setDandoBaja(true) });
  }

  return (
    <>
      <AccionesMenu label={`Acciones de ${employee.fullName}`} actions={actions} />
      {/* Los modales viven dentro del <tr>: se frena el clic para que no abra la ficha. */}
      <div onClick={(e) => e.stopPropagation()}>
        {editing && <EmployeeModal mode="edit" employee={employee} allEmployees={allEmployees} onClose={() => setEditing(false)} />}
        {anotando && <AnotacionModal mode="create" presetEmpleado={employee} onClose={() => setAnotando(false)} />}
        {proceso && <IniciarProcesoModal tipo={proceso} presetEmployeeId={employee.id} onClose={() => setProceso(null)} />}
        {dandoBaja && <DarDeBajaModal employee={employee} onClose={() => setDandoBaja(false)} />}
      </div>
    </>
  );
}
