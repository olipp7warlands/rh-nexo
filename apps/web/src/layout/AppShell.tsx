import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

/** Shell de la app: sidebar de altura completa + área principal con scroll. */
export function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-canvas)]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
