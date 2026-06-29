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
import { PlaceholderPage } from './features/_shared/PlaceholderPage';
import { NAV } from './lib/nav';

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
                {NAV.flatMap((section) =>
                  section.items.map((item) => (
                    <Route
                      key={item.key}
                      path={item.path}
                      element={
                        item.path === '/empleados' ? (
                          <EmpleadosPage />
                        ) : (
                          <PlaceholderPage eyebrow={section.section} title={item.label} />
                        )
                      }
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
