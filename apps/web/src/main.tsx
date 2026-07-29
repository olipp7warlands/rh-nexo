import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import '@nucleo/ui/styles.css';
import { AuthProvider } from './features/auth/AuthContext';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { LoginPage } from './features/auth/LoginPage';
import { AppShell } from './layout/AppShell';
import { PlaceholderPage } from './features/_shared/PlaceholderPage';
import { NAV } from './lib/nav';

// Auditoría de rendimiento (TAREA 2): antes, las 15 páginas se importaban de forma estática
// aquí mismo, así que el bundle entero (515 KB) se descargaba y parseaba en el primer acceso
// aunque el usuario nunca visitara, p. ej., Nómina o Reclutamiento. `lazy()` parte cada página
// en su propio chunk, descargado solo al navegar a esa ruta por primera vez.
const EmpleadosPage = lazy(() => import('./features/employees/EmpleadosPage').then((m) => ({ default: m.EmpleadosPage })));
const EmployeeDetailPage = lazy(() => import('./features/employees/EmployeeDetailPage').then((m) => ({ default: m.EmployeeDetailPage })));
const OrganigramaPage = lazy(() => import('./features/employees/OrganigramaPage').then((m) => ({ default: m.OrganigramaPage })));
const InicioPage = lazy(() => import('./features/absences/InicioPage').then((m) => ({ default: m.InicioPage })));
const AusenciasPage = lazy(() => import('./features/absences/AusenciasPage').then((m) => ({ default: m.AusenciasPage })));
const CalendarioPage = lazy(() => import('./features/absences/CalendarioPage').then((m) => ({ default: m.CalendarioPage })));
const ProcesosPage = lazy(() => import('./features/procesos/ProcesosPage').then((m) => ({ default: m.ProcesosPage })));
const DesempenoPage = lazy(() => import('./features/performance/DesempenoPage').then((m) => ({ default: m.DesempenoPage })));
const InformesPage = lazy(() => import('./features/reports/InformesPage').then((m) => ({ default: m.InformesPage })));
const NominaPage = lazy(() => import('./features/payroll/NominaPage').then((m) => ({ default: m.NominaPage })));
const DocumentosPage = lazy(() => import('./features/documents/DocumentosPage').then((m) => ({ default: m.DocumentosPage })));
const ReclutamientoPage = lazy(() => import('./features/reclutamiento/ReclutamientoPage').then((m) => ({ default: m.ReclutamientoPage })));
const JobDetailPage = lazy(() => import('./features/reclutamiento/JobDetailPage').then((m) => ({ default: m.JobDetailPage })));
const AnotacionesPage = lazy(() => import('./features/anotaciones/AnotacionesPage').then((m) => ({ default: m.AnotacionesPage })));
const SociedadesPage = lazy(() => import('./features/estructura/SociedadesPage').then((m) => ({ default: m.SociedadesPage })));
const LocalizacionesPage = lazy(() => import('./features/estructura/LocalizacionesPage').then((m) => ({ default: m.LocalizacionesPage })));
const DepartamentosPage = lazy(() => import('./features/estructura/DepartamentosPage').then((m) => ({ default: m.DepartamentosPage })));

const PAGES: Record<string, JSX.Element> = {
  '/': <InicioPage />,
  '/personas': <EmpleadosPage />,
  '/organigrama': <OrganigramaPage />,
  '/ausencias': <AusenciasPage />,
  '/agenda': <CalendarioPage />,
  '/anotaciones': <AnotacionesPage />,
  '/procesos': <ProcesosPage />,
  '/desempeno': <DesempenoPage />,
  '/informes': <InformesPage />,
  '/nomina': <NominaPage />,
  '/documentos': <DocumentosPage />,
  '/seleccion': <ReclutamientoPage />,
  '/estructura/sociedades': <SociedadesPage />,
  '/estructura/localizaciones': <LocalizacionesPage />,
  '/estructura/departamentos': <DepartamentosPage />,
};

/** Redirección que conserva el parámetro de ruta (p. ej. /empleados/:id → /personas/:id). */
function RedirectWithParam({ to }: { to: (id: string) => string }) {
  const { id = '' } = useParams();
  return <Navigate to={to(id)} replace />;
}

function RouteFallback() {
  return (
    <div className="h-full min-h-[50vh] grid place-items-center text-[13px] text-[var(--ink-tertiary)]">
      Cargando…
    </div>
  );
}

const qc = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              {/* Todo lo demás exige sesión y vive dentro del AppShell. */}
              <Route element={<ProtectedRoute />}>
                <Route element={<AppShell />}>
                  <Route path="/personas/:id" element={<EmployeeDetailPage />} />
                  <Route path="/seleccion/:jobId" element={<JobDetailPage />} />
                  {NAV.flatMap((section) =>
                    section.items.map((item) => (
                      <Route
                        key={item.key}
                        path={item.path}
                        element={PAGES[item.path] ?? <PlaceholderPage eyebrow={section.section} title={item.label} />}
                      />
                    )),
                  )}

                  {/* Rutas antiguas (pre-humanX): redirección para enlaces/marcadores guardados. */}
                  <Route path="/empleados" element={<Navigate to="/personas" replace />} />
                  <Route path="/empleados/:id" element={<RedirectWithParam to={(id) => `/personas/${id}`} />} />
                  <Route path="/onboarding" element={<Navigate to="/procesos" replace />} />
                  <Route path="/calendario" element={<Navigate to="/agenda" replace />} />
                  <Route path="/reclutamiento" element={<Navigate to="/seleccion" replace />} />
                  <Route path="/reclutamiento/:jobId" element={<RedirectWithParam to={(id) => `/seleccion/${id}`} />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
