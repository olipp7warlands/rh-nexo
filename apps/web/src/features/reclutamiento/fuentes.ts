import type { CandidateSource } from './useRecruitment';

/** Etiquetas y orden de la fuente del candidato (los valores son los del enum `CandidateSource`). */
export const SOURCE_OPTIONS: { value: CandidateSource; label: string }[] = [
  { value: 'PORTAL', label: 'Portal' },
  { value: 'REFERIDO', label: 'Referido' },
  { value: 'LINKEDIN', label: 'LinkedIn' },
  { value: 'AGENCIA', label: 'Agencia' },
  { value: 'STRATOS', label: 'Stratos' },
  { value: 'IMPULSYN', label: 'Impulsyn' },
  { value: 'UNIVERSIDAD', label: 'Universidad' },
  { value: 'INFOJOBS', label: 'InfoJobs' },
  { value: 'INDEED', label: 'Indeed' },
  { value: 'WEB_EMPRESA', label: 'Web de la empresa' },
  { value: 'OTRO', label: 'Otro' },
];

export const sourceLabel = (s: CandidateSource | null | undefined) =>
  SOURCE_OPTIONS.find((o) => o.value === s)?.label ?? '—';

/** «Universidad · UPM» / «LinkedIn» / «—». */
export const sourceText = (s: CandidateSource | null | undefined, detalle: string | null | undefined) =>
  detalle ? `${sourceLabel(s)} · ${detalle}` : sourceLabel(s);

export const INTERVIEW_TYPE_OPTIONS = [
  { value: 'telefonica', label: 'Telefónica' },
  { value: 'cultural', label: 'Cultural' },
  { value: 'tecnica', label: 'Técnica' },
  { value: 'final', label: 'Final' },
];

export const interviewTypeLabel = (t: string) => INTERVIEW_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t;
