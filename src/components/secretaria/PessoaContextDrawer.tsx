import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Banknote,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  MapPin,
  Pencil,
  Phone,
  User,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import type { InscricaoEnriched } from '../../types/inscricao';
import { carregarPessoaContexto } from '../../services/pessoaContextService';
import { FINANCE_ROUTE_PERMISSIONS, SHIRT_ROUTE_PERMISSIONS, hasAnyPermission } from '../../utils/accessControl';
import { VISITATION_COORDINATION_PERMISSIONS } from '../../config/navigation';
import { formatTelefone } from '../../utils/cpfUtils';
import './PessoaContextDrawer.css';

interface PessoaContextDrawerProps {
  participacaoId: string | null;
  encontroId: string | null;
  onClose: () => void;
  /** Edição explícita e sem confirmação; habilitada pela tela que abriu a gaveta. */
  canEditPessoa?: boolean;
  onEditPessoa?: (pessoaId: string) => void;
}

const CIRCLE_PERMISSIONS = [
  'modulo_circulos',
  'modulo_circulos_cadastros',
  'modulo_circulos_coordenador',
  'modulo_admin',
] as const;

function statusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    pendente: 'Pendente',
    realizada: 'Realizada',
    ausente: 'Ausente — revisitar',
    cancelada: 'Cancelada',
  };
  return labels[status ?? ''] ?? 'Sem status';
}

function ContextStatus({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'success' | 'warning' | 'danger' | 'neutral';
}) {
  return (
    <div className="pessoa-context-status">
      <span>{label}</span>
      <strong className={`is-${tone}`}>{value}</strong>
    </div>
  );
}

