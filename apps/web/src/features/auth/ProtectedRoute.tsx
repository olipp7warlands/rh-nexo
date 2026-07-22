import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

/** Protege un grupo de rutas: exige sesión; si no la hay, redirige a /login. */
export function ProtectedRoute() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}
