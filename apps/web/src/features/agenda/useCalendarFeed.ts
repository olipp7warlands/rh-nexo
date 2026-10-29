import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export interface CalendarFeedStatus {
  active: boolean;
  /** Cuándo se generó el enlace actual (el enlace en sí no se puede volver a ver). */
  createdAt: string | null;
}

export function useCalendarFeedStatus(enabled = true) {
  return useQuery({ queryKey: ['calendar-feed'], queryFn: () => api.get<CalendarFeedStatus>('/calendar/feed'), enabled });
}

/** Genera o regenera el enlace. La URL llega SOLO en esta respuesta (el servidor guarda únicamente su hash). */
export function useGenerateCalendarFeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ url: string; createdAt: string; regenerated: boolean }>('/calendar/feed'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar-feed'] }),
  });
}

export function useRevokeCalendarFeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.del<{ active: false }>('/calendar/feed'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar-feed'] }),
  });
}
