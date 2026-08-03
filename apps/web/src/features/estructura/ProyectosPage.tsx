import { CatalogoPage } from './CatalogoPage';
import { useProyectos, useCreateProyecto, useUpdateProyecto, useDeleteProyecto } from './useEstructura';

export function ProyectosPage() {
  return (
    <CatalogoPage
      title="Proyectos"
      singular="proyecto"
      useList={useProyectos}
      useCreate={useCreateProyecto}
      useUpdate={useUpdateProyecto}
      useDelete={useDeleteProyecto}
    />
  );
}
