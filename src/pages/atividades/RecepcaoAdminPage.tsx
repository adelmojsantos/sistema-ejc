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
  Users,
  X
} from 'lucide-react';
import { WhatsappLogo } from 'phosphor-react';
import { useCallback, useEffect, useState, useMemo } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { RecepcaoDadosModal } from '../../components/coordenador/RecepcaoDadosModal';
import { GroupedDropdown, type GroupedDropdownItem } from '../../components/ui/GroupedDropdown';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { useAuth } from '../../hooks/useAuth';
import { useLoading } from '../../contexts/LoadingContext';
import { useEncontros } from '../../contexts/EncontroContext';
import { encontroService } from '../../services/encontroService';
import { recepcaoService } from '../../services/recepcaoService';
import type { Encontro } from '../../types/encontro';
import { formatPlate } from '../../utils/plateUtils';
import { formatPhone } from '../../utils/stringUtils';
import type { RecepcaoContato, RecepcaoContatosDupla, RecepcaoDados } from '../../types/recepcao';

const createWhatsAppLink = (phone: string) => `https://wa.me/55${phone.replace(/\D/g, '')}`;
const FILTER_ALL = 'all' as const;
const FILTER_ONLY_TEAMS = 'teams' as const;
const FILTER_ONLY_ENCONTRISTAS = 'encontristas' as const;
const TEAM_FILTER_PREFIX = 'team:' as const;
const DUPLA_FILTER_PREFIX = 'dupla:' as const;

type VinculoFilterValue =
  | typeof FILTER_ALL
  | typeof FILTER_ONLY_TEAMS
  | typeof FILTER_ONLY_ENCONTRISTAS
  | `${typeof TEAM_FILTER_PREFIX}${string}`
  | `${typeof DUPLA_FILTER_PREFIX}${string}`;

