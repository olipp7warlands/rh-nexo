import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import { OnboardingPage } from './features/onboarding/OnboardingPage';
import { DesempenoPage } from './features/performance/DesempenoPage';
import { InformesPage } from './features/reports/InformesPage';
import { NominaPage } from './features/payroll/NominaPage';
import { DocumentosPage } from './features/documents/DocumentosPage';
import { ReclutamientoPage } from './features/reclutamiento/ReclutamientoPage';
import { JobDetailPage } from './features/reclutamiento/JobDetailPage';
import { PlaceholderPage } from './features/_shared/PlaceholderPage';
import { NAV } from './lib/nav';

const PAGES: Record<string, JSX.Element> = {
  '/': <InicioPage />,
  '/empleados': <EmpleadosPage />,
  '/organigrama': <OrganigramaPage />,
  '/ausencias': <AusenciasPage />,
  '/calendario': <CalendarioPage />,
  '/onboarding': <OnboardingPage />,
  '/desempeno': <DesempenoPage />,
  '/informes': <InformesPage />,
  '/nomina': <NominaPage />,
  '/documentos': <DocumentosPage />,
  '/reclutamiento': <ReclutamientoPage />,
};

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
                <Route path="/empleados/:id" element={<EmployeeDetailPage />} />
                <Route path="/reclutamiento/:jobId" element={<JobDetailPage />} />
                {NAV.flatMap((section) =>
                  section.items.map((item) => (
                    <Route
                      key={item.key}
                      path={item.path}
                      element={PAGES[item.path] ?? <PlaceholderPage eyebrow={section.section} title={item.label} />}
                    />
                  )),
                )}
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
