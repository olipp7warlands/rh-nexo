import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, authApi, tokenStore, setOnLogout } from '../../lib/api';

export type Role = 'ADMIN' | 'RRHH' | 'MANAGER' | 'EMPLEADO';

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  employeeId: string | null;
  employee?: { id: string; fullName: string; jobTitle: string } | null;
}

interface AuthContextValue {
  user: SessionUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Decodifica el payload del access token (sub/email/role/employeeId) sin red — sirve para
 * pintar la sesión de forma optimista mientras `/auth/me` confirma en segundo plano. No es una
 * fuente de verdad: solo hidrata la UI antes de tiempo; cada llamada a la API sigue validando
 * el token y el rol contra la BD en el servidor (JwtStrategy.validate(), auditoría M6).
 */
function decodeAccessToken(token: string): Pick<SessionUser, 'id' | 'email' | 'role' | 'employeeId'> | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const { sub, email, role, employeeId } = JSON.parse(json);
    return { id: sub, email, role, employeeId: employeeId ?? null };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Auditoría de rendimiento (TAREA 2): antes, ProtectedRoute esperaba a que /auth/me
  // resolviera (~570ms) antes de montar NADA, así que ninguna petición de pantalla podía
  // arrancar hasta entonces — una serialización fija en cada carga de página. Ahora, si hay un
  // access token, se decodifica localmente para pintar la sesión al instante (no hace falta
  // ningún estado de "loading": o hay token decodificable, o no hay sesión); `/auth/me` se
  // sigue llamando para confirmar/enriquecer (añade `employee.fullName/jobTitle`, que no viaja
  // en el JWT) y para cerrar sesión si el token ya no es válido, pero en paralelo, sin bloquear.
  const [user, setUser] = useState<SessionUser | null>(() => {
    const token = tokenStore.access;
    return token ? decodeAccessToken(token) : null;
  });

  useEffect(() => {
    // Si el refresh falla en cualquier petición, cerramos sesión en el cliente.
    setOnLogout(() => setUser(null));

    if (!tokenStore.access) return;
    api
      .get<SessionUser>('/auth/me')
      .then(setUser)
      .catch(() => {
        tokenStore.clear();
        setUser(null);
      });
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    tokenStore.set(res);
    // `res.user` ya trae id/email/role/employeeId (auth.controller.ts) — no hace falta esperar
    // a /auth/me para poder navegar; se enriquece con `employee.{fullName,jobTitle}` en segundo
    // plano, igual que en la hidratación de arriba.
    setUser(res.user as SessionUser);
    api.get<SessionUser>('/auth/me').then(setUser).catch(() => {});
  };

  const logout = () => {
    tokenStore.clear();
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
