import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export type DocumentCategory = 'CONTRATOS' | 'NOMINAS' | 'POLITICAS' | 'CERTIFICADOS' | 'FORMACION';
export type DocumentStatus = 'VIGENTE' | 'FIRMADO' | 'PENDIENTE' | 'EMITIDO';
export type SignatureStatus = 'PENDIENTE' | 'FIRMADA';

export const DOCUMENT_CATEGORY_LABEL: Record<DocumentCategory, string> = {
  CONTRATOS: 'Contratos',
  NOMINAS: 'Nóminas',
  POLITICAS: 'Políticas',
  CERTIFICADOS: 'Certificados',
  FORMACION: 'Formación',
};

export interface DocumentSignature {
  id: string;
  employeeId: string;
  status: SignatureStatus;
  signedAt: string | null;
  employee: { id: string; fullName: string };
}

export interface DocumentItem {
  id: string;
  name: string;
  category: DocumentCategory;
  status: DocumentStatus;
  createdAt: string;
  owner: { id: string; fullName: string };
  signatures: DocumentSignature[];
}

export interface DocumentTemplateItem {
  id: string;
  name: string;
  category: DocumentCategory;
}

export interface MySignature {
  id: string;
  status: SignatureStatus;
  signedAt: string | null;
  document: { id: string; name: string; category: DocumentCategory; status: DocumentStatus };
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['documents'] });
}

export function useDocuments(category?: DocumentCategory) {
  const qs = category ? `?category=${category}` : '';
  return useQuery({
    queryKey: ['documents', category ?? 'all'],
    queryFn: () => api.get<DocumentItem[]>(`/documents${qs}`),
  });
}

export function useDocumentTemplates() {
  return useQuery({ queryKey: ['documents', 'templates'], queryFn: () => api.get<DocumentTemplateItem[]>('/documents/templates') });
}

export function useMySignatures() {
  return useQuery({ queryKey: ['documents', 'mine'], queryFn: () => api.get<MySignature[]>('/documents/mine') });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; category: DocumentCategory; ownerId?: string; signerIds?: string[] }) =>
      api.post<DocumentItem>('/documents', data),
    onSuccess: () => invalidate(qc),
  });
}

export function useSignDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (signatureId: string) => api.patch<DocumentSignature>(`/documents/signatures/${signatureId}/sign`, {}),
    onSuccess: () => invalidate(qc),
  });
}
