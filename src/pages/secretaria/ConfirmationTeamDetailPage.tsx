import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { inscricaoService } from '../../services/inscricaoService';
import { equipeService } from '../../services/equipeService';
import { pessoaService } from '../../services/pessoaService';
import { useEncontros } from '../../contexts/EncontroContext';
import type { InscricaoEnriched } from '../../types/inscricao';
import type { Pessoa, PessoaFormData } from '../../types/pessoa';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Users,
  Phone,
  Mail,
  MapPin,
  Pencil,
  Check,
  Loader,
  Car,
  Baby,
  Trash2,
} from 'lucide-react';
import { RecepcaoDadosModal } from '../../components/coordenador/RecepcaoDadosModal';
import { RecreacaoDadosModal } from '../../components/coordenador/RecreacaoDadosModal';
import { recepcaoService } from '../../services/recepcaoService';
import { formatPlate } from '../../utils/plateUtils';
import type { RecreacaoDados } from '../../types/recreacao';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { toast } from 'react-hot-toast';
import { Modal as _Modal } from '../../components/ui/Modal';
import { PessoaForm } from '../../components/pessoa/PessoaForm';
import { useAuth } from '../../hooks/useAuth';
import { validatePessoaForConfirmation } from '../../utils/pessoaValidation';

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(n => n.length > 2)
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatTelefone(tel: string | null | undefined) {
  if (!tel) return '—';
  const d = tel.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel;
}

