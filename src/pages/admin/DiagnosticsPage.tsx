import { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCw, Trash2 } from 'lucide-react';
import {
  clearLocalDiagnostics,
  getLocalDiagnostics,
  listRemoteDiagnostics,
  remoteDiagnosticsEnabled,
  type AppDiagnosticEvent,
  type RemoteAppDiagnostic,
} from '../../services/observabilityService';
import { userFacingError } from '../../utils/userFacingError';

type DiagnosticRow = {
  id: string;
  createdAt: string;
  source: string;
  route: string;
  message: string;
  stack?: string | null;
  origin: 'Sessão atual' | 'Servidor';
};

export function DiagnosticsPage() {
  const [localEvents, setLocalEvents] = useState<AppDiagnosticEvent[]>([]);
  const [remoteEvents, setRemoteEvents] = useState<RemoteAppDiagnostic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLocalEvents(getLocalDiagnostics());
    if (!remoteDiagnosticsEnabled) return;

    setIsLoading(true);
    setError(null);
    try {
      setRemoteEvents(await listRemoteDiagnostics());
    } catch (loadError) {
      setError(userFacingError(loadError, 'Não foi possível consultar os diagnósticos do servidor.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const clearLocal = () => {
    clearLocalDiagnostics();
    setLocalEvents([]);
  };

  const rows: DiagnosticRow[] = [
    ...localEvents.map((event) => ({ ...event, origin: 'Sessão atual' as const })),
    ...remoteEvents.map((event) => ({
      id: event.id,
      createdAt: event.created_at,
      source: event.source,
      route: event.route,
      message: event.message,
      stack: event.stack,
      origin: 'Servidor' as const,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <section className="diagnostics-page" aria-labelledby="diagnostics-title">
      <header className="diagnostics-header">
        <div>
          <p className="diagnostics-eyebrow"><Activity size={18} aria-hidden="true" /> Operação</p>
          <h1 id="diagnostics-title">Diagnósticos da aplicação</h1>
          <p>Falhas técnicas são registradas sem senhas, tokens ou endereços de e-mail.</p>
        </div>
        <div className="diagnostics-actions">
          <button type="button" className="btn-secondary" onClick={() => void refresh()} disabled={isLoading}>
            <RefreshCw size={18} aria-hidden="true" />
            {isLoading ? 'Atualizando…' : 'Atualizar'}
          </button>
          <button type="button" className="btn-secondary" onClick={clearLocal} disabled={!localEvents.length}>
            <Trash2 size={18} aria-hidden="true" />
            Limpar sessão
          </button>
        </div>
      </header>

      {!remoteDiagnosticsEnabled && (
        <div className="diagnostics-notice" role="note">
          O registro remoto está desativado. Defina <code>VITE_ENABLE_REMOTE_ERROR_LOGS=true</code> após aplicar a migration da P2.
        </div>
      )}

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      {!rows.length ? (
        <div className="diagnostics-empty">
          <Activity size={30} aria-hidden="true" />
          <h2>Nenhuma falha registrada</h2>
          <p>A sessão atual está limpa.</p>
        </div>
      ) : (
        <div className="diagnostics-list" aria-live="polite">
          {rows.map((row) => (
            <article className="diagnostics-card" key={`${row.origin}-${row.id}`}>
              <div className="diagnostics-card__meta">
                <span>{row.origin}</span>
                <time dateTime={row.createdAt}>
                  {new Intl.DateTimeFormat('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'medium',
                  }).format(new Date(row.createdAt))}
                </time>
              </div>
              <h2>{row.message}</h2>
              <dl>
                <div><dt>Origem</dt><dd>{row.source}</dd></div>
                <div><dt>Rota</dt><dd><code>{row.route}</code></dd></div>
              </dl>
              {row.stack && (
                <details>
                  <summary>Detalhes técnicos</summary>
                  <pre>{row.stack}</pre>
                </details>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
