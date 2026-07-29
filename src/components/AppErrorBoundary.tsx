import { Component, type ErrorInfo, type ReactNode } from 'react';
import { captureAppError } from '../services/observabilityService';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureAppError(error, {
      source: 'react.error-boundary',
      details: info.componentStack ?? undefined,
    });
  }

  private retry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    const isChunkFailure = /dynamically imported module|loading chunk|failed to fetch/i.test(
      this.state.error.message
    );

    return (
      <main className="app-error-boundary" role="alert" aria-live="assertive">
        <section className="app-error-boundary__card" aria-labelledby="app-error-title">
          <p className="app-error-boundary__eyebrow">Não foi possível abrir esta tela</p>
          <h1 id="app-error-title">Algo saiu do esperado.</h1>
          <p>
            {isChunkFailure
              ? 'Uma versão mais recente do sistema pode ter sido publicada. Atualize a página para continuar.'
              : 'Seus dados não foram apagados. Tente abrir a tela novamente ou atualize a página.'}
          </p>
          <div className="app-error-boundary__actions">
            {!isChunkFailure && (
              <button type="button" className="btn-secondary" onClick={this.retry}>
                Tentar novamente
              </button>
            )}
            <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
              Atualizar página
            </button>
          </div>
        </section>
      </main>
    );
  }
}
