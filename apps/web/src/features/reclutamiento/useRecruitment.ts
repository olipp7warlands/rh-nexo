import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, uploadForm } from '../../lib/api';

export type JobStatus = 'BORRADOR' | 'ABIERTA' | 'PAUSADA' | 'CERRADA';
export type ApplicationStatus = 'ACTIVO' | 'RECHAZADO' | 'CONTRATADO' | 'RETIRADO';
export type CandidateSource =
  | 'PORTAL'
  | 'REFERIDO'
  | 'LINKEDIN'
  | 'AGENCIA'
  | 'OTRO'
  | 'STRATOS'
  | 'IMPULSYN'
  | 'UNIVERSIDAD'
  | 'INFOJOBS'
  | 'INDEED'
  | 'WEB_EMPRESA';

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  BORRADOR: 'Borrador',
  ABIERTA: 'Activa',
  PAUSADA: 'Pausada',
  CERRADA: 'Cerrada',
};

export interface Stage {
  id: string;
  name: string;
  order: number;
}

export interface JobSummary {
  id: string;
  title: string;
  departmentId: string | null;
  department: { name: string; color: string } | null;
  location: string;
  remote: boolean;
  level: string;
  contractType: string;
  status: JobStatus;
  openings: number;
  /** LEGADO: solo se muestra si los campos estructurados están vacíos. */
  description: string | null;
  objetivoPuesto: string | null;
  funciones: string | null;
  requisitosEducacion: string | null;
  requisitosExperiencia: string | null;
  seValorara: string | null;
  /** El servidor no expone la ruta del storage, solo si hay PDF y su nombre original. */
  tienePdf: boolean;
  descripcionPdfNombre: string | null;
  hiringManagerId: string | null;
  hiringManager: { id: string; fullName: string } | null;
  sociedadId: string | null;
  sociedad: { id: string; nombre: string } | null;
  proyectoId: string | null;
  proyecto: { id: string; nombre: string } | null;
  createdAt: string;
  /** Apertura REAL del proceso (editable). `createdAt` es solo de sistema. */
  openedAt: string;
  closedAt: string | null;
  totalApplications: number;
  byStage: Record<string, number>;
}

export type JobDetail = Omit<JobSummary, 'totalApplications' | 'byStage'>;

export interface CandidateRef {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  location: string | null;
  source: CandidateSource;
  fuenteDetalle: string | null;
  linkedinUrl: string | null;
  resumeUrl: string | null;
  createdAt: string;
}

export interface InterviewItem {
  id: string;
  applicationId: string;
  interviewerId: string | null;
  scheduledAt: string | null;
  type: string;
  status: string;
  feedback: string | null;
}

export interface EvaluationItem {
  id: string;
  applicationId: string;
  evaluatorId: string | null;
  score: number | null;
  strengths: string | null;
  concerns: string | null;
  recommendation: string | null;
  createdAt: string;
}

export interface AuditDecisionItem {
  id: string;
  applicationId: string;
  type: string;
  automated: boolean;
  reason: string | null;
  actorId: string | null;
  createdAt: string;
}

export interface ApplicationItem {
  id: string;
  jobId: string;
  candidateId: string;
  stageId: string | null;
  status: ApplicationStatus;
  rating: number | null;
  notes: string | null;
  appliedAt: string;
  fechaIncorporacion: string | null;
  candidate: CandidateRef;
  stage: Stage | null;
  interviews: Pick<InterviewItem, 'id' | 'type' | 'status' | 'scheduledAt'>[];
  evaluations: Pick<EvaluationItem, 'id' | 'score' | 'recommendation'>[];
  _count: { decisions: number };
}

export interface CandidateApplicationDetail {
  id: string;
  status: ApplicationStatus;
  appliedAt: string;
  fechaIncorporacion: string | null;
  job: { id: string; title: string };
  stage: Stage | null;
  interviews: InterviewItem[];
  evaluations: EvaluationItem[];
  decisions: AuditDecisionItem[];
}

export interface CandidateDetail extends CandidateRef {
  applications: CandidateApplicationDetail[];
}

