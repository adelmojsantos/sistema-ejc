import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { palestraService } from '../../services/palestraService';
import { useEncontros } from '../../contexts/EncontroContext';
import type { Palestra } from '../../types/palestra';
import { toast } from 'react-hot-toast';
import { 
  BookOpen, 
  CaretDown, 
  CaretLeft, 
  CircleNotch, 
  Microphone
} from 'phosphor-react';
import { RichTextEditor } from '../../components/ui/RichTextEditor';

// ── Página de Gestão de Resumos das Palestras ──


export function ResumoPalestrasPage() {
  const navigate = useNavigate();
  const { encontroAtivo } = useEncontros();
  const [palestras, setPalestras] = useState<Palestra[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [savingId, setSavingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!encontroAtivo) return;
      setIsLoading(true);
      try {
        const data = await palestraService.listarPorEncontro(encontroAtivo.id);
        setPalestras(data);
      } catch (error) {
        console.error('Erro ao carregar resumos:', error);
        toast.error('Erro ao carregar palestras.');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [encontroAtivo]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleUpdateResumo = async (id: string, novoResumo: string) => {
    setSavingId(id);
    try {
      await palestraService.atualizar(id, { resumo: novoResumo });
      toast.success('Resumo salvo com sucesso!');
      setPalestras(prev => prev.map(p => p.id === id ? { ...p, resumo: novoResumo } : p));
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar o resumo.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <main className="main-content container fade-in" style={{ paddingBottom: '4rem' }}>
      <header className="page-header" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate('/circulos')} className="icon-btn">
            <CaretLeft size={20} weight="bold" />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Resumo das Palestras</h1>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--muted-text)' }}>
              Área do Coordenador: registre os temas para os mediadores
            </p>
          </div>
        </div>
      </header>

      {!encontroAtivo ? (
        <div className="card text-center" style={{ padding: '3rem' }}>
          <p style={{ color: 'var(--muted-text)' }}>Selecione um encontro ativo para gerenciar os resumos.</p>
        </div>
      ) : isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <CircleNotch className="animate-spin text-primary" size={40} />
        </div>
      ) : palestras.length === 0 ? (
        <div className="card text-center" style={{ padding: '4rem' }}>
          <BookOpen size={48} weight="thin" style={{ opacity: 0.2, marginBottom: '1rem' }} />
          <p style={{ color: 'var(--muted-text)' }}>Nenhuma palestra cadastrada para este encontro.</p>
          <button className="btn-text" onClick={() => navigate('/cadastros/palestras')}>Ir para cadastros</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {palestras.map((palestra) => {
            const isExpanded = expandedId === palestra.id;

            return (
              <article
                key={palestra.id}
                className={`card fade-in ${isExpanded ? 'is-expanded' : ''}`}
                style={{
                  padding: 0,
                  overflow: 'hidden',
                  border: isExpanded ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                  transition: 'all 0.3s ease',
                  boxShadow: isExpanded ? 'var(--shadow-xl)' : 'var(--shadow-sm)'
                }}
              >
                <header
                  onClick={() => toggleExpand(palestra.id)}
                  style={{
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.25rem',
                    cursor: 'pointer',
                    background: isExpanded ? 'var(--surface-2)' : 'transparent',
                    userSelect: 'none'
                  }}
                >
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--surface-1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    border: '1px solid var(--border-color)',
                    flexShrink: 0
                  }}>
                    {palestra.palestrante_foto_url ? (
                      <img src={palestra.palestrante_foto_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Microphone size={24} weight="light" style={{ opacity: 0.3 }} />
                    )}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--primary-color)', textTransform: 'uppercase' }}>
                        P{palestra.ordem}
                      </span>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{palestra.titulo}</h3>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted-text)' }}>
                      {palestra.palestrante_nome || '—'}
                    </p>
                  </div>

                  <div style={{
                    color: 'var(--muted-text)',
                    transition: 'transform 0.3s ease',
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)'
                  }}>
                    <CaretDown size={20} weight="bold" />
                  </div>
                </header>

                {isExpanded && (
                  <div className="fade-in" style={{ padding: '0 1.5rem 1.5rem 1.5rem', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ padding: '1rem 0' }}>
                      <RichTextEditor
                        content={palestra.resumo || ''}
                        onChange={(content) => {
                          setPalestras(prev => prev.map(p => p.id === palestra.id ? { ...p, resumo: content } : p));
                        }}
                        disabled={savingId === palestra.id}
                      />
                    </div>

                    <div className="rp-actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem', gap: '1rem', alignItems: 'center' }}>
                      <span className="rp-actions__text" style={{ fontSize: '0.75rem', color: 'var(--muted-text)' }}>Pressione o botão para salvar as alterações</span>
                      <button
                        onClick={() => handleUpdateResumo(palestra.id, palestra.resumo || '')}
                        disabled={savingId === palestra.id}
                        className="btn-primary rp-actions__btn"
                        style={{ height: '40px', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}
                      >
                        {savingId === palestra.id ? (
                          <><CircleNotch size={16} className="animate-spin" weight="bold" /> Salvando...</>
                        ) : (
                          <>Salvar Alterações</>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <style>{`
        /* Estilos do Tiptap */
        .tiptap-wrapper {
          border: 1px solid var(--border-color);
          border-radius: 12px;
          overflow: hidden;
          background: var(--bg-color);
          box-shadow: var(--shadow-sm);
        }
        .tiptap-toolbar {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.6rem;
          background: var(--surface-1);
          border-bottom: 1px solid var(--border-color);
          flex-wrap: wrap;
          min-height: 48px;
        }
        .toolbar-divider {
          width: 1px;
          height: 20px;
          background: var(--border-color);
          margin: 0 0.5rem;
        }
        .rich-tool-btn {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          border: 1px solid transparent;
          background: transparent;
          color: var(--text-color);
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .rich-tool-btn:hover {
          background: var(--surface-2);
          border-color: var(--border-color);
        }
        .rich-tool-btn.is-active {
          background: var(--primary-color);
          color: white;
        }
        .rich-tool-btn svg {
          display: block;
          flex-shrink: 0;
        }
        
        .tiptap-content {
          padding: 1.25rem;
          min-height: 200px;
          color: var(--text-color);
          outline: none;
        }
        .tiptap-content .ProseMirror {
          min-height: 200px;
          outline: none;
        }
        .tiptap-content .ProseMirror p {
          margin-bottom: 0.75rem;
        }
        .tiptap-content ul {
          padding-left: 1.5rem;
          margin: 1rem 0;
          list-style-type: disc;
        }
        .tiptap-content ol {
          padding-left: 1.5rem;
          margin: 1rem 0;
          list-style-type: decimal;
        }
        .tiptap-content li {
          margin-bottom: 0.5rem;
        }

        .is-expanded {
          transform: translateY(-2px);
        }
        @media (max-width: 640px) {
          .rp-actions {
            flex-direction: column;
            align-items: stretch !important;
            gap: 0.75rem !important;
          }
          .rp-actions__text {
            text-align: center;
          }
          .rp-actions__btn {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
