import { CatalogoPage } from './CatalogoPage';
import {
  useRelacionesEmergencia,
  useCreateRelacionEmergencia,
  useUpdateRelacionEmergencia,
  useDeleteRelacionEmergencia,
} from './useEstructura';

export function RelacionesEmergenciaPage() {
  return (
    <CatalogoPage
      title="Relaciones de emergencia"
      singular="relación"
      useList={useRelacionesEmergencia}
      useCreate={useCreateRelacionEmergencia}
      useUpdate={useUpdateRelacionEmergencia}
      useDelete={useDeleteRelacionEmergencia}
    />
  );
}
