import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

export type TipoAlerta = 'FIN_PRUEBA' | 'VENCIMIENTO_CONTRATO';

export interface Alerta {
  id: string;
  empleado: { id: string; fullName: string; jobTitle: string; sociedad: string | null };
  tipo: TipoAlerta;
  fecha: string;
  diasRestantes: number;
}

export const TIPO_ALERTA_LABEL: Record<TipoAlerta, string> = {
  FIN_PRUEBA: 'Fin de periodo de prueba',
  VENCIMIENTO_CONTRATO: 'Vencimiento de contrato',
};

export function useAlertas() {
  return useQuery({ queryKey: ['agenda', 'alertas'], queryFn: () => api.get<Alerta[]>('/agenda/alertas') });
}
