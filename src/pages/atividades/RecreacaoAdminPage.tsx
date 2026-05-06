import {
  Baby,
  ChevronLeft,
  Heart,
  Info,
  Loader,
  Plus,
  Search,
  X
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useDebounce } from '../../hooks/useDebounce';

import { Modal } from '../../components/ui/Modal';

import { Gear, WhatsappLogo } from 'phosphor-react';
import { RecreacaoDadosModal } from '../../components/coordenador/RecreacaoDadosModal';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { useEncontros } from '../../contexts/EncontroContext';
import { useLoading } from '../../contexts/LoadingContext';
import { useAuth } from '../../hooks/useAuth';
import { encontroService } from '../../services/encontroService';
import { recreacaoService } from '../../services/recreacaoService';
import type { Encontro } from '../../types/encontro';
import type { RecreacaoDados } from '../../types/recreacao';

export function RecreacaoAdminPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { setIsLoading: setGlobalLoading } = useLoading();

  const canChangeEncontro = hasPermission('modulo_admin');

  const { encontros, encontroAtivo } = useEncontros();
  const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');
  const [registros, setRegistros] = useState<RecreacaoDados[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 400);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedParticipacaoId, setSelectedParticipacaoId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [obsToShow, setObsToShow] = useState<string | null>(null);

  // Seleciona encontro ativo via contexto
  useEffect(() => {
    if (!selectedEncontroId) {
      if (encontroAtivo) setSelectedEncontroId(encontroAtivo.id);
      else if (encontros.length > 0) setSelectedEncontroId(encontros[0].id);
    }
  }, [encontros, encontroAtivo, selectedEncontroId]);

  const loadRegistros = useCallback(async () => {
    if (!selectedEncontroId) return;
    setIsLoading(true);
    try {
      const data = await recreacaoService.listarTodosPorEncontro(selectedEncontroId);
      setRegistros(data);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar dados de recreação.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedEncontroId]);

  useEffect(() => {
    loadRegistros();
  }, [loadRegistros]);

  useEffect(() => {
    setGlobalLoading(isLoading);
  }, [isLoading, setGlobalLoading]);

  const handleEdit = (registro: RecreacaoDados) => {
    setSelectedParticipacaoId(registro.participacao_id);
    setIsAddingNew(false);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setIsAddingNew(true);
    setSelectedParticipacaoId(null);
    setIsModalOpen(true);
  };

  const filteredRegistros = useMemo(() => {
    const term = debouncedSearch.toLowerCase().trim();
    
    const filtered = term ? registros.filter(r => {
      const kidName = r.nome_crianca?.toLowerCase() || '';
      const resp1 = r.participacoes?.pessoas?.nome_completo?.toLowerCase() || '';
      const resp2 = r.outro_responsavel?.pessoas?.nome_completo?.toLowerCase() || '';
      const equipe1 = r.participacoes?.equipes?.nome?.toLowerCase() || '';

      return kidName.includes(term) || resp1.includes(term) || resp2.includes(term) || equipe1.includes(term);
    }) : registros;

    return [...filtered].sort((a, b) => 
      (a.nome_crianca || '').localeCompare(b.nome_crianca || '')
    );
  }, [registros, debouncedSearch]);

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => navigate('/dashboard')} className="icon-btn">
            <ChevronLeft size={18} />
          </button>
          <div>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Atividades</p>
            <h1 className="page-title text-gradient" style={{ fontSize: '1.5rem', margin: 0 }}>Gestão de Recreação</h1>
          </div>
        </div>

        <button onClick={handleAddNew} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          <span>Novo Cadastro</span>
        </button>
      </div>

      <div className="card" style={{ marginBottom: '2rem', padding: '1.25rem' }}>
        <div className="grid-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Encontro</label>
            <LiveSearchSelect<Encontro>
              value={selectedEncontroId}
              onChange={(val) => setSelectedEncontroId(val)}
              fetchData={async (search, page) => await encontroService.buscarComPaginacao(search, page)}
              getOptionLabel={(e) => `${e.nome} ${e.ativo ? '(Ativo)' : ''}`}
              getOptionValue={(e) => String(e.id)}
              placeholder="Selecionar encontro..."
              initialOptions={encontros}
              disabled={!canChangeEncontro}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Buscar Criança ou Responsável</label>
            <div className="form-input-wrapper">
              <div className="form-input-icon">
                <Search size={16} />
              </div>
              <input
                type="text"
                className="form-input form-input--with-icon"
                placeholder="Criança, pai/mãe, equipe..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{
                    position: 'absolute',
                    right: '0.6rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--muted-text)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.2rem',
                  }}
                  title="Limpar busca"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-50">
          <Loader size={48} className="animate-spin mb-4" />
          <p>Carregando dados de recreação...</p>
        </div>
      ) : filteredRegistros.length === 0 ? (
        <div className="card text-center py-20">
          <Baby size={64} style={{ margin: '0 auto 1.5rem', opacity: 0.1 }} />
          <h3 style={{ opacity: 0.6, marginBottom: '0.5rem' }}>Nenhum cadastro encontrado</h3>
          <p style={{ opacity: 0.4 }}>Tente ajustar seus filtros ou mude o encontro atual.</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '1rem'
        }}>
          {filteredRegistros.map((reg) => (
            <div key={reg.id} className="card animate-fade-in hover-card" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
              <div style={{
                position: 'absolute',
                top: '0',
                right: '0',
                backgroundColor: 'var(--primary-color)',
                color: 'white',
                padding: '0.2rem 0.75rem',
                fontSize: '0.7rem',
                fontWeight: 800,
                borderBottomLeftRadius: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                zIndex: 5,
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                {reg.idade} {reg.idade <= 1 ? 'ANO' : 'ANOS'}
              </div>
              <div style={{
                padding: '1rem 1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }} className="admin-card-content">
                {/* Linha 1: Nome da Criança */}
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    flexShrink: 0
                  }}>
                    <Baby size={18} />
                  </div>
                  <h3 style={{
                    margin: 0,
                    fontSize: '1.15rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    color: 'var(--text-color)'
                  }}>{reg.nome_crianca}</h3>
                </div>

                {/* Linha 2: Grid de Responsáveis, Obs e Botão */}
                <div className="card-main-row" style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(300px, 2fr) minmax(200px, 1.2fr) 120px',
                  alignItems: 'center',
                  gap: '2rem'
                }}>
                  {/* Grupo Responsáveis */}
                  <div className="responsibles-section" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.5, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Heart size={12} fill="currentColor" /> Responsáveis
                    </div>
                    <div className="responsibles-row" style={{
                      display: 'flex',
                      gap: '2rem',
                      alignItems: 'flex-start'
                    }}>
                      {/* Primeiro Responsável */}
                      <div className="resp-item" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div className="resp-name" style={{ fontSize: '0.85rem', fontWeight: 700 }}>{reg.participacoes?.pessoas?.nome_completo}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>({reg.participacoes?.equipes?.nome || 'Sem Equipe'})</div>
                          {reg.participacoes?.pessoas?.telefone && (
                            <a
                              href={`https://wa.me/55${reg.participacoes.pessoas.telefone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '0.75rem',
                                color: '#10b981',
                                fontWeight: 700,
                                textDecoration: 'none'
                              }}
                            >
                              <WhatsappLogo size={12} weight="fill" />
                              {reg.participacoes.pessoas.telefone}
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Segundo Responsável */}
                      {reg.outro_responsavel && (
                        <div className="resp-item second-resp" style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                          borderLeft: '1px solid var(--border-color)',
                          paddingLeft: '1.5rem'
                        }}>
                          <div className="resp-name" style={{ fontSize: '0.85rem', fontWeight: 700 }}>{reg.outro_responsavel.pessoas?.nome_completo}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>({reg.outro_responsavel.equipes?.nome})</div>
                            {reg.outro_responsavel.pessoas?.telefone && (
                              <a
                                href={`https://wa.me/55${reg.outro_responsavel.pessoas.telefone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  fontSize: '0.75rem',
                                  color: '#10b981',
                                  fontWeight: 700,
                                  textDecoration: 'none'
                                }}
                              >
                                <WhatsappLogo size={12} weight="fill" />
                                {reg.outro_responsavel.pessoas.telefone}
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Grupo Observações */}
                  <div className="obs-container">
                    {reg.observacoes && (
                      <div
                        className="obs-section"
                        onClick={() => setObsToShow(reg.observacoes || null)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.5, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Info size={12} fill="currentColor" /> Observações
                        </div>
                        <div style={{
                          fontSize: '0.75rem',
                          opacity: 0.7,
                          backgroundColor: 'rgba(var(--primary-rgb), 0.05)',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px dashed rgba(var(--primary-rgb), 0.2)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {reg.observacoes}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="admin-card-actions" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => handleEdit(reg)}
                      className="btn-success flex items-center justify-center gap-2"
                      style={{
                        padding: '0.5rem 1rem',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        width: '100%',
                        backgroundColor: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'opacity 0.2s'
                      }}
                    >
                      <Gear size={16} /> Gerenciar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <RecreacaoDadosModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedParticipacaoId(null);
            setIsAddingNew(false);
          }}
          participacaoId={selectedParticipacaoId || ''}
          encontroId={selectedEncontroId}
          onSave={() => {
            loadRegistros();
          }}
          allowParticipantSelection={isAddingNew}
        />
      )}

      <Modal
        isOpen={!!obsToShow}
        onClose={() => setObsToShow(null)}
        title="Observações da Criança"
        maxWidth="500px"
      >
        <div style={{ padding: '0.5rem 0' }}>
          <p style={{ margin: 0, lineHeight: 1.6, fontSize: '1rem', color: 'var(--text-color)', whiteSpace: 'pre-wrap' }}>
            {obsToShow}
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button onClick={() => setObsToShow(null)} className="btn-primary">
              Entendido
            </button>
          </div>
        </div>
      </Modal>

      <style>{`
        .hover-card {
          transition: all 0.2s ease-in-out;
          border: 1px solid var(--border-color);
        }
        .hover-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.1);
          border-color: rgba(var(--primary-rgb), 0.3);
        }
        .obs-hover:hover {
          background: rgba(var(--primary-rgb), 0.15) !important;
          transform: scale(1.02);
        }
        .badge-age {
          display: inline-block;
          background-color: var(--primary-color);
          color: white;
          padding: 0.15rem 0.6rem;
          border-radius: 6px;
          font-weight: 700;
          font-family: inherit;
          font-size: 0.8rem;
          letter-spacing: 0.05em;
          box-shadow: 0 2px 4px rgba(var(--primary-rgb), 0.2);
          text-transform: uppercase;
          margin-top: 4px;
        }
        @media (max-width: 768px) {
          .admin-card-content {
            gap: 0.75rem !important;
          }
          .card-main-row {
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 0.75rem !important;
          }
          .card-info-group {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 0.75rem !important;
          }
          .responsibles-row {
            overflow-x: auto;
            padding-bottom: 4px;
            gap: 1.5rem !important;
          }
          .responsibles-row::-webkit-scrollbar {
            display: none;
          }
          .responsibles-row > div.second-resp {
            border-left: 1px solid var(--border-color) !important;
            padding-left: 1.5rem !important;
          }
          .responsibles-row > div {
            min-width: fit-content;
          }
          .admin-card-actions {
            width: 100%;
            margin-top: 0.25rem;
          }
          .admin-card-actions button {
            width: 100%;
          }
          .obs-section {
            max-width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}