export interface HireInput {
  startDate: string;
  jobTitle?: string;
  level?: string;
  location?: string;
  /** País de la localización; obligatorio solo si `location` aún no existe y hay que crearla. */
  paisId?: string;
  departmentId?: string;
  managerId?: string;
  contractType?: string;
  salary?: number;
  buddyId?: string;
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['recruitment'] });
}

export function useJobs(enabled = true) {
  return useQuery({ queryKey: ['recruitment', 'jobs'], queryFn: () => api.get<JobSummary[]>('/jobs'), enabled });
}

export function useJob(id: string, enabled = true) {
  return useQuery({
    queryKey: ['recruitment', 'jobs', id],
    queryFn: () => api.get<JobDetail>(`/jobs/${id}`),
    enabled: enabled && !!id,
  });
}

export function useStages(enabled = true) {
  return useQuery({ queryKey: ['recruitment', 'stages'], queryFn: () => api.get<Stage[]>('/applications/stages'), enabled });
}

export function useCandidates(search?: string) {
  const qs = search ? `?search=${encodeURIComponent(search)}` : '';
  return useQuery({
    queryKey: ['recruitment', 'candidates', search ?? ''],
    queryFn: () => api.get<CandidateRef[]>(`/candidates${qs}`),
  });
}

export function useCandidate(id: string) {
  return useQuery({
    queryKey: ['recruitment', 'candidates', id],
    queryFn: () => api.get<CandidateDetail>(`/candidates/${id}`),
    enabled: !!id,
  });
}

export function useApplicationsByJob(jobId: string, enabled = true) {
  return useQuery({
    queryKey: ['recruitment', 'applications', jobId],
    queryFn: () => api.get<ApplicationItem[]>(`/applications?jobId=${jobId}`),
    enabled: enabled && !!jobId,
  });
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      departmentId?: string;
      location: string;
      remote?: boolean;
      level: string;
      contractType?: string;
      openings?: number;
      description?: string;
      objetivoPuesto?: string;
      funciones?: string;
      requisitosEducacion?: string;
      requisitosExperiencia?: string;
      seValorara?: string;
      hiringManagerId?: string;
      sociedadId?: string;
      proyectoId?: string;
      status?: JobStatus;
      openedAt?: string;
      closedAt?: string;
    }) => api.post<JobDetail>('/jobs', data),
    onSuccess: () => invalidate(qc),
  });
}

/** Edición del ciclo de vida de una oferta (estado, apertura, cierre, proyecto). Solo ADMIN/RRHH. */
export function useUpdateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      title?: string;
      departmentId?: string;
      /** LEGADO: editable para que RRHH reparta el texto en los campos estructurados. */
      description?: string;
      status?: JobStatus;
      openedAt?: string;
      closedAt?: string;
      proyectoId?: string;
      objetivoPuesto?: string;
      funciones?: string;
      requisitosEducacion?: string;
      requisitosExperiencia?: string;
      seValorara?: string;
    }) => api.patch<JobDetail>(`/jobs/${id}`, data),
    onSuccess: () => invalidate(qc),
  });
}

/** Elimina una oferta sin candidaturas (409 del servidor si las tiene). Solo ADMIN/RRHH. */
export function useDeleteJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ id: string; deleted: true }>(`/jobs/${id}`),
    onSuccess: () => invalidate(qc),
  });
}

/** Elimina una candidatura sin actividad; el candidato permanece. Solo ADMIN/RRHH. */
export function useDeleteApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ id: string; deleted: true }>(`/applications/${id}`),
    onSuccess: () => invalidate(qc),
  });
}

/** Sube (o reemplaza) el PDF adjunto de la oferta. */
export function useUploadJobPdf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const form = new FormData();
      form.append('file', file);
      return uploadForm<JobDetail>(`/jobs/${id}/pdf`, form);
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useRemoveJobPdf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<JobDetail>(`/jobs/${id}/pdf`),
    onSuccess: () => invalidate(qc),
  });
}

