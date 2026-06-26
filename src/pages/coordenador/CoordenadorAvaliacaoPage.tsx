import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Copy, Loader, Lock, QrCode, Share2, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { PesquisaSatisfacaoForm, pesquisaSatisfacaoCompleta } from '../../components/pesquisa-satisfacao/PesquisaSatisfacaoForm';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { pesquisaSatisfacaoService } from '../../services/pesquisaSatisfacaoService';
import type { PesquisaSatisfacaoEnvio, PesquisaSatisfacaoQuestion, PesquisaSatisfacaoResumoEquipe, PesquisaSatisfacaoRespostas, PesquisaSatisfacaoStatus } from '../../types/pesquisaSatisfacao';

interface EncontroInfo {
  nome: string;
  data_fim: string | null;
}

export function CoordenadorAvaliacaoPage() {
  const { userParticipacao, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [encontro, setEncontro] = useState<EncontroInfo | null>(null);
  const [publicada, setPublicada] = useState(false);
  const [envio, setEnvio] = useState<PesquisaSatisfacaoEnvio | null>(null);
  const [perguntas, setPerguntas] = useState<PesquisaSatisfacaoQuestion[]>([]);
  const [resumo, setResumo] = useState<PesquisaSatisfacaoResumoEquipe | null>(null);
  const [respostas, setRespostas] = useState<PesquisaSatisfacaoRespostas>({});
  const [statusModal, setStatusModal] = useState<PesquisaSatisfacaoStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isAdmin = hasPermission('modulo_admin');
  const encontroId = userParticipacao?.encontro_id ?? null;
  const equipeId = userParticipacao?.equipe_id ?? null;
  const participacaoId = userParticipacao?.id ?? null;
  const equipeNome = userParticipacao?.equipes?.nome ?? 'Sua equipe';
  const isSent = envio?.status === 'enviado';
  const isReleased = isAdmin || publicada;

  const publicLink = useMemo(() => {
    if (!encontroId || !equipeId) return '';
    return `${window.location.origin}/pesquisa-satisfacao/equipe/${equipeId}?encontro=${encontroId}`;
  }, [encontroId, equipeId]);

  const loadPesquisa = useCallback(async () => {
    if (!encontroId || !equipeId || !participacaoId || !userParticipacao?.coordenador) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [encontroResult, configResult, perguntasResult, envioResult, resumoResult] = await Promise.all([
        supabase.from('encontros').select('nome, data_fim').eq('id', encontroId).maybeSingle(),
        pesquisaSatisfacaoService.obterConfig(encontroId),
        pesquisaSatisfacaoService.listarPerguntas(encontroId),
        pesquisaSatisfacaoService.obterEnvioPorParticipacao(encontroId, participacaoId),
        pesquisaSatisfacaoService.listarResumoEquipe(encontroId, equipeId),
      ]);

      if (encontroResult.error) throw encontroResult.error;

      setEncontro((encontroResult.data ?? null) as EncontroInfo | null);
      setPublicada(configResult.publicada);
      setPerguntas(perguntasResult);
      setEnvio(envioResult);
      setRespostas(envioResult?.respostas ?? {});
      setResumo(resumoResult);
    } catch (error) {
      console.error('Erro ao carregar pesquisa de satisfação:', error);
      toast.error('Erro ao carregar pesquisa de satisfação.');
    } finally {
      setLoading(false);
    }
  }, [encontroId, equipeId, participacaoId, userParticipacao?.coordenador]);

  useEffect(() => {
    loadPesquisa();
  }, [loadPesquisa]);

  const save = async (status: 'rascunho' | 'enviado') => {
    if (!encontroId || !equipeId || !participacaoId || isSent) return;
    if (status === 'enviado' && !pesquisaSatisfacaoCompleta(respostas, perguntas)) {
      toast.error('Preencha todas as respostas obrigatórias antes de enviar.');
      return;
    }

    setSaving(true);
    try {
      const next = await pesquisaSatisfacaoService.salvarLogado({
        encontroId,
        equipeId,
        participacaoId,
        respostas,
        status,
      });
      setEnvio(next);
      setRespostas(next.respostas);
      toast.success(status === 'enviado' ? 'Pesquisa enviada com sucesso!' : 'Rascunho salvo.');
      await loadPesquisa();
    } catch (error) {
      console.error('Erro ao salvar pesquisa:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar pesquisa.');
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    if (!publicLink) return;
    await navigator.clipboard.writeText(publicLink);
    toast.success('Link copiado.');
  };

  const statusCards: Array<{ status: PesquisaSatisfacaoStatus; label: string; count: number }> = [
    { status: 'enviado', label: 'Respondidas', count: resumo?.totalEnviados ?? 0 },
    { status: 'rascunho', label: 'Rascunhos', count: resumo?.totalRascunhos ?? 0 },
    { status: 'pendente', label: 'Pendentes', count: resumo?.totalPendentes ?? 0 },
  ];
  const modalIntegrantes = statusModal
    ? (resumo?.integrantes ?? []).filter((integrante) => integrante.status === statusModal)
    : [];
  const modalTitle = statusCards.find((card) => card.status === statusModal)?.label ?? '';

  if (loading) {
    return (
      <main className="main-content container pesquisa-page">
        <div className="empty-state">
          <Loader className="animate-spin" size={22} />
          Carregando pesquisa...
        </div>
      </main>
    );
  }

  if (!userParticipacao?.coordenador || !encontroId || !equipeId || !participacaoId) {
    return (
      <main className="main-content container pesquisa-page">
        <AccessCard
          title="Pesquisa indisponível"
          description="Esta tela é destinada ao coordenador da equipe do encontro ativo."
          onBack={() => navigate('/coordenador/minha-equipe')}
        />
      </main>
    );
  }

  if (!isReleased) {
    return (
      <main className="main-content container pesquisa-page">
        <AccessCard
          title="Pesquisa ainda não liberada"
          description="A pesquisa ainda não foi publicada pela coordenação geral."
          onBack={() => navigate('/coordenador/minha-equipe')}
        />
      </main>
    );
  }

  return (
    <main className="main-content container pesquisa-page">
      <section className="card pesquisa-hero">
        <button type="button" className="btn-secondary" onClick={() => navigate('/coordenador/minha-equipe')}>
          <ArrowLeft size={16} />
          Minha equipe
        </button>
        <div>
          <span>Pesquisa de satisfação</span>
          <h1>{encontro?.nome ?? 'Encontro'}</h1>
          <p>{equipeNome}</p>
        </div>
        <strong className={`pesquisa-status pesquisa-status--${isSent ? 'enviado' : envio?.status ?? 'pendente'}`}>
          {isSent ? 'Enviada' : envio?.status === 'rascunho' ? 'Rascunho' : 'Pendente'}
        </strong>
      </section>

      <section className="pesquisa-summary-grid">
        {statusCards.map((card) => (
          <button
            key={card.status}
            type="button"
            className="card pesquisa-stat pesquisa-stat-button"
            onClick={() => setStatusModal(card.status)}
          >
            <span>{card.label}</span>
            <strong>{card.count}</strong>
            <small>Ver integrantes</small>
          </button>
        ))}
        <article className="card pesquisa-stat">
          <span>Total da equipe</span>
          <strong>{resumo?.totalParticipantes ?? 0}</strong>
        </article>
      </section>

      <section className="card pesquisa-public-link">
        <div className="pesquisa-public-link__content">
          <div>
            <span><Share2 size={15} /> Link público da equipe</span>
            <h2>Compartilhe com os integrantes da equipe</h2>
            <p>Cada pessoa seleciona o próprio nome, valida pelo telefone e só pode enviar uma vez.</p>
          </div>
          <div className="pesquisa-public-link__actions">
            <button type="button" className="btn-secondary" onClick={copyLink}>
              <Copy size={16} />
              Copiar link
            </button>
          </div>
          <code>{publicLink}</code>
        </div>
        <div className="pesquisa-public-link__qr">
          {publicLink ? <QRCodeSVG value={publicLink} size={132} level="M" /> : <QrCode size={72} />}
        </div>
      </section>

      <section className="pesquisa-form-card">
        <PesquisaSatisfacaoForm
          respostas={respostas}
          questions={perguntas}
          disabled={isSent}
          saving={saving}
          onChange={setRespostas}
          onSaveDraft={() => save('rascunho')}
          onSubmit={() => save('enviado')}
        />
      </section>

      {statusModal && (
        <div className="pesquisa-modal-backdrop" role="presentation" onMouseDown={() => setStatusModal(null)}>
          <section
            className="card pesquisa-status-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pesquisa-status-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>Status da pesquisa</span>
                <h2 id="pesquisa-status-modal-title">{modalTitle}</h2>
                <p>{modalIntegrantes.length} integrante{modalIntegrantes.length === 1 ? '' : 's'} neste status.</p>
              </div>
              <button type="button" className="btn-icon" onClick={() => setStatusModal(null)} aria-label="Fechar">
                <X size={18} />
              </button>
            </header>

            {modalIntegrantes.length > 0 ? (
              <ul className="pesquisa-status-list">
                {modalIntegrantes.map((integrante) => (
                  <li key={integrante.participacaoId}>{integrante.nome}</li>
                ))}
              </ul>
            ) : (
              <div className="empty-state">Nenhum integrante neste status.</div>
            )}
          </section>
        </div>
      )}

      <style>{`
        .pesquisa-page {
          padding-bottom: 4rem;
        }

        .pesquisa-hero {
          align-items: center;
          display: grid;
          gap: 1rem;
          grid-template-columns: auto minmax(0, 1fr) auto;
          margin-bottom: 1rem;
          padding: 1.25rem;
        }

        .pesquisa-hero span,
        .pesquisa-public-link span,
        .pesquisa-stat span {
          color: var(--primary-color);
          font-size: 0.72rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .pesquisa-hero h1 {
          color: var(--text-color);
          font-size: 1.5rem;
          margin: 0.15rem 0 0;
        }

        .pesquisa-hero p {
          color: var(--muted-text);
          margin: 0.25rem 0 0;
        }

        .pesquisa-status {
          border-radius: 999px;
          font-size: 0.75rem;
          padding: 0.42rem 0.75rem;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .pesquisa-status--enviado {
          background: rgba(16, 185, 129, 0.13);
          color: #10b981;
        }

        .pesquisa-status--rascunho,
        .pesquisa-status--pendente {
          background: rgba(var(--primary-rgb), 0.1);
          color: var(--primary-color);
        }

        .pesquisa-summary-grid {
          display: grid;
          gap: 0.85rem;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin-bottom: 1rem;
        }

        .pesquisa-stat {
          padding: 1rem;
        }

        .pesquisa-stat-button {
          cursor: pointer;
          text-align: left;
          transition: border-color 0.2s ease, transform 0.2s ease;
          width: 100%;
        }

        .pesquisa-stat-button:hover {
          border-color: var(--primary-color);
          transform: translateY(-1px);
        }

        .pesquisa-stat strong {
          color: var(--text-color);
          display: block;
          font-size: 1.55rem;
          margin-top: 0.25rem;
        }

        .pesquisa-stat small {
          color: var(--muted-text);
          display: block;
          font-size: 0.78rem;
          font-weight: 800;
          margin-top: 0.2rem;
        }

        .pesquisa-public-link {
          display: grid;
          gap: 1rem;
          grid-template-columns: minmax(0, 1fr) auto;
          margin-bottom: 1rem;
          padding: 1rem;
        }

        .pesquisa-public-link__content {
          display: grid;
          gap: 0.75rem;
          min-width: 0;
        }

        .pesquisa-public-link span {
          align-items: center;
          display: inline-flex;
          gap: 0.35rem;
        }

        .pesquisa-public-link h2 {
          color: var(--text-color);
          font-size: 1.05rem;
          margin: 0.25rem 0;
        }

        .pesquisa-public-link p {
          color: var(--muted-text);
          margin: 0;
        }

        .pesquisa-public-link code {
          background: var(--secondary-bg);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          color: var(--text-color);
          display: block;
          overflow-wrap: anywhere;
          padding: 0.65rem;
        }

        .pesquisa-public-link__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.65rem;
        }

        .pesquisa-public-link__actions a,
        .pesquisa-public-link__actions button {
          align-items: center;
          display: inline-flex;
          gap: 0.4rem;
          justify-content: center;
          min-height: 42px;
          min-width: 126px;
          padding-inline: 1rem;
          white-space: nowrap;
        }

        .pesquisa-public-link__qr {
          align-items: center;
          background: white;
          border-radius: 12px;
          display: flex;
          justify-content: center;
          padding: 0.75rem;
        }

        .pesquisa-modal-backdrop {
          align-items: center;
          background: rgba(5, 13, 31, 0.74);
          display: flex;
          inset: 0;
          justify-content: center;
          padding: 1rem;
          position: fixed;
          z-index: 80;
        }

        .pesquisa-status-modal {
          max-height: min(620px, calc(100vh - 2rem));
          max-width: 520px;
          overflow: hidden;
          padding: 1rem;
          width: 100%;
        }

        .pesquisa-status-modal header {
          align-items: flex-start;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          gap: 1rem;
          justify-content: space-between;
          margin-bottom: 0.85rem;
          padding-bottom: 0.85rem;
        }

        .pesquisa-status-modal header span {
          color: var(--primary-color);
          font-size: 0.72rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .pesquisa-status-modal h2 {
          color: var(--text-color);
          font-size: 1.2rem;
          margin: 0.2rem 0;
        }

        .pesquisa-status-modal p {
          color: var(--muted-text);
          margin: 0;
        }

        .pesquisa-status-list {
          display: grid;
          gap: 0.5rem;
          list-style: none;
          margin: 0;
          max-height: min(440px, calc(100vh - 190px));
          overflow: auto;
          padding: 0;
        }

        .pesquisa-status-list li {
          background: var(--secondary-bg);
          border: 1px solid var(--border-color);
          border-radius: 9px;
          color: var(--text-color);
          font-weight: 800;
          padding: 0.75rem 0.85rem;
        }

        @media (max-width: 820px) {
          .pesquisa-hero,
          .pesquisa-public-link {
            grid-template-columns: 1fr;
          }

          .pesquisa-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .pesquisa-public-link__qr {
            justify-self: start;
          }
        }

        @media (max-width: 520px) {
          .pesquisa-summary-grid {
            grid-template-columns: 1fr;
          }

          .pesquisa-public-link__actions a,
          .pesquisa-public-link__actions button,
          .pesquisa-hero .btn-secondary,
          .pesquisa-status {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}

function AccessCard({ title, description, onBack }: { title: string; description: string; onBack: () => void }) {
  return (
    <div className="card" style={{ padding: '1.25rem', display: 'grid', gap: '1rem', maxWidth: 560 }}>
      <div style={{ color: 'var(--primary-color)' }}><Lock size={24} /></div>
      <div>
        <h1 style={{ margin: 0, fontSize: '1.35rem' }}>{title}</h1>
        <p style={{ margin: '0.45rem 0 0', color: 'var(--muted-text)', lineHeight: 1.5 }}>{description}</p>
      </div>
      <button type="button" className="btn-secondary" onClick={onBack} style={{ justifySelf: 'start' }}>
        <ArrowLeft size={16} />
        Voltar
      </button>
    </div>
  );
}
