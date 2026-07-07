import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export type JobStatus = 'BORRADOR' | 'ABIERTA' | 'PAUSADA' | 'CERRADA';
export type ApplicationStatus = 'ACTIVO' | 'RECHAZADO' | 'CONTRATADO' | 'RETIRADO';
export type CandidateSource = 'PORTAL' | 'REFERIDO' | 'LINKEDIN' | 'AGENCIA' | 'OTRO';

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
  description: string | null;
  hiringManagerId: string | null;
  hiringManager: { id: string; fullName: string } | null;
  createdAt: string;
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
  source: CandidateSource;
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
  candidate: CandidateRef;
  stage: Stage | null;
  interviews: Pick<InterviewItem, 'id' | 'type' | 'status' | 'scheduledAt'>[];
  evaluations: Pick<EvaluationItem, 'id' | 'score' | 'recommendation'>[];
}

export interface CandidateApplicationDetail {
  id: string;
  status: ApplicationStatus;
  appliedAt: string;
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
      hiringManagerId?: string;
    }) => api.post<JobDetail>('/jobs', data),
    onSuccess: () => invalidate(qc),
  });
}

export function useCreateCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { fullName: string; email: string; phone?: string; source?: CandidateSource; linkedinUrl?: string; resumeUrl?: string }) =>
      api.post<CandidateRef>('/candidates', data),
    onSuccess: () => invalidate(qc),
  });
}

export function useCreateApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { candidateId: string; jobId: string }) => api.post<ApplicationItem>('/applications', data),
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