/** Corrige fechas reales de una candidatura (postulación / incorporación). Solo ADMIN/RRHH. */
export function useUpdateApplicationDates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; appliedAt?: string; fechaIncorporacion?: string }) =>
      api.patch<ApplicationItem>(`/applications/${id}`, data),
    onSuccess: () => invalidate(qc),
  });
}

export function useCreateCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      fullName: string;
      email: string;
      phone?: string;
      location?: string;
      source?: CandidateSource;
      fuenteDetalle?: string;
      linkedinUrl?: string;
      resumeUrl?: string;
    }) => api.post<CandidateRef>('/candidates', data),
    onSuccess: () => invalidate(qc),
  });
}

export interface HistoricoFilters {
  q?: string;
  jobId?: string;
  sociedadId?: string;
  proyectoId?: string;
  location?: string;
  status?: ApplicationStatus;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface HistoricoItem {
  applicationId: string;
  candidateId: string;
  fullName: string;
  resumeUrl: string | null;
  linkedinUrl: string | null;
  location: string | null;
  source: CandidateSource;
  fuenteDetalle: string | null;
  jobId: string;
  jobTitle: string;
  sociedad: { id: string; nombre: string } | null;
  proyecto: { id: string; nombre: string } | null;
  jobOpenedAt: string;
  appliedAt: string;
  fechaIncorporacion: string | null;
  status: ApplicationStatus;
}

export interface HistoricoPage {
  total: number;
  page: number;
  pageSize: number;
  items: HistoricoItem[];
}

/**
 * Histórico transversal (solo ADMIN/RRHH). Cada consulta queda auditada en el servidor, así que
 * `enabled` debe ir condicionado al rol (lección #7) y la query no se refresca sola.
 */
export function useHistorico(filters: HistoricoFilters, enabled = true) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v !== undefined && v !== '') qs.set(k, String(v));
  const query = qs.toString();
  return useQuery({
    queryKey: ['recruitment', 'historico', query],
    queryFn: () => api.get<HistoricoPage>(`/candidates/historico${query ? `?${query}` : ''}`),
    enabled,
    placeholderData: (prev) => prev,
  });
}

export function useCreateApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { candidateId: string; jobId: string; appliedAt?: string }) => api.post<ApplicationItem>('/applications', data),
    onSuccess: () => invalidate(qc),
  });
}

export function useMoveStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stageId }: { id: string; stageId: string }) => api.patch(`/applications/${id}/stage`, { stageId }),
    onSuccess: () => invalidate(qc),
  });
}

export function useRejectApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => api.patch(`/applications/${id}/reject`, { reason }),
    onSuccess: () => invalidate(qc),
  });
}

export function useAutoScreen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => api.post<{ advanced: number; rejected: number; total: number }>(`/applications/screen/${jobId}`, {}),
    onSuccess: () => invalidate(qc),
  });
}

export function useAddInterview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ applicationId, ...data }: { applicationId: string; type: string; scheduledAt?: string; interviewerId?: string }) =>
      api.post<InterviewItem>(`/applications/${applicationId}/interviews`, data),
    onSuccess: () => invalidate(qc),
  });
}

/** Elimina una entrevista PROGRAMADA (409 si ya está completada). Auditado en servidor. */
export function useDeleteInterview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ id: string; deleted: true }>(`/interviews/${id}`),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateInterview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; status?: string; feedback?: string }) => api.patch<InterviewItem>(`/interviews/${id}`, data),
    onSuccess: () => invalidate(qc),
  });
}

export function useAddEvaluation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ applicationId, ...data }: { applicationId: string; score?: number; strengths?: string; concerns?: string; recommendation?: string }) =>
      api.post<EvaluationItem>(`/applications/${applicationId}/evaluations`, data),
    onSuccess: () => invalidate(qc),
  });
}

export function useHireApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ applicationId, ...data }: { applicationId: string } & HireInput) =>
      api.post<{ employee: { id: string; fullName: string }; onboarding: { id: string } }>(`/applications/${applicationId}/hire`, data),
    onSuccess: () => invalidate(qc),
  });
}
