import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import '@nucleo/ui/styles.css';
import { EmpleadosPage } from './features/employees/EmpleadosPage';

const qc = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        {/* TODO Fase 0: AppShell con Sidebar (ver src/lib/nav.ts) + rutas de todas las secciones */}
        <Routes>
          <Route path="/empleados" element={<EmpleadosPage />} />
          <Route path="*" element={<Navigate to="/empleados" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
