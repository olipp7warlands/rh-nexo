import { useState } from 'react';
import { Avatar, Button, Card, PageHeader } from '@nucleo/ui';
import { useAuth } from '../auth/AuthContext';
import { formatDate } from '../../lib/format';
import {
  useDocuments,
  useDocumentTemplates,
  useSignDocument,
  DOCUMENT_CATEGORY_LABEL,
  type DocumentCategory,
} from './useDocuments';
import { DocumentStatusBadge } from './DocumentBadges';
import { NuevoDocumentoModal } from './NuevoDocumentoModal';

const CATEGORIES = Object.keys(DOCUMENT_CATEGORY_LABEL) as DocumentCategory[];

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--line)] rounded-lg p-4">
      <div className="text-[10px] uppercase tracking-wider text-[var(--ink-tertiary)] font-medium mb-1.5">{label}</div>
      <div className="mono text-[24px] font-bold tracking-[-0.02em]">{value}</div>
    </div>
  );
}

export function DocumentosPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'RRHH';
  const [mode, setMode] = useState<'docs' | 'plantillas'>('docs');
  const [category, setCategory] = useState<DocumentCategory | 'all'>('all');
  const [uploading, setUploading] = useState(false);

  const { data: docs, isLoading } = useDocuments(category === 'all' ? undefined : category);
  const { data: templates } = useDocumentTemplates();
  const sign = useSignDocument();

  const pendientes = docs?.filter((d) => d.status === 'PENDIENTE').length ?? 0;

  return (
    <div className="max-w-[1400px] mx-auto px-10 py-10">
      <PageHeader
        eyebrow="Empresa"
        title="Documentos"
        subtitle="Repositorio documental del grupo, plantillas y firmas pendientes."
        actions={
          <>
            <Button variant="secondary" onClick={() => setMode('plantillas')}>
              Plantillas
            </Button>
            {canManage && (
              <Button variant="primary" onClick={() => setUploading(true)}>
                Subir documento
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatBox label="Documentos" value={docs?.length ?? 0} />
        <StatBox label="Pendientes de firma" value={pendientes} />
        <StatBox label="Plantillas" value={templates?.length ?? 0} />
        <StatBox label="Categorías" value={CATEGORIES.length} />
      </div>

      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-1 p-1 bg-[var(--bg-hover)] rounded-lg">
          <button
            onClick={() => setMode('docs')}
            className={`px-3 h-8 text-[12px] font-medium rounded-md transition-colors ${
              mode === 'docs' ? 'bg-[var(--bg-surface)] shadow-sm text-[var(--ink-primary)]' : 'text-[var(--ink-secondary)]'
            }`}
          >
            Documentos
          </button>
          <button
            onClick={() => setMode('plantillas')}
            className={`px-3 h-8 text-[12px] font-medium rounded-md transition-colors ${
              mode === 'plantillas' ? 'bg-[var(--bg-surface)] shadow-sm text-[var(--ink-primary)]' : 'text-[var(--ink-secondary)]'
            }`}
          >
            Plantillas
          </button>
        </div>
        {mode === 'docs' && (
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setCategory('all')}
              className={`h-8 px-3 text-[12px] font-medium rounded-md transition-colors ${
                category === 'all' ? 'bg-[var(--ink-primary)] text-white' : 'text-[var(--ink-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              Todas
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`h-8 px-3 text-[12px] font-medium rounded-md transition-colors ${
                  category === c ? 'bg-[var(--ink-primary)] text-white' : 'text-[var(--ink-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                {DOCUMENT_CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
        )}
      </div>

      {mode === 'docs' ? (
        <Card padding="p-0">
          {isLoading && <p className="px-5 py-6 text-[13px] text-[var(--ink-tertiary)]">Cargando…</p>}
          {docs && docs.length === 0 && (
            <p className="px-5 py-8 text-center text-[13px] text-[var(--ink-tertiary)]">No hay documentos en esta categoría.</p>
          )}
          {docs && docs.length > 0 && (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[var(--bg-subtle)] border-b border-[var(--line)]">
                  <th className="text-left px-5 py-3 text-[10px] uppercase tracking-wider font-medium text-[var(--ink-tertiary)]">Documento</th>
                  <th className="text-left px-5 py-3 text-[10px] uppercase tracking-wider font-medium text-[var(--ink-tertiary)]">Categoría</th>
                  <th className="text-left px-5 py-3 text-[10px] uppercase tracking-wider font-medium text-[var(--ink-tertiary)]">Responsable</th>
                  <th className="text-left px-5 py-3 text-[10px] uppercase tracking-wider font-medium text-[var(--ink-tertiary)]">Fecha</th>
                  <th className="text-center px-5 py-3 text-[10px] uppercase tracking-wider font-medium text-[var(--ink-tertiary)]">Firmas</th>
                  <th className="text-left px-5 py-3 text-[10px] uppercase tracking-wider font-medium text-[var(--ink-tertiary)]">Estado</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => {
                  const firmadas = d.signatures.filter((s) => s.status === 'FIRMADA').length;
                  const mySignature = d.signatures.find((s) => s.employeeId === user?.employeeId && s.status === 'PENDIENTE');
                  return (
                    <tr key={d.id} className="border-b border-[var(--line-subtle)] last:border-0 hover:bg-[var(--bg-subtle)]">
                      <td className="px-5 py-3.5 font-medium">{d.name}</td>
                      <td className="px-5 py-3.5 text-[12px] text-[var(--ink-secondary)]">{DOCUMENT_CATEGORY_LABEL[d.category]}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <Avatar name={d.owner.fullName} size="xs" />
                          <span className="text-[12px] text-[var(--ink-secondary)]">{d.owner.fullName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 mono text-[12px] text-[var(--ink-tertiary)]">{formatDate(d.createdAt)}</td>
                      <td className="px-5 py-3.5 text-center mono text-[12px]">
                        {d.signatures.length ? `${firmadas}/${d.signatures.length}` : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <DocumentStatusBadge status={d.status} />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {mySignature && (
                          <Button variant="secondary" onClick={() => sign.mutate(mySignature.id)} disabled={sign.isPending}>
                            Firmar
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      ) : (
        <Card padding="p-0">
          {templates && templates.length === 0 && (
            <p className="px-5 py-8 text-center text-[13px] text-[var(--ink-tertiary)]">No hay plantillas configuradas.</p>
          )}
          {templates && templates.length > 0 && (
            <div className="divide-y divide-[var(--line-subtle)]">
              {templates.map((t) => (
                <div key={t.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1 font-medium text-[13px]">{t.name}</div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--bg-hover)] text-[var(--ink-secondary)]">
                    {DOCUMENT_CATEGORY_LABEL[t.category]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {uploading && <NuevoDocumentoModal onClose={() => setUploading(false)} />}
    </div>
  );
}
