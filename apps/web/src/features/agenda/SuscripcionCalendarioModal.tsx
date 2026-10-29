import { useState } from 'react';
import { Button } from '@nucleo/ui';
import { Modal } from '../_shared/Modal';
import { ConfirmarEliminarModal } from '../_shared/AccionesMenu';
import { formatDate } from '../../lib/format';
import { useCalendarFeedStatus, useGenerateCalendarFeed, useRevokeCalendarFeed } from './useCalendarFeed';

/**
 * «Suscribirse desde tu calendario»: enlace ICS personal de solo lectura. La URL se muestra UNA vez
 * (al generar o regenerar): después solo se sabe que está activa. Regenerar invalida el enlace
 * anterior al instante; revocar lo corta. Mientras se ve la URL el diálogo no se cierra con Esc ni
 * clic fuera: hay que confirmar que se ha copiado.
 */
export function SuscripcionCalendarioModal({ onClose }: { onClose: () => void }) {
  const { data: status, isLoading, error: statusError } = useCalendarFeedStatus();
  const generate = useGenerateCalendarFeed();
  const revoke = useRevokeCalendarFeed();

  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [noted, setNoted] = useState(false);
  const [confirm, setConfirm] = useState<'regenerar' | 'revocar' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const doGenerate = () => {
    setError(null);
    setMessage(null);
    generate.mutate(undefined, {
      onSuccess: (r) => {
        setUrl(r.url);
        setCopied(false);
        setNoted(false);
        setConfirm(null);
      },
      onError: (e) => setError((e as Error).message),
    });
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false); // sin portapapeles: el campo es seleccionable para copiar a mano
    }
  };

  const mostrandoUrl = url !== null;

  return (
    <Modal
      title="Suscribirse desde tu calendario"
      subtitle="Enlace personal de solo lectura para Outlook, Google Calendar o Apple Calendar"
      onClose={onClose}
      dismissible={!mostrandoUrl}
      wide
      footer={
        mostrandoUrl ? (
          <Button variant="primary" type="button" disabled={!noted} onClick={onClose}>
            Cerrar
          </Button>
        ) : (
          <Button variant="ghost" type="button" onClick={onClose}>
            Cerrar
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-5 text-[13px] text-[var(--ink-secondary)]">
        <p>
          Tu calendario externo mostrará, <strong className="font-medium text-[var(--ink-primary)]">solo lectura</strong>: las ausencias
          aprobadas de tu ámbito (sin motivo), las alertas de contrato y tus entrevistas como entrevistador (con el puesto, sin el nombre del
          candidato).
        </p>

        {isLoading && <p>Cargando…</p>}
        {statusError && <p role="alert" className="text-[var(--danger)]">{(statusError as Error).message}</p>}

        {mostrandoUrl && (
          <div className="rounded-lg border border-[var(--line-strong)] bg-[var(--bg-subtle)] p-4">
            <label htmlFor="feed-url" className="block text-[12px] font-medium text-[var(--ink-primary)] mb-1.5">
              Tu enlace (se muestra solo ahora)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="feed-url"
                readOnly
                value={url ?? ''}
                onFocus={(e) => e.currentTarget.select()}
                className="mono flex-1 h-9 px-3 text-[12px] bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md"
              />
              <Button variant="secondary" type="button" onClick={copy}>
                {copied ? 'Copiado ✓' : 'Copiar'}
              </Button>
            </div>
            <p className="text-[12px] mt-2">
              <strong className="font-medium text-[var(--ink-primary)]">No se podrá volver a ver.</strong> Quien tenga este enlace puede ver tu
              calendario: no lo compartas. Si lo pierdes o sospechas que se ha filtrado, regenéralo.
            </p>
            <label className="flex items-center gap-2 mt-3 text-[var(--ink-primary)]">
              <input type="checkbox" checked={noted} onChange={(e) => setNoted(e.target.checked)} />
              He copiado el enlace y lo he añadido a mi calendario (o lo haré ahora).
            </label>
          </div>
        )}

        {!isLoading && status && !mostrandoUrl && (
          <div className="rounded-lg border border-[var(--line)] p-4">
            {status.active ? (
              <p>
                Tu enlace está <strong className="font-medium text-[var(--ink-primary)]">activo</strong>
                {status.createdAt ? ` desde el ${formatDate(status.createdAt)}` : ''}. Por seguridad no se puede volver a mostrar: si necesitas
                uno nuevo, regenéralo (el anterior dejará de funcionar al instante).
              </p>
            ) : (
              <p>Aún no tienes enlace de suscripción. Genera uno para añadirlo a tu calendario.</p>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              {status.active ? (
                <>
                  <Button variant="secondary" type="button" onClick={() => { setError(null); setConfirm('regenerar'); }}>
                    Regenerar enlace
                  </Button>
                  <Button variant="secondary" type="button" onClick={() => { setError(null); setConfirm('revocar'); }}>
                    Revocar
                  </Button>
                </>
              ) : (
                <Button variant="primary" type="button" disabled={generate.isPending} onClick={doGenerate}>
                  {generate.isPending ? 'Generando…' : 'Generar enlace'}
                </Button>
              )}
            </div>
          </div>
        )}

        {message && <p role="status">{message}</p>}
        {error && !confirm && <p role="alert" className="text-[var(--danger)]">{error}</p>}

        <div>
          <h3 className="font-serif text-[13px] font-medium text-[var(--ink-primary)] mb-2">Cómo añadirlo a Outlook</h3>
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li>
              <strong className="font-medium text-[var(--ink-primary)]">Outlook en la web:</strong> Calendario → Agregar calendario →
              Suscribirse desde la web → pega el enlace → Importar.
            </li>
            <li>
              <strong className="font-medium text-[var(--ink-primary)]">Outlook de escritorio:</strong> Archivo → Configuración de la cuenta →
              Configuración de la cuenta → pestaña «Calendarios de Internet» → Nuevo → pega el enlace. (En el «nuevo Outlook»: Agregar
              calendario → Suscribirse desde la web.)
            </li>
          </ul>
          <p className="mt-3 rounded-md bg-[var(--bg-subtle)] px-3 py-2">
            <strong className="font-medium text-[var(--ink-primary)]">No es tiempo real:</strong> los calendarios externos refrescan los enlaces
            cada varias horas (a veces hasta 24 h), así que un cambio en humanX puede tardar en verse.
          </p>
        </div>
      </div>

      {confirm === 'regenerar' && (
        <ConfirmarEliminarModal
          title="Regenerar enlace"
          confirmLabel="Regenerar"
          pendingLabel="Generando…"
          variant="primary"
          message="Se generará un enlace nuevo y el actual dejará de funcionar al instante: tus calendarios externos no se actualizarán hasta que añadas el nuevo."
          pending={generate.isPending}
          error={error}
          onClose={() => setConfirm(null)}
          onConfirm={doGenerate}
        />
      )}
      {confirm === 'revocar' && (
        <ConfirmarEliminarModal
          title="Revocar enlace"
          confirmLabel="Revocar"
          pendingLabel="Revocando…"
          message="El enlace dejará de funcionar al instante y tus calendarios externos dejarán de actualizarse. Podrás generar otro cuando quieras."
          pending={revoke.isPending}
          error={error}
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            setError(null);
            revoke.mutate(undefined, {
              onSuccess: () => { setConfirm(null); setMessage('Enlace revocado.'); },
              onError: (e) => setError((e as Error).message),
            });
          }}
        />
      )}
    </Modal>
  );
}
