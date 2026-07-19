import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, uploadForm } from '../../lib/api';

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
  fileUrl: string | null;
  owner: { id: string; fullName: string };
  signatures: DocumentSignature[];
}

/** true si hay un fichero real adjunto (no el mock heredado ni ausencia de fichero). */
export function hasRealFile(doc: Pick<DocumentItem, 'fileUrl'>): boolean {
  return !!doc.fileUrl && !doc.fileUrl.startsWith('mock://');
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

export function useDocuments(category?: DocumentCategory, ownerId?: string) {
  const qs = new URLSearchParams();
  if (category) qs.set('category', category);
  if (ownerId) qs.set('ownerId', ownerId);
  const search = qs.toString();
  return useQuery({
    queryKey: ['documents', category ?? 'all', ownerId ?? 'any'],
    queryFn: () => api.get<DocumentItem[]>(`/documents${search ? `?${search}` : ''}`),
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

/** Igual que useCreateDocument, pero con un fichero real adjunto (multipart). */
export function useCreateDocumentWithFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      ...data
    }: {
      name: string;
      category: DocumentCategory;
      ownerId?: string;
      signerIds?: string[];
      file: File;
    }) => {
      const form = new FormData();
      form.append('name', data.name);
      form.append('category', data.category);
      if (data.ownerId) form.append('ownerId', data.ownerId);
      for (const id of data.signerIds ?? []) form.append('signerIds', id);
      form.append('file', file);
      return uploadForm<DocumentItem>('/documents', form);
    },
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
