import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Banknote,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  MapPin,
  Phone,
  User,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import type { InscricaoEnriched } from '../../types/inscricao';
import { FINANCE_ROUTE_PERMISSIONS, SHIRT_ROUTE_PERMISSIONS, hasAnyPermission } from '../../utils/accessControl';
import { VISITATION_COORDINATION_PERMISSIONS } from '../../config/navigation';
import { formatTelefone } from '../../utils/cpfUtils';
import './PessoaContextDrawer.css';

interface PessoaContextDrawerProps {
  participacao: InscricaoEnriched | null;
  onClose: () => void;
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

export function PessoaContextDrawer({ participacao, onClose }: PessoaContextDrawerProps) {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  useEffect(() => {
    if (!participacao) return;

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
  }, [onClose, participacao]);

  const visita = useMemo(() => {
    if (!participacao) return null;
    const expectedVisitorFlag = participacao.participante ? false : true;
    return participacao.visita_participacao?.find((item) => item.visitante === expectedVisitorFlag)
      ?? participacao.visita_participacao?.[0]
      ?? null;
  }, [participacao]);

  if (!participacao) return null;

  const pessoa = participacao.pessoas;
  const circulo = participacao.circulo_participacao?.[0]?.circulos?.nome ?? null;
  const camisetaQuantidade = participacao.camiseta_pedidos?.reduce(
    (total, pedido) => total + (pedido.quantidade || 0),
    0
  ) ?? 0;
  const isEncontrista = participacao.participante === true;
  const canOpenFinance = hasAnyPermission(hasPermission, FINANCE_ROUTE_PERMISSIONS);
  const canOpenShirts = hasAnyPermission(hasPermission, SHIRT_ROUTE_PERMISSIONS);
  const canOpenVisitacao = hasAnyPermission(hasPermission, VISITATION_COORDINATION_PERMISSIONS);
  const canOpenCircles = hasAnyPermission(hasPermission, CIRCLE_PERMISSIONS);
  const hasShirtOrder = camisetaQuantidade > 0;
  const showCircle = isEncontrista || Boolean(circulo);
  const showVisitacao = isEncontrista || Boolean(visita);

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

          <section className="pessoa-context-section">
            <h3><ClipboardCheck size={17} /> Encontro e equipe</h3>
            <div className="pessoa-context-status-grid">
              <ContextStatus
                label="Dados"
                value={participacao.dados_confirmados ? 'Confirmados' : 'Aguardando confirmação'}
                tone={participacao.dados_confirmados ? 'success' : 'warning'}
              />
              <ContextStatus label="Equipe" value={participacao.equipes?.nome || 'Sem equipe'} />
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

          <section className="pessoa-context-section">
            <h3><Banknote size={17} /> Financeiro</h3>
            <div className="pessoa-context-status-grid">
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
                    onClick={() => goTo(`/compras/taxas?encontro=${participacao.encontro_id}&tipo=${isEncontrista ? 'encontrista' : 'encontreiro'}&busca=${encodeURIComponent(pessoa?.nome_completo || '')}`)}
                  >
                    Ver taxas
                  </button>
                )}
                {canOpenShirts && hasShirtOrder && (
                  <button
                    type="button"
                    onClick={() => goTo(`/compras/camisetas?encontro=${participacao.encontro_id}&busca=${encodeURIComponent(pessoa?.nome_completo || '')}`)}
                  >
                    Ver camisetas
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
