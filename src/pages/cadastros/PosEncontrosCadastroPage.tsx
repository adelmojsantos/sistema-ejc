import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Edit3, Paperclip, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { posEncontroService } from '../../services/posEncontroService';
import type { PosEncontro } from '../../types/posEncontro';
import { useEncontros } from '../../contexts/EncontroContext';

const htmlToText = (html?: string | null) => {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export function PosEncontrosCadastroPage() {
  const navigate = useNavigate();
  const { encontros, encontroAtivo } = useEncontros();
  const [selectedEncontroId, setSelectedEncontroId] = useState('');
  const [items, setItems] = useState<PosEncontro[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedEncontroId) {
      setSelectedEncontroId(encontroAtivo?.id ?? encontros[encontros.length - 1]?.id ?? '');
    }
  }, [encontroAtivo, encontros, selectedEncontroId]);

  const selectedEncontro = useMemo(
    () => encontros.find((encontro) => encontro.id === selectedEncontroId) ?? null,
    [encontros, selectedEncontroId]
  );

  const loadItems = async () => {
    if (!selectedEncontroId) return;

    setIsLoading(true);
    try {
      const data = await posEncontroService.listarPorEncontro(selectedEncontroId);
      setItems(data);
    } catch (error) {
      console.error('Erro ao carregar pós-encontros:', error);
      toast.error('Não foi possível carregar os pós-encontros.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEncontroId]);

  const handleDelete = async (item: PosEncontro) => {
    if (!window.confirm(`Excluir "${item.tema ?? item.titulo}"? As realizações e presenças vinculadas também serão removidas.`)) return;

    setIsDeletingId(item.id);
    try {
      await posEncontroService.excluir(item.id);
      toast.success('Pós-encontro excluído.');
      await loadItems();
    } catch (error) {
      console.error('Erro ao excluir pós-encontro:', error);
      toast.error('Não foi possível excluir o pós-encontro.');
    } finally {
      setIsDeletingId(null);
    }
  };

  return (
    <main className="container fade-in" style={{ paddingBottom: '3rem' }}>
      <PageHeader
        title="Pós-Encontro"
        subtitle="Cadastros"
        backPath="/cadastros"
        actions={(
          <div className="pos-cadastro-header-filter">
            <label className="form-label" htmlFor="pos-encontro-encontro">Encontro</label>
            <select
              id="pos-encontro-encontro"
              className="form-input"
              value={selectedEncontroId}
              onChange={(event) => setSelectedEncontroId(event.target.value)}
            >
              {encontros.map((encontro) => (
                <option key={encontro.id} value={encontro.id}>
                  {encontro.edicao ? `${encontro.edicao}º EJC - ` : ''}{encontro.nome}
                </option>
              ))}
            </select>
          </div>
        )}
      />

      <section className="pos-cadastro-toolbar">
        <span className="badge">{selectedEncontro?.nome ?? 'Selecione um encontro'}</span>
        <button
          className="btn-primary pos-cadastro-new-btn"
          type="button"
          onClick={() => navigate('/cadastros/pos-encontros/novo', { state: { encontroId: selectedEncontroId } })}
        >
          <Plus size={18} />
          Novo Pós-Encontro
        </button>
      </section>

      <section className="pos-cadastro-section">
        <div className="pos-cadastro-list-header">
          <div>
            <strong>Roteiros cadastrados</strong>
            <p className="text-muted" style={{ margin: '0.25rem 0 0' }}>Base usada por todos os círculos deste encontro.</p>
          </div>
          <span className="text-muted">{items.length} item(ns)</span>
        </div>

        {isLoading ? (
          <div className="text-muted" style={{ padding: '1.25rem' }}>Carregando...</div>
        ) : items.length === 0 ? (
          <div className="empty-state pos-cadastro-empty">
            <BookOpen size={44} style={{ opacity: 0.28 }} />
            <p>Nenhum pós-encontro cadastrado para este encontro.</p>
          </div>
        ) : (
          <div className="pessoa-grid pos-cadastro-list">
            {items.map((item) => (
              <article key={item.id} className={`pessoa-row pos-cadastro-row ${item.ativo ? 'is-active' : 'is-inactive'}`}>
                <div className="pessoa-row-main pos-cadastro-row-main">
                  <span className="pessoa-avatar small pos-cadastro-row-avatar">
                    {item.ordem}
                  </span>
                  <span className="pessoa-row-info">
                    <h3 className="pessoa-row-name">{item.ordem}º Pós-Encontro</h3>
                    <span className="pessoa-row-sub">{item.tema ?? item.titulo}</span>
                  </span>
                </div>

                <div className="pessoa-row-col pos-cadastro-status-col">
                  <span className="pessoa-row-value">
                    <span className={`pos-cadastro-status-badge ${item.ativo ? 'is-active' : 'is-inactive'}`}>
                      {item.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </span>
                </div>

                <div className="pessoa-row-col">
                  <span className="pessoa-row-label">Roteiro</span>
                  <span className="pessoa-row-value pos-cadastro-route-status">
                    {htmlToText(item.conteudo) && <span>Texto digitado</span>}
                    {item.arquivo_path && (
                      <span className="pos-cadastro-file-inline">
                        <Paperclip size={12} />
                        Arquivo
                      </span>
                    )}
                  </span>
                </div>

                <div className="pessoa-row-actions">
                  <button className="icon-btn" type="button" onClick={() => navigate(`/cadastros/pos-encontros/${item.id}`)} title="Editar">
                    <Edit3 size={16} />
                    <span className="pos-cadastro-action-label">Editar</span>
                  </button>
                  <button className="icon-btn icon-btn-danger" type="button" onClick={() => handleDelete(item)} title="Excluir" disabled={isDeletingId === item.id}>
                    <Trash2 size={16} />
                    <span className="pos-cadastro-action-label">Excluir</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <style>{`
        .pos-cadastro-new-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .pos-cadastro-header-filter {
          display: grid;
          gap: 0.35rem;
          min-width: 280px;
        }

        .pos-cadastro-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1.25rem;
        }

        .pos-cadastro-section {
          display: grid;
          gap: 1rem;
        }

        .pos-cadastro-list-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
        }

        .pos-cadastro-list {
          margin-top: 0;
        }

        .pos-cadastro-row {
          position: relative;
          grid-template-columns: minmax(260px, 1.4fr) minmax(120px, 0.55fr) minmax(170px, 0.75fr) auto;
        }

        .pos-cadastro-row.is-active {
          border-color: var(--border-color);
          border-left: 4px solid #22c55e;
        }

        .pos-cadastro-row.is-inactive {
          border-color: var(--border-color);
          border-left: 4px solid #94a3b8;
        }

        .pos-cadastro-row.is-active:hover {
          border-color: var(--border-color);
          border-left-color: #22c55e;
          box-shadow: 0 2px 8px color-mix(in srgb, #22c55e 16%, transparent);
        }

        .pos-cadastro-row.is-inactive:hover {
          border-color: var(--border-color);
          border-left-color: #94a3b8;
          box-shadow: 0 2px 8px color-mix(in srgb, #94a3b8 14%, transparent);
        }

        .pos-cadastro-row-main {
          border: 0;
          background: transparent;
          color: inherit;
          padding: 0;
          text-align: left;
          border-radius: 0;
        }

        .pos-cadastro-row-avatar {
          background: var(--primary-color);
          color: white;
          font-weight: 800;
        }

        .pos-cadastro-status-col {
          justify-content: center;
        }

        .pos-cadastro-action-label {
          display: none;
        }

        .pos-cadastro-status-badge {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          border-radius: 999px;
          padding: 0.25rem 0.65rem;
          font-size: 0.72rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .pos-cadastro-status-badge.is-active {
          background: color-mix(in srgb, #22c55e 18%, transparent);
          border: 1px solid color-mix(in srgb, #22c55e 45%, transparent);
          color: #22c55e;
        }

        .pos-cadastro-status-badge.is-inactive {
          background: color-mix(in srgb, #94a3b8 18%, transparent);
          border: 1px solid color-mix(in srgb, #94a3b8 45%, transparent);
          color: #94a3b8;
        }

        .pos-cadastro-route-status {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          flex-wrap: wrap;
        }

        .pos-cadastro-file-inline {
          display: flex;
          align-items: center;
          gap: 0.2rem;
          color: var(--primary-color);
          font-size: 0.8rem;
          font-weight: 700;
        }

        .pos-cadastro-empty {
          padding: 3rem 1rem;
          display: grid;
          justify-items: center;
          gap: 0.75rem;
        }

        @media (max-width: 640px) {
          .pos-cadastro-new-btn,
          .page-header-actions,
          .pos-cadastro-header-filter {
            width: 100%;
          }

          .pos-cadastro-toolbar {
            align-items: stretch;
            flex-direction: column;
          }

          .pos-cadastro-list-header {
            flex-direction: column;
          }

          .pos-cadastro-row {
            grid-template-columns: 1fr;
            gap: 0.75rem;
            padding: 0.9rem;
            padding-top: 1rem;
          }

          .pos-cadastro-row-main {
            border-bottom: 1px solid var(--border-color);
            padding-right: 5.5rem;
            padding-bottom: 0.75rem;
          }

          .pos-cadastro-status-col {
            position: absolute;
            top: 0.9rem;
            right: 0.9rem;
            min-width: 0;
          }

          .pos-cadastro-route-status {
            gap: 0.5rem;
          }

          .pos-cadastro-row .pessoa-row-actions {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0.5rem;
            justify-content: stretch;
          }

          .pos-cadastro-row .pessoa-row-actions .icon-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.45rem;
            width: 100%;
            min-height: 38px;
            font-size: 0.78rem;
            font-weight: 800;
          }

          .pos-cadastro-action-label {
            display: inline;
          }
        }
      `}</style>
    </main>
  );
}
