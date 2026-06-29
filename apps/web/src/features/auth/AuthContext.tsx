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
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Si el refresh falla en cualquier petición, cerramos sesión en el cliente.
    setOnLogout(() => setUser(null));

    if (!tokenStore.access) {
      setLoading(false);
      return;
    }
    // Hidrata la sesión a partir del token guardado (sobrevive a un refresco).
    api
      .get<SessionUser>('/auth/me')
      .then(setUser)
      .catch(() => {
        tokenStore.clear();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    tokenStore.set(res);
    setUser(await api.get<SessionUser>('/auth/me'));
  };

  const logout = () => {
    tokenStore.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
