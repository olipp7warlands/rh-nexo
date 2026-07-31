import { CatalogoPage } from './CatalogoPage';
import { useTiposContrato, useCreateTipoContrato, useUpdateTipoContrato, useDeleteTipoContrato } from './useEstructura';

export function TiposContratoPage() {
  return (
    <CatalogoPage
      eyebrow="Estructura"
      title="Tipos de contrato"
      singular="tipo de contrato"
      useList={useTiposContrato}
      useCreate={useCreateTipoContrato}
      useUpdate={useUpdateTipoContrato}
      useDelete={useDeleteTipoContrato}
    />
  );
}
