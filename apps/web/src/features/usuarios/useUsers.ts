import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Role } from '../auth/AuthContext';

export interface UserAccount {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  /** Contraseña temporal aún sin cambiar: «Pendiente de primer acceso». */
  mustChangePassword: boolean;
  lastLogin: string | null;
  createdAt: string;
  employeeId: string | null;
  employee: { id: string; fullName: string } | null;
}

/** El alta y el restablecimiento devuelven la contraseña temporal UNA sola vez. */
export interface WithTemporaryPassword {
  user: UserAccount;
  temporaryPassword: string;
}

export const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'EMPLEADO', label: 'Empleado' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'RRHH', label: 'RRHH' },
  { value: 'ADMIN', label: 'Administrador' },
];
export const roleLabel = (r: Role) => ROLE_OPTIONS.find((o) => o.value === r)?.label ?? r;

/** Cuentas (solo ADMIN). `employeeId` filtra a la de una persona. `enabled` evita la petición sin permiso. */
export function useUsers(employeeId?: string, enabled = true) {
  return useQuery({
    queryKey: ['users', employeeId ?? 'all'],
    queryFn: () => api.get<UserAccount[]>(`/users${employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : ''}`),
    enabled,
  });
}

function useUsersMutation<TVars, TRes>(fn: (v: TVars) => Promise<TRes>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }) });
}

export const useGiveAccess = () =>
  useUsersMutation((v: { employeeId: string; role: Role }) => api.post<WithTemporaryPassword>('/users', v));
export const useChangeRole = () =>
  useUsersMutation((v: { id: string; role: Role }) => api.patch<UserAccount>(`/users/${v.id}`, { role: v.role }));
export const useDeactivateUser = () => useUsersMutation((id: string) => api.post<UserAccount>(`/users/${id}/deactivate`));
export const useReactivateUser = () => useUsersMutation((id: string) => api.post<UserAccount>(`/users/${id}/reactivate`));
export const useResetPassword = () =>
  useUsersMutation((id: string) => api.post<WithTemporaryPassword>(`/users/${id}/reset-password`));