export function ConfirmationTeamDetailPage() {
  const navigate = useNavigate();
  const { equipe_id } = useParams<{ equipe_id: string }>();
  const location = useLocation();
  const { user } = useAuth();

  // O encontroId vem via route state (passado pelo navigate da página de listagem)
  // Caso acesso direto pela URL: busca o encontro ativo como fallback
  const [encontroId, setEncontroId] = useState<string>(
    (location.state as any)?.encontroId || ''
  );
  const [equipeNome, setEquipeNome] = useState<string>('');
  const [participacoes, setParticipacoes] = useState<InscricaoEnriched[]>([]);
  const [isTeamConfirmed, setIsTeamConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [editingPessoa, setEditingPessoa] = useState<Pessoa | null>(null);
  const [finalizeModal, setFinalizeModal] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [activeTeamFilter, setActiveTeamFilter] = useState<'all' | 'confirmed' | 'pending'>('all');
  const [recepcaoParticipacaoId, setRecepcaoParticipacaoId] = useState<string | null>(null);
  const [recepcaoParticipanteNome, setRecepcaoParticipanteNome] = useState<string>('');
  const [recreacaoParticipacaoId, setRecreacaoParticipacaoId] = useState<string | null>(null);
  const [recreacaoParticipanteNome, setRecreacaoParticipanteNome] = useState<string>('');

  // Resolve encontroId caso acesso direto pela URL (sem route state), usando o contexto
  const { encontroAtivo } = useEncontros();
  useEffect(() => {
    if (encontroId) return;
    if (encontroAtivo) {
      setEncontroId(encontroAtivo.id);
    }
  }, [encontroId, encontroAtivo]);

  const loadData = async () => {
    if (!equipe_id || !encontroId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [parts, conf, equipe] = await Promise.all([
        inscricaoService.listarPorEquipeEEncontro(equipe_id, encontroId),
        equipeService.obterConfirmacao(equipe_id, encontroId),
        equipeService.buscarPorId(equipe_id),
      ]);

      setParticipacoes(parts);
      setIsTeamConfirmed(!!conf);
      setEquipeNome(equipe?.nome || 'Equipe');
    } catch {
      toast.error('Erro ao carregar dados da equipe.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipe_id, encontroId]);

  // ─── Stats locais ──────────────────────────────────────────────
  const teamStats = useMemo(() => {
    const all = participacoes.filter(p => !!p.pessoas);
    const confirmed = all.filter(p => p.dados_confirmados).length;
    return { total: all.length, confirmed, pending: all.length - confirmed };
  }, [participacoes]);

  const allConfirmed = teamStats.total > 0 && teamStats.confirmed === teamStats.total;

  // ─── Lista filtrada ─────────────────────────────────────────────
  const filteredParts = useMemo(() => {
    return participacoes
      .filter((p): p is InscricaoEnriched & { pessoas: Pessoa } => !!p.pessoas)
      .filter(p => {
        if (activeTeamFilter === 'confirmed') return p.dados_confirmados;
        if (activeTeamFilter === 'pending') return !p.dados_confirmados;
        return true;
      })
      .sort((a, b) => {
        if (a.coordenador && !b.coordenador) return -1;
        if (!a.coordenador && b.coordenador) return 1;
        return a.pessoas.nome_completo.localeCompare(b.pessoas.nome_completo);
      });
  }, [participacoes, activeTeamFilter]);

  // ─── Confirmar integrante individual ────────────────────────────
  const handleConfirmOneMember = async (memberId: string) => {
    const member = participacoes.find(p => p.id === memberId);
    if (!member) return;

    if (member.pessoas) {
      const validation = validatePessoaForConfirmation(member.pessoas);
      if (!validation.isValid) {
        toast.error(
          `Para confirmar, preencha: ${validation.missingFields.join(', ')}`,
          { duration: 5000, icon: '⚠️' }
        );
        return;
      }
    }

    setIsActionLoading(true);
    try {
      await inscricaoService.confirmarDados(memberId);
      toast.success('Integrante confirmado!');

      // Atualiza localmente para não recarregar tudo
      setParticipacoes(prev =>
        prev.map(p => p.id === memberId ? { ...p, dados_confirmados: true } : p)
      );

      // Verifica se agora todos estão confirmados
      const updatedAll = participacoes.map(p => p.id === memberId ? { ...p, dados_confirmados: true } : p);
      const updatedConfirmed = updatedAll.filter(p => !!p.pessoas && p.dados_confirmados).length;
      const updatedTotal = updatedAll.filter(p => !!p.pessoas).length;

      if (updatedTotal > 0 && updatedConfirmed === updatedTotal && !isTeamConfirmed) {
        setFinalizeModal(true);
      }
    } catch {
      toast.error('Erro ao confirmar integrante.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // ─── Salvar edição de pessoa ─────────────────────────────────────
  const handleEditSubmit = async (data: PessoaFormData, shouldConfirm: boolean) => {
    if (!editingPessoa?.id) {
      toast.error('Erro: ID do integrante não encontrado.');
      return;
    }
    setIsActionLoading(true);
    try {
      const participacao = participacoes.find(p => p.pessoa_id === editingPessoa.id);

      await pessoaService.atualizar(editingPessoa.id, data);

      // Atualiza dados locais da pessoa
      setParticipacoes(prev => prev.map(p => {
        if (p.pessoa_id !== editingPessoa.id) return p;
        return { ...p, pessoas: { ...p.pessoas, ...data } as Pessoa };
      }));

      if (participacao && shouldConfirm) {
        await inscricaoService.confirmarDados(participacao.id);
        toast.success('Dados salvos e confirmados!');

        // Atualiza confirmação local
        setParticipacoes(prev =>
          prev.map(p => p.id === participacao.id ? { ...p, dados_confirmados: true } : p)
        );

        // Verifica se todos foram confirmados agora
        const updatedAll = participacoes.map(p =>
          p.id === participacao.id ? { ...p, dados_confirmados: true } : p
        );
        const updatedConfirmed = updatedAll.filter(p => !!p.pessoas && p.dados_confirmados).length;
        const updatedTotal = updatedAll.filter(p => !!p.pessoas).length;

        if (updatedTotal > 0 && updatedConfirmed === updatedTotal && !isTeamConfirmed) {
          setFinalizeModal(true);
        }
      } else {
        toast.success('Dados salvos!');
      }

      setEditingPessoa(null);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar alterações.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // ─── Finalizar equipe ────────────────────────────────────────────
  const handleFinalizeTeam = async () => {
    if (!equipe_id || !encontroId || !user?.id) return;
    setIsFinalizing(true);
    try {
      await equipeService.confirmarEquipe(equipe_id, encontroId, user.id);
      toast.success(`Equipe ${equipeNome} finalizada com sucesso!`);
      setIsTeamConfirmed(true);
      setFinalizeModal(false);
    } catch (error) {
      console.error('Erro ao finalizar equipe:', error);
      toast.error('Erro ao finalizar equipe.');
    } finally {
      setIsFinalizing(false);
    }
  };

  // ─── Tela de edição ─────────────────────────────────────────────
  if (editingPessoa) {
    return (
      <div className="fade-in">
        <div className="page-header" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={() => setEditingPessoa(null)} className="icon-btn" aria-label="Voltar">
              <ChevronLeft size={20} />
            </button>
            <div>
              <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55, fontWeight: 600, textTransform: 'uppercase' }}>Editando Integrante</p>
              <h1 className="page-title text-gradient" style={{ margin: 0, fontSize: '1.5rem' }}>{editingPessoa.nome_completo}</h1>
            </div>
          </div>
        </div>
        <div className="card shadow-sm animate-fade-in">
          <PessoaForm
            initialData={editingPessoa}
            onSubmit={handleEditSubmit}
            onCancel={() => setEditingPessoa(null)}
            isLoading={isActionLoading}
            isConfirmationContext={true}
          />
        </div>
      </div>
    );
  }

  // ─── Tela de detalhe da equipe ───────────────────────────────────
  return (
    <div className="fade-in">
      {/* Cabeçalho */}
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => navigate('/secretaria/confirmacoes', { state: { encontroId } })}
            className="icon-btn"
            aria-label="Voltar"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55, fontWeight: 600, textTransform: 'uppercase' }}>Equipe</p>
            <h1 className="page-title text-gradient" style={{ margin: 0, fontSize: '1.75rem' }}>
              {isLoading ? 'Carregando...' : equipeNome}
            </h1>
          </div>
        </div>

        {!isLoading && !isTeamConfirmed && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => {
                if (!allConfirmed) {
                  toast.error('Todos os integrantes devem ser confirmados individualmente antes da finalização.');
                  return;
                }
                setFinalizeModal(true);
              }}
              disabled={isActionLoading}
              className="btn-primary flex items-center gap-2"
              style={{
                fontSize: '0.85rem',
                padding: '0.5rem 1rem',
                backgroundColor: allConfirmed ? '#10b981' : '#cbd5e1',
                borderColor: allConfirmed ? '#10b981' : '#cbd5e1',
                cursor: allConfirmed ? 'pointer' : 'not-allowed'
              }}
            >
              {isActionLoading ? <Loader className="animate-spin" size={16} /> : <CheckCircle size={16} />}
              <span>Finalizar Equipe</span>
            </button>
          </div>
        )}

        {!isLoading && isTeamConfirmed && (
          <span style={{
            padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700,
            backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)'
          }}>
            ✓ EQUIPE FINALIZADA
          </span>
        )}
      </div>

      {/* Stats da equipe */}
      {!isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {/* Total */}
          <div
            onClick={() => setActiveTeamFilter('all')}
            className="card"
            style={{
              padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer',
              border: activeTeamFilter === 'all' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
              transform: activeTeamFilter === 'all' ? 'translateY(-2px)' : 'none',
              transition: 'all 0.2s', position: 'relative'
            }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(37, 99, 235, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)' }}>
              <Users size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>{teamStats.total}</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: 600, textTransform: 'uppercase' }}>Total</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: 'var(--primary-color)', fontSize: '0.65rem', fontWeight: 700, opacity: 0.7 }}>
              <span>FILTRAR</span><ChevronRight size={10} />
            </div>
          </div>

          {/* Confirmados */}
          <div
            onClick={() => setActiveTeamFilter('confirmed')}
            className="card"
            style={{
              padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer',
              border: activeTeamFilter === 'confirmed' ? '2px solid #10b981' : '1px solid var(--border-color)',
              transform: activeTeamFilter === 'confirmed' ? 'translateY(-2px)' : 'none',
              transition: 'all 0.2s', position: 'relative'
            }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
              <CheckCircle size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>{teamStats.confirmed}</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: 600, textTransform: 'uppercase' }}>Confirmados</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#10b981', fontSize: '0.65rem', fontWeight: 700, opacity: 0.7 }}>
              <span>FILTRAR</span><ChevronRight size={10} />
            </div>
          </div>

          {/* Pendentes */}
          <div
            onClick={() => setActiveTeamFilter('pending')}
            className="card"
            style={{
              padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer',
              border: activeTeamFilter === 'pending' ? '2px solid #f59e0b' : '1px solid var(--border-color)',
              transform: activeTeamFilter === 'pending' ? 'translateY(-2px)' : 'none',
              transition: 'all 0.2s', position: 'relative'
            }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
              <AlertCircle size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>{teamStats.pending}</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: 600, textTransform: 'uppercase' }}>Pendentes</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#f59e0b', fontSize: '0.65rem', fontWeight: 700, opacity: 0.7 }}>
              <span>FILTRAR</span><ChevronRight size={10} />
            </div>
          </div>
        </div>
      )}

      {/* Lista de integrantes */}
      {isLoading ? (
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '2.5rem', opacity: 0.6 }}>
          <Loader className="animate-spin" size={20} />
          <span>Carregando integrantes...</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredParts.length === 0 ? (
            <div className="card empty-state">
              <Users size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
              <p>Nenhum integrante encontrado.</p>
            </div>
          ) : (
            filteredParts.map((p) => (
              <div
                key={p.id}
                className="card animate-fade-in"
                style={{
                  padding: '1.25rem',
                  borderLeft: p.coordenador ? '4px solid #f59e0b' : '1px solid var(--border-color)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '12px',
                      backgroundColor: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary-color)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem'
                    }}>
                      {getInitials(p.pessoas.nome_completo)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{p.pessoas.nome_completo}</h3>
                        {p.coordenador && (
                          <span className="badge" style={{ fontSize: '0.6rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', fontWeight: 800 }}>COORDENADOR</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', fontSize: '0.85rem', opacity: 0.7, flexWrap: 'wrap', minWidth: 0 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <Phone size={14} style={{ flexShrink: 0 }} /> {formatTelefone(p.pessoas.telefone)}
                        </span>
                        {p.pessoas.email && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.pessoas.email}>
                            <Mail size={14} style={{ flexShrink: 0 }} /> {p.pessoas.email}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.25rem', fontSize: '0.85rem', opacity: 0.6, minWidth: 0 }}>
                        <MapPin size={14} style={{ flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {[p.pessoas.endereco, p.pessoas.numero, p.pessoas.bairro, p.pessoas.cidade].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    {p.dados_confirmados ? (
                      <div
                        className="btn-icon"
                        style={{
                          backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981',
                          border: '1px solid rgba(16, 185, 129, 0.2)',
                          width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default'
                        }}
                        title="Dados Confirmados"
                      >
                        <CheckCircle size={18} style={{ flexShrink: 0 }} />
                      </div>
                    ) : (
                      <button
                        onClick={() => handleConfirmOneMember(p.id)}
                        disabled={isActionLoading || isTeamConfirmed}
                        className="btn-icon"
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.03)', color: 'var(--text-color)',
                          border: '1px solid var(--border-color)', opacity: isTeamConfirmed ? 0.3 : 0.5,
                          width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                        title="Confirmar integrante"
                      >
                        <Check size={18} style={{ flexShrink: 0 }} />
                      </button>
                    )}
                    <button
                      onClick={() => setEditingPessoa(p.pessoas)}
                      className="btn-icon"
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)',
                        width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--text-color)'
                      }}
                      title="Editar Dados"
                    >
                      <Pencil size={18} style={{ flexShrink: 0 }} />
                    </button>
                  </div>
                </div>

                {/* Seções de Recepção e Recreação (Novas) */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: window.innerWidth < 768 ? '1fr' : '1fr 1fr',
                  gap: '1.25rem',
                  marginTop: '1.25rem',
                  paddingTop: '1.25rem',
                  borderTop: '1px solid var(--border-color)'
                }}>
                  {/* Recepção Section */}
                  <div style={{
                    padding: '1rem',
                    backgroundColor: 'var(--surface-2, rgba(0,0,0,0.02))',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    minHeight: '120px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', opacity: 0.5, letterSpacing: '0.05em' }}>
                        Recepção
                      </div>
                      <button
                        onClick={() => {
                          setRecepcaoParticipacaoId(p.id);
                          setRecepcaoParticipanteNome(p.pessoas.nome_completo || '');
                        }}
                        className="btn-text"
                        style={{
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.6rem',
                          fontWeight: 600,
                          color: 'var(--primary-color)',
                          letterSpacing: '0.05em',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Car size={16} />
                          {p.recepcao_dados ? 'EDITAR' : 'CADASTRAR'}
                        </div>
                      </button>
                    </div>

                    {!p.recepcao_dados ? (
                      <div style={{ height: '32px', display: 'flex', alignItems: 'center', fontSize: '0.8rem', opacity: 0.4, fontStyle: 'italic' }}>
                        Não cadastrado
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ textAlign: 'left', opacity: 0.5 }}>
                              <th style={{ padding: '0.35rem 0.25rem', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem' }}>Veículo</th>
                              <th style={{ padding: '0.35rem 0.25rem', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem' }}>Placa</th>
                              <th style={{ width: '30px' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                              <td style={{ padding: '0.4rem 0.25rem', fontWeight: 600 }}>{p.recepcao_dados.veiculo_modelo} ({p.recepcao_dados.veiculo_cor})</td>
                              <td style={{ padding: '0.4rem 0.25rem' }}>{formatPlate(p.recepcao_dados.veiculo_placa)}</td>
                              <td style={{ padding: '0.25rem', textAlign: 'right' }}>
                                <button
                                  onClick={async () => {
                                    if (window.confirm(`Deseja remover o veículo de ${p.pessoas.nome_completo}?`)) {
                                      try {
                                        await recepcaoService.excluir(p.recepcao_dados!.id);
                                        toast.success('Veículo removido!');
                                        loadData();
                                      } catch (e) {
                                        toast.error('Erro ao remover veículo');
                                      }
                                    }
                                  }}
                                  style={{ background: 'none', border: 'none', color: '#ef4444', opacity: 0.5, cursor: 'pointer', padding: '0.25rem' }}
                                  title="Remover Veículo"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Recreação Section */}
                  <div style={{
                    padding: '1rem',
                    backgroundColor: 'rgba(var(--primary-rgb), 0.02)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    minHeight: '120px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', opacity: 0.5, letterSpacing: '0.05em' }}>
                        Recreação
                      </div>
                      <button
                        onClick={() => {
                          setRecreacaoParticipacaoId(p.id);
                          setRecreacaoParticipanteNome(p.pessoas.nome_completo || '');
                        }}
                        className="btn-text"
                        style={{
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.6rem',
                          fontWeight: 600,
                          color: 'var(--primary-color)',
                          letterSpacing: '0.05em',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Baby size={16} />
                          {p.recreacao_dados && p.recreacao_dados.length > 0 ? (
                            'GERENCIAR'
                          ) : (
                            'CADASTRAR'
                          )}
                        </div>
                      </button>
                    </div>

                    {!p.recreacao_dados || p.recreacao_dados.length === 0 ? (
                      <div style={{ height: '32px', display: 'flex', alignItems: 'center', fontSize: '0.8rem', opacity: 0.4, fontStyle: 'italic' }}>
                        Não cadastrado
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: '0.7rem', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ textAlign: 'left', opacity: 0.5 }}>
                              <th style={{ padding: '0.35rem 0.25rem', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.6rem' }}>Criança</th>
                              <th style={{ padding: '0.35rem 0.25rem', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.6rem' }}>Idade</th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.recreacao_dados.map((c: RecreacaoDados) => (
                              <tr key={c.id} style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                                <td style={{ padding: '0.4rem 0.25rem', fontWeight: 600 }}>{c.nome_crianca}</td>
                                <td style={{ padding: '0.4rem 0.25rem' }}>{c.idade}a</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal de finalização da equipe */}
      <ConfirmDialog
        isOpen={finalizeModal}
        title="Finalizar Confirmação da Equipe"
        message={`Todos os integrantes da equipe "${equipeNome}" foram confirmados! Deseja finalizar a confirmação desta equipe agora?`}
        onConfirm={handleFinalizeTeam}
        onCancel={() => setFinalizeModal(false)}
        confirmText="Finalizar Equipe"
        isLoading={isFinalizing}
      />

      <RecepcaoDadosModal
        isOpen={!!recepcaoParticipacaoId}
        onClose={() => {
          setRecepcaoParticipacaoId(null);
          loadData();
        }}
        participacaoId={recepcaoParticipacaoId || ''}
        participanteNome={recepcaoParticipanteNome}
        equipeNome={equipeNome}
      />

      <RecreacaoDadosModal
        isOpen={!!recreacaoParticipacaoId}
        onClose={() => {
          setRecreacaoParticipacaoId(null);
          loadData();
        }}
        participacaoId={recreacaoParticipacaoId || ''}
        participanteNome={recreacaoParticipanteNome}
        encontroId={encontroId}
      />
    </div>
  );
}