function ContactSection({ title, contatos }: { title: string; contatos: RecepcaoContato[] }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      <h4 style={{ margin: 0, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>
        {title}
      </h4>

      {contatos.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.55 }}>Nenhum contato encontrado.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {contatos.map((contato) => (
            <div
              key={`${contato.papel}-${contato.id}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
                padding: '0.75rem',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                background: 'var(--secondary-bg)',
                flexWrap: 'wrap'
              }}
            >
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{contato.nome}</div>
                <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                  {contato.telefone ? formatPhone(contato.telefone) : 'Telefone não informado'}
                </div>
              </div>

              {contato.telefone && (
                <a
                  href={createWhatsAppLink(contato.telefone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.75rem', color: '#10b981' }}
                >
                  <WhatsappLogo size={16} weight="fill" />
                  WhatsApp
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function RecepcaoAdminPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { setIsLoading: setGlobalLoading } = useLoading();

  const canChangeEncontro = hasPermission('modulo_admin');

  const { encontros, encontroAtivo } = useEncontros();
  const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');
  const [registros, setRegistros] = useState<RecepcaoDados[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 400);
  const [selectedVinculoFilter, setSelectedVinculoFilter] = useState<VinculoFilterValue>(FILTER_ALL);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedParticipacaoId, setSelectedParticipacaoId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Delete state
  const [registroToDelete, setRegistroToDelete] = useState<RecepcaoDados | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Visitação contacts state
  const [selectedDuplaRegistro, setSelectedDuplaRegistro] = useState<RecepcaoDados | null>(null);
  const [duplaContatos, setDuplaContatos] = useState<RecepcaoContatosDupla | null>(null);
  const [loadingDuplaContatos, setLoadingDuplaContatos] = useState(false);

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

  const handleOpenDuplaContacts = async (registro: RecepcaoDados) => {
    const grupoId = registro.visita_participacao?.grupo_id;
    if (!grupoId || !selectedEncontroId) return;

    setSelectedDuplaRegistro(registro);
    setDuplaContatos(null);
    setLoadingDuplaContatos(true);

    try {
      const contatos = await recepcaoService.listarContatosDupla(grupoId, selectedEncontroId);
      setDuplaContatos(contatos);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar contatos da visitação.');
    } finally {
      setLoadingDuplaContatos(false);
    }
  };

  const handleCloseDuplaContacts = () => {
    setSelectedDuplaRegistro(null);
    setDuplaContatos(null);
  };

  const equipesDisponiveis = useMemo(() => {
    const map = new Map<string, string>();
    registros.forEach(r => {
      const equipeId = r.participacoes?.equipe_id;
      const equipeNome = r.participacoes?.equipes?.nome;
      if (equipeId && equipeNome) map.set(equipeId, equipeNome);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [registros]);

  const duplasDisponiveis = useMemo(() => {
    const map = new Map<string, string>();
    registros.forEach(r => {
      const grupoId = r.visita_participacao?.grupo_id;
      const grupoNome = r.visita_participacao?.visita_grupos?.nome;
      if (grupoId && grupoNome) map.set(grupoId, grupoNome);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [registros]);

  const vinculoOptions = useMemo<GroupedDropdownItem<VinculoFilterValue>[]>(() => [
    { value: FILTER_ALL, label: 'Todos os registros' },
    {
      label: 'Equipes',
      defaultOpen: false,
      options: [
        { value: FILTER_ONLY_TEAMS, label: 'Somente equipes' },
        ...equipesDisponiveis.map(([id, nome]) => ({
          value: `${TEAM_FILTER_PREFIX}${id}` as VinculoFilterValue,
          label: nome
        }))
      ]
    },
    {
      label: 'Encontristas',
      defaultOpen: false,
      options: [
        { value: FILTER_ONLY_ENCONTRISTAS, label: 'Somente encontristas' },
        ...duplasDisponiveis.map(([id, nome]) => ({
          value: `${DUPLA_FILTER_PREFIX}${id}` as VinculoFilterValue,
          label: `Visitação - ${nome}`
        }))
      ]
    }
  ], [duplasDisponiveis, equipesDisponiveis]);

  const filteredRegistros = useMemo(() => {
    const term = debouncedSearch.toLowerCase().trim();

    let filtered = registros;

    if (selectedVinculoFilter === FILTER_ONLY_TEAMS) {
      filtered = filtered.filter(r => !!r.participacoes?.equipe_id && !r.participacoes?.participante);
    } else if (selectedVinculoFilter === FILTER_ONLY_ENCONTRISTAS) {
      filtered = filtered.filter(r => !!r.participacoes?.participante);
    } else if (selectedVinculoFilter.startsWith(TEAM_FILTER_PREFIX)) {
      const equipeId = selectedVinculoFilter.slice(TEAM_FILTER_PREFIX.length);
      filtered = filtered.filter(r => r.participacoes?.equipe_id === equipeId);
    } else if (selectedVinculoFilter.startsWith(DUPLA_FILTER_PREFIX)) {
      const grupoId = selectedVinculoFilter.slice(DUPLA_FILTER_PREFIX.length);
      filtered = filtered.filter(r => !!r.participacoes?.participante && r.visita_participacao?.grupo_id === grupoId);
    }

    if (term) {
      filtered = filtered.filter(r => {
        const nome = r.participacoes?.pessoas?.nome_completo?.toLowerCase() || '';
        const equipe = r.participacoes?.equipes?.nome?.toLowerCase() || '';
        const dupla = r.visita_participacao?.visita_grupos?.nome?.toLowerCase() || '';
        const placa = r.veiculo_placa?.toLowerCase() || '';
        const modelo = r.veiculo_modelo?.toLowerCase() || '';
        return nome.includes(term) || equipe.includes(term) || dupla.includes(term) || placa.includes(term) || modelo.includes(term);
      });
    }

    return [...filtered].sort((a, b) => {
      const nomeA = a.participacoes?.pessoas?.nome_completo || '';
      const nomeB = b.participacoes?.pessoas?.nome_completo || '';
      return nomeA.localeCompare(nomeB);
    });
  }, [registros, debouncedSearch, selectedVinculoFilter]);

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
        <div className="grid-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Encontro</label>
            <LiveSearchSelect<Encontro>
              value={selectedEncontroId}
              onChange={(val) => { setSelectedEncontroId(val); setSelectedVinculoFilter(FILTER_ALL); }}
              fetchData={async (search, page) => await encontroService.buscarComPaginacao(search, page)}
              getOptionLabel={(e) => `${e.nome} ${e.ativo ? '(Ativo)' : ''}`}
              getOptionValue={(e) => String(e.id)}
              placeholder="Selecionar encontro..."
              initialOptions={encontros}
              disabled={!canChangeEncontro}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Vínculo</label>
            <div className="form-input-wrapper">
              <GroupedDropdown<VinculoFilterValue>
                value={selectedVinculoFilter}
                onChange={setSelectedVinculoFilter}
                items={vinculoOptions}
                ariaLabel="Filtro de vínculo"
              />
            </div>
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
                placeholder="Nome, placa, modelo..."
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-bg)', padding: '0.75rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
        {selectedVinculoFilter !== FILTER_ALL || debouncedSearch.trim() ? (
          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.65 }}>
            <strong>{filteredRegistros.length}</strong> registro(s) encontrado(s)
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.65 }}>
            {registros.length} registro(s) cadastrado(s)
          </p>
        )}
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
          {filteredRegistros.map((reg) => {
            const isEncontrista = !!reg.participacoes?.participante;
            return (
            <div
              key={reg.id}
              className={`card animate-fade-in hover-card${isEncontrista ? ' recepcao-card-encontrista' : ''}`}
              style={{ padding: 0, overflow: 'hidden' }}
            >
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
                      {isEncontrista ? (
                        <span className="recepcao-encontrista-badge">Encontrista</span>
                      ) : (
                        <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6 }}>{reg.participacoes?.equipes?.nome || 'Sem equipe'}</p>
                      )}
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
                    {(() => {
                      const formatted = formatPlate(reg.veiculo_placa);
                      const isMercosul = !formatted.includes('-');
                      return (
                        <div
                          className="badge-placa"
                          style={{ letterSpacing: isMercosul ? '0.15em' : '0.05em' }}
                        >
                          {formatted}
                        </div>
                      );
                    })()}
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
                  {reg.visita_participacao?.visita_grupos?.nome && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '120px' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.4, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Users size={14} /> Visitação
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenDuplaContacts(reg)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          padding: 0,
                          color: 'var(--primary-color)',
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          textAlign: 'left',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          textUnderlineOffset: '3px'
                        }}
                        title="Ver contatos da visitação"
                      >
                        {reg.visita_participacao.visita_grupos.nome}
                      </button>
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
          );
          })}
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

      {selectedDuplaRegistro && (
        <div className="modal-overlay" onClick={handleCloseDuplaContacts}>
          <div
            className="modal-content card"
            style={{ maxWidth: '520px', width: '100%', padding: 0, overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Contatos da Visitação</h3>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', opacity: 0.65 }}>
                  {selectedDuplaRegistro.visita_participacao?.visita_grupos?.nome || 'Visitação'}
                </p>
              </div>
              <button type="button" onClick={handleCloseDuplaContacts} className="icon-btn" title="Fechar">
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {loadingDuplaContatos ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                  <Loader className="animate-spin" size={24} />
                </div>
              ) : (
                <>
                  <ContactSection title="Visitantes da visitação" contatos={duplaContatos?.visitantes || []} />
                  <ContactSection title="Coordenação da visitação" contatos={duplaContatos?.coordenadores || []} />
                </>
              )}
            </div>
          </div>
        </div>
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
        .recepcao-card-encontrista {
          border-left: 5px solid #10b981 !important;
          border-color: rgba(16, 185, 129, 0.28) !important;
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, var(--card-bg) 58%);
        }
        .recepcao-encontrista-badge {
          display: inline-flex;
          align-items: center;
          padding: 0.18rem 0.5rem;
          border-radius: 999px;
          background: rgba(16, 185, 129, 0.12);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.28);
          font-size: 0.72rem;
          font-weight: 800;
          line-height: 1.2;
        }
        .hover-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.1);
          border-color: rgba(var(--primary-rgb), 0.3);
        }
        .badge-placa {
          display: inline-block;
          background-color: #2563eb;
          color: white;
          padding: 0.15rem 0.6rem;
          border-radius: 6px;
          font-weight: 600;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 0.95rem;
          text-transform: uppercase;
          box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);
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
