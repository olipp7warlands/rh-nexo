import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import '@nucleo/ui/styles.css';
import { AuthProvider } from './features/auth/AuthContext';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { LoginPage } from './features/auth/LoginPage';
import { AppShell } from './layout/AppShell';
import { EmpleadosPage } from './features/employees/EmpleadosPage';
import { EmployeeDetailPage } from './features/employees/EmployeeDetailPage';
import { OrganigramaPage } from './features/employees/OrganigramaPage';
import { InicioPage } from './features/absences/InicioPage';
import { AusenciasPage } from './features/absences/AusenciasPage';
import { CalendarioPage } from './features/absences/CalendarioPage';
import { ProcesosPage } from './features/procesos/ProcesosPage';
import { DesempenoPage } from './features/performance/DesempenoPage';
import { InformesPage } from './features/reports/InformesPage';
import { NominaPage } from './features/payroll/NominaPage';
import { DocumentosPage } from './features/documents/DocumentosPage';
import { ReclutamientoPage } from './features/reclutamiento/ReclutamientoPage';
import { JobDetailPage } from './features/reclutamiento/JobDetailPage';
import { AnotacionesPage } from './features/anotaciones/AnotacionesPage';
import { SociedadesPage } from './features/estructura/SociedadesPage';
import { LocalizacionesPage } from './features/estructura/LocalizacionesPage';
import { DepartamentosPage } from './features/estructura/DepartamentosPage';
import { PlaceholderPage } from './features/_shared/PlaceholderPage';
import { NAV } from './lib/nav';

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

const qc = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <AuthProvider>
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
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
