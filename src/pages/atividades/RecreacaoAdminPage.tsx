import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { useNavigate } from 'react-router-dom';
import {
  Baby,
  Search,
  Plus,
  ChevronLeft,
  Loader,
  X,
  Users,
  Heart,
  Info,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

import { Modal } from '../../components/ui/Modal';

import { recreacaoService } from '../../services/recreacaoService';
import { encontroService } from '../../services/encontroService';
import { useAuth } from '../../hooks/useAuth';
import { useLoading } from '../../contexts/LoadingContext';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { RecreacaoDadosModal } from '../../components/coordenador/RecreacaoDadosModal';
import type { Encontro } from '../../types/encontro';
import type { RecreacaoDados } from '../../types/recreacao';
import { WhatsappLogo } from 'phosphor-react';

export function RecreacaoAdminPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { setIsLoading: setGlobalLoading } = useLoading();

  const canChangeEncontro = hasPermission('modulo_admin');

  const [encontros, setEncontros] = useState<Encontro[]>([]);
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

  // Load initial encounters
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const data = await encontroService.listar();
        setEncontros(data);
        const active = data.find(e => e.ativo);
        if (active) setSelectedEncontroId(active.id);
        else if (data.length > 0) setSelectedEncontroId(data[0].id);
      } catch {
        toast.error('Erro ao carregar encontros.');
      }
    };
    loadInitialData();
  }, []);

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
    if (!term) return registros;

    return registros.filter(r => {
      const kidName = r.nome_crianca?.toLowerCase() || '';
      const resp1 = r.participacoes?.pessoas?.nome_completo?.toLowerCase() || '';
      const resp2 = r.outro_responsavel?.pessoas?.nome_completo?.toLowerCase() || '';
      const equipe1 = r.participacoes?.equipes?.nome?.toLowerCase() || '';

      return kidName.includes(term) || resp1.includes(term) || resp2.includes(term) || equipe1.includes(term);
    });
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
            <div key={reg.id} className="card animate-fade-in hover-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{
                padding: '1rem 1.25rem',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1.5rem'
              }} className="admin-card-content">
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', minWidth: '220px', flex: '1' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(var(--primary-rgb), 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--primary-color)',
                    flexShrink: 0
                  }}>
                    <Baby size={24} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>{reg.nome_crianca}</h3>
                    <span className="badge-age">{reg.idade} anos</span>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  gap: '2.5rem',
                  alignItems: 'center',
                  flex: '3',
                  justifyContent: 'flex-start',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1', minWidth: '350px' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.4, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Heart size={14} /> Responsáveis
                    </div>
                    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                      {/* Primeiro Responsável */}
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{reg.participacoes?.pessoas?.nome_completo}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '2px' }}>
                          <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{reg.participacoes?.equipes?.nome || 'Sem Equipe'}</div>
                          {reg.participacoes?.pessoas?.telefone && (
                            <>
                              <span style={{ opacity: 0.2 }}>•</span>
                              <a
                                href={`https://wa.me/55${reg.participacoes.pessoas.telefone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '0.75rem',
                                  color: '#10b981',
                                  fontWeight: 600,
                                  textDecoration: 'none'
                                }}
                                className="hover:underline"
                              >
                                <WhatsappLogo size={10} />
                                {reg.participacoes.pessoas.telefone}
                              </a>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Segundo Responsável */}
                      {reg.outro_responsavel && (
                        <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '1.5rem' }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{reg.outro_responsavel.pessoas?.nome_completo}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '2px' }}>
                            <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{reg.outro_responsavel.equipes?.nome}</div>
                            {reg.outro_responsavel.pessoas?.telefone && (
                              <>
                                <span style={{ opacity: 0.2 }}>•</span>
                                <a
                                  href={`https://wa.me/55${reg.outro_responsavel.pessoas.telefone.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '0.75rem',
                                    color: '#10b981',
                                    fontWeight: 600,
                                    textDecoration: 'none'
                                  }}
                                  className="hover:underline"
                                >
                                  <WhatsappLogo size={10} />
                                  {reg.outro_responsavel.pessoas.telefone}
                                </a>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {reg.observacoes && (
                    <div 
                      onClick={() => setObsToShow(reg.observacoes || null)}
                      style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '2px', 
                        maxWidth: '250px',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: 'rgba(var(--primary-rgb), 0.05)',
                        transition: 'all 0.2s'
                      }} 
                      className="obs-hover"
                    >
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.4, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Info size={10} /> Observações
                      </div>
                      <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {reg.observacoes}
                      </p>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }} className="admin-card-actions">
                  <button onClick={() => handleEdit(reg)} className="btn-primary flex items-center gap-2" title="Gerenciar" style={{ padding: '0.6rem' }}>
                    <Users size={18} /> Gerenciar
                  </button>
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
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 1rem !important;
          }
          .admin-card-actions {
            margin-left: 0 !important;
            width: 100%;
            justify-content: flex-end;
            border-top: 1px solid var(--border-color);
            padding-top: 0.75rem;
          }
        }
      `}</style>
    </div>
  );
}
