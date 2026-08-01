import { CatalogoPage } from './CatalogoPage';
import { useIdiomas, useCreateIdioma, useUpdateIdioma, useDeleteIdioma } from './useEstructura';

export function IdiomasPage() {
  return (
    <CatalogoPage
      title="Idiomas"
      singular="idioma"
      useList={useIdiomas}
      useCreate={useCreateIdioma}
      useUpdate={useUpdateIdioma}
      useDelete={useDeleteIdioma}
    />
  );
}
