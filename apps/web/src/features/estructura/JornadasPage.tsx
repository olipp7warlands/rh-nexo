import { CatalogoPage } from './CatalogoPage';
import { useJornadas, useCreateJornada, useUpdateJornada, useDeleteJornada } from './useEstructura';

export function JornadasPage() {
  return (
    <CatalogoPage
      eyebrow="Estructura"
      title="Jornadas"
      singular="jornada"
      useList={useJornadas}
      useCreate={useCreateJornada}
      useUpdate={useUpdateJornada}
      useDelete={useDeleteJornada}
    />
  );
}