export function PessoaContextDrawer({
  participacaoId,
  encontroId,
  onClose,
  canEditPessoa = false,
  onEditPessoa,
}: PessoaContextDrawerProps) {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [participacao, setParticipacao] = useState<InscricaoEnriched | null>(null);

  useEffect(() => {
    let cancelled = false;
    setParticipacao(null);
    if (!participacaoId || !encontroId) return;

    carregarPessoaContexto(participacaoId, encontroId)
      .then((data) => {
        if (!cancelled) setParticipacao(data);
      })
      .catch((error) => {
        console.error('Erro ao carregar resumo contextual:', error);
        if (!cancelled) setParticipacao(null);
      });

    return () => { cancelled = true; };
  }, [participacaoId, encontroId]);

  useEffect(() => {
    if (!participacaoId || !encontroId) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose, participacaoId, encontroId]);

  const visita = useMemo(() => {
    if (!participacao) return null;
    const expectedVisitorFlag = participacao.participante ? false : true;
    return participacao.visita_participacao?.find((item) => item.visitante === expectedVisitorFlag)
      ?? participacao.visita_participacao?.[0]
      ?? null;
  }, [participacao]);

  if (!participacao) return null;

  const pessoa = participacao.pessoas;
  const isEncontrista = participacao.participante === true;
  const recepcao = Array.isArray(participacao.recepcao_dados)
    ? participacao.recepcao_dados[0] ?? null
    : participacao.recepcao_dados ?? null;
  const recreacao = Array.from(new Map(
    [...(participacao.recreacao_dados ?? []), ...(participacao.recreacao_dados_secundario ?? [])]
      .map((item) => [item.id, item])
  ).values());
  const otherModuleCount = (recepcao ? 1 : 0) + (recreacao.length > 0 && !isEncontrista ? 1 : 0);
  const circulo = participacao.circulo_participacao?.[0]?.circulos?.nome ?? null;
  const camisetaQuantidade = participacao.camiseta_pedidos?.reduce(
    (total, pedido) => total + (pedido.quantidade || 0),
    0
  ) ?? 0;
  const canOpenFinance = hasAnyPermission(hasPermission, FINANCE_ROUTE_PERMISSIONS);
  const canOpenShirts = hasAnyPermission(hasPermission, SHIRT_ROUTE_PERMISSIONS);
  const canOpenRecreacao = hasPermission('modulo_recreacao') || hasPermission('modulo_admin');
  const canOpenVisitacao = hasAnyPermission(hasPermission, VISITATION_COORDINATION_PERMISSIONS);
  const canOpenCircles = hasAnyPermission(hasPermission, CIRCLE_PERMISSIONS);
  const hasShirtOrder = camisetaQuantidade > 0;
  // Círculo e dupla visitante são vínculos do encontrista (a pessoa visitada).
  // Um encontreiro pode ter registros operacionais de Visitação, mas isso não
  // significa que esses módulos façam parte do seu resumo pessoal.
  const showCircle = isEncontrista && participacao.circulo_participacao !== undefined;
  const showVisitacao = isEncontrista && participacao.visita_participacao !== undefined;

  const goTo = (path: string) => {
    onClose();
    navigate(path);
  };

  return createPortal(
    <div className="pessoa-context-layer" role="presentation">
      <button
        type="button"
        className="pessoa-context-backdrop"
        onClick={onClose}
        aria-label="Fechar visualização da pessoa"
      />
      <aside
        className="pessoa-context-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pessoa-context-title"
      >
        <header className="pessoa-context-header">
          <div className="pessoa-context-avatar" aria-hidden="true">
            {participacao.foto_url ? (
              <img src={participacao.foto_url} alt="" />
            ) : (
              <User size={24} />
            )}
          </div>
          <div>
            <span>{isEncontrista ? 'Encontrista' : 'Encontreiro'}</span>
            <h2 id="pessoa-context-title">{pessoa?.nome_completo || 'Nome não informado'}</h2>
            <p>
              {participacao.equipes?.nome || 'Sem equipe'}
              {participacao.coordenador ? ' · Coordenador(a)' : ''}
            </p>
          </div>
          <button type="button" className="pessoa-context-close" onClick={onClose} aria-label="Fechar" autoFocus>
            <X size={20} />
          </button>
        </header>

        <div className="pessoa-context-body">
          {canEditPessoa && pessoa?.id && onEditPessoa && (
            <button
              type="button"
              className="pessoa-context-edit"
              onClick={() => {
                onClose();
                onEditPessoa(pessoa.id);
              }}
            >
              <Pencil size={16} /> Editar dados
            </button>
          )}
          <section className="pessoa-context-section">
            <h3><User size={17} /> Identificação</h3>
            <div className="pessoa-context-contact">
              <div>
                <Phone size={15} />
                <span>{formatTelefone(pessoa?.telefone)}</span>
              </div>
              {pessoa?.email && <span>{pessoa.email}</span>}
              {pessoa?.comunidade && <span>{pessoa.comunidade}</span>}
            </div>
          </section>

          {!isEncontrista && (
          <section className="pessoa-context-section">
            <h3><ClipboardCheck size={17} /> Equipe e atuação</h3>
            <div className="pessoa-context-status-grid">
              <ContextStatus
                label="Dados cadastrais"
                value={participacao.dados_confirmados === null ? 'Não informado neste módulo' : participacao.dados_confirmados ? 'Confirmados' : 'Aguardando confirmação'}
                tone={participacao.dados_confirmados === null ? 'neutral' : participacao.dados_confirmados ? 'success' : 'warning'}
              />
              <ContextStatus label="Equipe de trabalho" value={participacao.equipes?.nome || 'Sem equipe'} />
            </div>
            {participacao.equipe_id && (
              <button
                type="button"
                className="pessoa-context-link"
                onClick={() => goTo(`/secretaria/confirmacoes/${participacao.equipe_id}`)}
              >
                Abrir confirmação da equipe <ChevronRight size={16} />
              </button>
            )}
          </section>
          )}

          <section className="pessoa-context-section">
            <h3><Banknote size={17} /> Financeiro</h3>
            <div className={`pessoa-context-status-grid ${hasShirtOrder ? '' : 'is-single'}`}>
              <ContextStatus
                label="Taxa"
                value={participacao.pago_taxa ? 'Paga' : 'Pendente'}
                tone={participacao.pago_taxa ? 'success' : 'warning'}
              />
              {hasShirtOrder && (
                <ContextStatus
                  label="Camiseta"
                  value={`${camisetaQuantidade} ${camisetaQuantidade === 1 ? 'pedido' : 'pedidos'} · ${participacao.pago_camiseta ? 'pago' : 'pendente'}`}
                  tone={!participacao.pago_camiseta ? 'warning' : 'neutral'}
                />
              )}
            </div>
            {(canOpenFinance || (canOpenShirts && hasShirtOrder)) && (
              <div className="pessoa-context-actions">
                {canOpenFinance && (
                  <button
                    type="button"
                    className="pessoa-context-link"
                    onClick={() => goTo(`/compras/taxas?encontro=${participacao.encontro_id}&tipo=${isEncontrista ? 'encontrista' : 'encontreiro'}&busca=${encodeURIComponent(pessoa?.nome_completo || '')}`)}
                  >
                    Ver taxas <ChevronRight size={16} />
                  </button>
                )}
                {canOpenShirts && hasShirtOrder && (
                  <button
                    type="button"
                    className="pessoa-context-link"
                    onClick={() => goTo(`/compras/camisetas?encontro=${participacao.encontro_id}&busca=${encodeURIComponent(pessoa?.nome_completo || '')}`)}
                  >
                    Ver camisetas <ChevronRight size={16} />
                  </button>
                )}
              </div>
            )}
          </section>

          {showCircle && (
            <section className="pessoa-context-section">
              <h3><CircleDot size={17} /> Círculo</h3>
              <ContextStatus
                label="Vínculo"
                value={circulo || 'Pendente'}
                tone={isEncontrista && !circulo ? 'warning' : 'neutral'}
              />
              {canOpenCircles && (
                <button type="button" className="pessoa-context-link" onClick={() => goTo('/circulos/montagem')}>
                  Abrir montagem de círculos <ChevronRight size={16} />
                </button>
              )}
            </section>
          )}

          {showVisitacao && (
            <section className="pessoa-context-section">
              <h3><MapPin size={17} /> Visitação</h3>
              <div className="pessoa-context-status-grid">
                <ContextStatus
                  label={isEncontrista ? 'Dupla visitante' : 'Dupla de visitação'}
                  value={visita?.visita_grupos?.nome || 'Pendente'}
                  tone={visita ? 'neutral' : 'warning'}
                />
                {isEncontrista && visita && (
                  <ContextStatus
                    label="Visita"
                    value={statusLabel(visita.status)}
                    tone={visita.status === 'realizada' ? 'success' : visita.status === 'ausente' ? 'warning' : 'neutral'}
                  />
                )}
              </div>
              {canOpenVisitacao && (
                <button
                  type="button"
                  className="pessoa-context-link"
                  onClick={() => goTo(visita?.id ? `/visitacao/manutencao/${visita.id}` : '/visitacao/coordenador')}
                >
                  Abrir na Visitação <ChevronRight size={16} />
                </button>
              )}
            </section>
          )}

          {(recepcao || (!isEncontrista && recreacao.length > 0)) && (
            <section className="pessoa-context-section">
              <h3><CheckCircle2 size={17} /> Outros módulos</h3>
              <div className={`pessoa-context-status-grid ${otherModuleCount < 2 ? 'is-single' : ''}`}>
                {recepcao && (
                  <ContextStatus
                    label="Recepção"
                    value={`${recepcao.veiculo_tipo || 'Veículo'}${recepcao.veiculo_modelo ? ` · ${recepcao.veiculo_modelo}` : ''}`}
                  />
                )}
                {!isEncontrista && recreacao.length > 0 && (
                  <ContextStatus
                    label="Crianças cadastradas"
                    value={recreacao.map((item) => item.nome_crianca).join('\n')}
                  />
                )}
              </div>
              {!isEncontrista && canOpenRecreacao && recreacao.length > 0 && (
                <button
                  type="button"
                  className="pessoa-context-link"
                  onClick={() => goTo(`/recreacao?encontro=${participacao.encontro_id}&responsavel=${participacao.id}&responsavelNome=${encodeURIComponent(pessoa?.nome_completo || '')}`)}
                >
                  Abrir Recreação infantil <ChevronRight size={16} />
                </button>
              )}
            </section>
          )}

          <div className="pessoa-context-privacy">
            <CheckCircle2 size={16} />
            <span>Este resumo não inclui informações médicas ou observações de saúde.</span>
          </div>
        </div>
      </aside>
    </div>,
    document.body
  );
}
