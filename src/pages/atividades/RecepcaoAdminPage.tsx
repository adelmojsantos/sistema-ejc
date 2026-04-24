import {
  Car,
  CarFrontIcon,
  ChevronLeft,
  Edit2,
  Loader,
  Palette,
  Plus,
  Search,
  Trash2,
  User,
  X
} from 'lucide-react';
import { WhatsappLogo } from 'phosphor-react';
import { useCallback, useEffect, useState, useMemo } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { RecepcaoDadosModal } from '../../components/coordenador/RecepcaoDadosModal';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { useAuth } from '../../hooks/useAuth';
import { useLoading } from '../../contexts/LoadingContext';
import { encontroService } from '../../services/encontroService';
import { recepcaoService } from '../../services/recepcaoService';
import type { Encontro } from '../../types/encontro';
import { formatPlate } from '../../utils/plateUtils';
import type { RecepcaoDados } from '../../types/recepcao';

export function RecepcaoAdminPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { setIsLoading: setGlobalLoading } = useLoading();
  
  const canChangeEncontro = hasPermission('modulo_admin');

  const [encontros, setEncontros] = useState<Encontro[]>([]);
  const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');
  const [registros, setRegistros] = useState<RecepcaoDados[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 400);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedParticipacaoId, setSelectedParticipacaoId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Delete state
  const [registroToDelete, setRegistroToDelete] = useState<RecepcaoDados | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
      const data = await recepcaoService.listarTodosPorEncontro(selectedEncontroId);
      setRegistros(data);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar dados de recepção.');
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

  const handleEdit = (registro: RecepcaoDados) => {
    setSelectedParticipacaoId(registro.participacao_id);
    setIsAddingNew(false);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (registro: RecepcaoDados) => {
    setRegistroToDelete(registro);
  };

  const confirmDelete = async () => {
    if (!registroToDelete) return;
    setIsDeleting(true);
    try {
      await recepcaoService.excluir(registroToDelete.id);
      toast.success('Registro excluído com sucesso.');
      loadRegistros();
    } catch {
      toast.error('Erro ao excluir registro.');
    } finally {
      setIsDeleting(false);
      setRegistroToDelete(null);
    }
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
      const nome = r.participacoes?.pessoas?.nome_completo?.toLowerCase() || '';
      const equipe = r.participacoes?.equipes?.nome?.toLowerCase() || '';
      const placa = r.veiculo_placa?.toLowerCase() || '';
      const modelo = r.veiculo_modelo?.toLowerCase() || '';

      return nome.includes(term) || equipe.includes(term) || placa.includes(term) || modelo.includes(term);
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
            <h1 className="page-title text-gradient" style={{ fontSize: '1.5rem', margin: 0 }}>Gestão de Recepção</h1>
          </div>
        </div>

        <button onClick={handleAddNew} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          <span>Novo Registro</span>
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
            <label className="form-label">Buscar Registro</label>
            <div className="form-input-wrapper">
              <div className="form-input-icon">
                <Search size={16} />
              </div>
              <input
                type="text"
                className="form-input form-input--with-icon"
                placeholder="Nome, placa, equipe..."
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
          <p>Carregando registros...</p>
        </div>
      ) : filteredRegistros.length === 0 ? (
        <div className="card text-center py-20">
          <Car size={64} style={{ margin: '0 auto 1.5rem', opacity: 0.1 }} />
          <h3 style={{ opacity: 0.6, marginBottom: '0.5rem' }}>Nenhum registro encontrado</h3>
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
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', minWidth: '250px', flex: '1' }}>
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
                    <User size={22} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>{reg.participacoes?.pessoas?.nome_completo}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '2px' }}>
                      <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6 }}>{reg.participacoes?.equipes?.nome || 'Sem Equipe'}</p>
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  gap: '2rem',
                  alignItems: 'center',
                  flex: '2',
                  justifyContent: 'flex-start',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '100px' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.4, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CarFrontIcon size={14} /> Placa
                    </div>
                    <div className="badge-placa">{formatPlate(reg.veiculo_placa)}</div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '120px' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.4, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Car size={14} /> Modelo
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{reg.veiculo_modelo || '—'}</div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '100px' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.4, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Palette size={14} /> Cor
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{reg.veiculo_cor || '—'}</div>
                  </div>
                  {reg.participacoes?.pessoas?.telefone && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '100px' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.4, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <WhatsappLogo size={14} /> Telefone
                      </div>
                      <a
                        href={`https://wa.me/55${reg.participacoes.pessoas.telefone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.8rem',
                          color: '#10b981',
                          fontWeight: 600,
                          textDecoration: 'none'
                        }}
                        className="hover:underline"
                      >
                        {reg.participacoes.pessoas.telefone}
                      </a>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }} className="admin-card-actions">
                  <button onClick={() => handleEdit(reg)} className="icon-btn" title="Editar" style={{ padding: '0.6rem' }}>
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => handleDeleteClick(reg)} className="icon-btn" title="Excluir" style={{ padding: '0.6rem', color: '#ef4444' }}>
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <RecepcaoDadosModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedParticipacaoId(null);
            setIsAddingNew(false);
          }}
          participacaoId={selectedParticipacaoId || ''}
          onSave={() => {
            setIsModalOpen(false);
            loadRegistros();
          }}
          allowParticipantSelection={isAddingNew}
          encontroId={selectedEncontroId}
        />
      )}

      <ConfirmDialog
        isOpen={!!registroToDelete}
        title="Excluir Registro"
        message={
          <>
            Tem certeza que deseja excluir os dados do veículo de <strong>{registroToDelete?.participacoes?.pessoas?.nome_completo}</strong>?
            <br />Esta ação não pode ser desfeita.
          </>
        }
        onConfirm={confirmDelete}
        onCancel={() => setRegistroToDelete(null)}
        isLoading={isDeleting}
        isDestructive={true}
      />

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
        .badge-placa {
          display: inline-block;
          background-color: var(--primary-color);
          color: white;
          padding: 0.15rem 0.6rem;
          border-radius: 6px;
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.9rem;
          letter-spacing: 0.05em;
          box-shadow: 0 2px 4px rgba(var(--primary-rgb), 0.2);
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
