import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader, ShieldCheck } from 'lucide-react';
import logoEjc from '../../assets/logo-ejc.svg';
import { PesquisaSatisfacaoForm, pesquisaSatisfacaoCompleta } from '../../components/pesquisa-satisfacao/PesquisaSatisfacaoForm';
import { pesquisaSatisfacaoService } from '../../services/pesquisaSatisfacaoService';
import type { PesquisaSatisfacaoAcesso, PesquisaSatisfacaoGeneralInfo, PesquisaSatisfacaoPublicInfo, PesquisaSatisfacaoQuestion, PesquisaSatisfacaoRespostas } from '../../types/pesquisaSatisfacao';

export default function PesquisaSatisfacaoPublicPage() {
  const [searchParams] = useSearchParams();
  const encontroId = searchParams.get('encontro');
  const [generalInfo, setGeneralInfo] = useState<PesquisaSatisfacaoGeneralInfo | null>(null);
  const [info, setInfo] = useState<PesquisaSatisfacaoPublicInfo | null>(null);
  const [perguntas, setPerguntas] = useState<PesquisaSatisfacaoQuestion[]>([]);
  const [acesso, setAcesso] = useState<PesquisaSatisfacaoAcesso | null>(null);
  const [selectedEquipeId, setSelectedEquipeId] = useState('');
  const [selectedParticipacaoId, setSelectedParticipacaoId] = useState('');
  const [telefone, setTelefone] = useState('');
  const [respostas, setRespostas] = useState<PesquisaSatisfacaoRespostas>({});
  const [loading, setLoading] = useState(true);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const teamRequestRef = useRef(0);

  useEffect(() => {
    async function load() {
      if (!encontroId) {
        setInvalid(true);
        setLoading(false);
        return;
      }

      try {
        const perguntasPromise = pesquisaSatisfacaoService.listarPerguntasPublicas(encontroId);
        const [data, perguntasData] = await Promise.all([
          pesquisaSatisfacaoService.obterGeneralInfo(encontroId),
          perguntasPromise,
        ]);
        setGeneralInfo(data);
        setPerguntas(perguntasData);
      } catch (error) {
        console.error('Erro ao carregar pesquisa pública:', error);
        setInvalid(true);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [encontroId]);

  const selectEquipe = async (nextEquipeId: string) => {
    const requestId = ++teamRequestRef.current;
    setSelectedEquipeId(nextEquipeId);
    setSelectedParticipacaoId('');
    setInfo(null);
    if (!encontroId || !nextEquipeId) {
      setLoadingTeam(false);
      return;
    }

    setLoadingTeam(true);
    try {
      const data = await pesquisaSatisfacaoService.obterPublicInfo(encontroId, nextEquipeId);
      if (teamRequestRef.current !== requestId) return;
      setInfo(data);
    } catch (error) {
      if (teamRequestRef.current !== requestId) return;
      console.error('Erro ao carregar integrantes da equipe:', error);
      setSelectedEquipeId('');
      toast.error('Não foi possível carregar os integrantes desta equipe.');
    } finally {
      if (teamRequestRef.current === requestId) setLoadingTeam(false);
    }
  };

  const validate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!encontroId || !selectedEquipeId || !selectedParticipacaoId) return;
    if (telefone.replace(/\D/g, '').length < 4) {
      toast.error('Informe os 4 últimos dígitos do telefone.');
      return;
    }

    setValidating(true);
    try {
      const result = await pesquisaSatisfacaoService.validarAcessoPublico({
        encontroId,
        equipeId: selectedEquipeId,
        participacaoId: selectedParticipacaoId,
        telefone,
      });
      setAcesso(result);
      setRespostas(result.respostas ?? {});
      if (result.status === 'enviado') {
        toast.success('Esta pesquisa já foi enviada.');
      }
    } catch (error) {
      console.error('Erro ao validar acesso:', error);
      toast.error('Não foi possível validar seus dados.');
    } finally {
      setValidating(false);
    }
  };

  const save = async (status: 'rascunho' | 'enviado') => {
    if (!encontroId || !selectedEquipeId || !acesso) return;
    if (status === 'enviado' && !pesquisaSatisfacaoCompleta(respostas, perguntas)) {
      toast.error('Preencha todas as respostas obrigatórias antes de enviar.');
      return;
    }

    setSaving(true);
    try {
      const result = await pesquisaSatisfacaoService.salvarPublico({
        encontroId,
        equipeId: selectedEquipeId,
        participacaoId: acesso.participacao_id,
        telefone,
        respostas,
        status,
      });
      setAcesso((current) => current ? {
        ...current,
        status: result.status,
        respostas: result.respostas,
        enviado_em: result.enviado_em,
      } : current);
      setRespostas(result.respostas);
      toast.success(status === 'enviado' ? 'Pesquisa enviada com sucesso!' : 'Rascunho salvo.');
    } catch (error) {
      console.error('Erro ao salvar pesquisa pública:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar pesquisa.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div
        className="pesquisa-public-shell"
        role="status"
        aria-label="Carregando pesquisa"
        style={{
          alignItems: 'center',
          background: 'var(--bg-color)',
          display: 'flex',
          justifyContent: 'center',
          minHeight: '100vh',
          width: '100%',
        }}
      >
        <Loader className="animate-spin" size={32} color="var(--primary-color)" />
      </div>
    );
  }

  if (invalid || !generalInfo) {
    return (
      <div className="pesquisa-public-shell">
        <div className="card pesquisa-public-card">
          <h1>Link inválido</h1>
          <p>Este link de pesquisa não foi encontrado. Solicite um novo link ao coordenador.</p>
        </div>
      </div>
    );
  }

  const sent = acesso?.status === 'enviado';

  return (
    <div className="pesquisa-public-shell">
      <main className="pesquisa-public-main">
        <header className="card pesquisa-public-header">
          <img src={logoEjc} alt="Logo EJC" className="public-logo-img" />
          <span>Pesquisa de satisfação</span>
          <h1>{info?.encontro_nome ?? generalInfo?.encontro_nome}</h1>
          <p>{info?.equipe_nome ?? 'Link da pesquisa'}</p>
        </header>

        {!acesso ? (
          <form className="card pesquisa-public-card" onSubmit={validate}>
            <div className="pesquisa-public-alert">
              <ShieldCheck size={18} />
              Selecione sua equipe, seu nome e confirme o telefone para acessar a pesquisa.
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pesquisa-equipe">Minha equipe é</label>
              <select
                id="pesquisa-equipe"
                className="form-input"
                value={selectedEquipeId}
                onChange={(event) => void selectEquipe(event.target.value)}
                required
              >
                <option value="">Selecione sua equipe...</option>
                {generalInfo.equipes.map((equipe) => (
                  <option key={equipe.equipe_id} value={equipe.equipe_id}>
                    {equipe.nome}
                  </option>
                ))}
              </select>
              {generalInfo.equipes.length === 0 && (
                <p className="pesquisa-public-help">Nenhuma equipe está disponível para esta pesquisa.</p>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pesquisa-integrante">Meu nome é</label>
              <select
                id="pesquisa-integrante"
                className="form-input"
                value={selectedParticipacaoId}
                onChange={(event) => setSelectedParticipacaoId(event.target.value)}
                disabled={!selectedEquipeId || loadingTeam || !info}
                required
              >
                <option value="">
                  {loadingTeam ? 'Carregando integrantes...' : selectedEquipeId ? 'Selecione seu nome...' : 'Selecione primeiro sua equipe'}
                </option>
                {(info?.participantes ?? []).map((participante) => (
                  <option key={participante.participacao_id} value={participante.participacao_id}>
                    {participante.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pesquisa-telefone">4 últimos dígitos do telefone</label>
              <input
                id="pesquisa-telefone"
                type="tel"
                className="form-input pesquisa-phone-input"
                value={telefone}
                onChange={(event) => setTelefone(event.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="4321"
                maxLength={4}
                required
              />
            </div>

            <button type="submit" className="btn-primary" disabled={validating || loadingTeam || !info}>
              {validating ? <Loader className="animate-spin" size={18} /> : 'Acessar pesquisa'}
            </button>
          </form>
        ) : sent ? (
          <div className="card pesquisa-public-card pesquisa-public-success">
            <CheckCircle size={46} />
            <h2>Pesquisa enviada</h2>
            <p>Obrigado, {acesso.nome}. Sua resposta foi registrada e não pode mais ser editada.</p>
          </div>
        ) : (
          <section className="pesquisa-public-form">
            <div className="card pesquisa-public-identity">
              <strong>{acesso.nome}</strong>
              <span>{acesso.status === 'rascunho' ? 'Rascunho salvo' : 'Em preenchimento'}</span>
            </div>
            <PesquisaSatisfacaoForm
              respostas={respostas}
              questions={perguntas}
              saving={saving}
              onChange={setRespostas}
              onSaveDraft={() => save('rascunho')}
              onSubmit={() => save('enviado')}
            />
          </section>
        )}
      </main>

      <style>{`
        .pesquisa-public-shell {
          align-items: center;
          background: var(--bg-color);
          display: flex;
          justify-content: center;
          min-height: 100vh;
          padding: 1.25rem;
        }

        .pesquisa-public-main {
          display: grid;
          gap: 1rem;
          max-width: 920px;
          width: 100%;
        }

        .pesquisa-public-header,
        .pesquisa-public-card,
        .pesquisa-public-identity {
          padding: 1.25rem;
        }

        .pesquisa-public-header {
          text-align: center;
        }

        .pesquisa-public-header img {
          height: 64px;
          margin-bottom: 0.85rem;
          width: auto;
        }

        .pesquisa-public-header span {
          color: var(--primary-color);
          font-size: 0.75rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .pesquisa-public-header h1 {
          color: var(--text-color);
          font-size: 1.45rem;
          margin: 0.25rem 0;
        }

        .pesquisa-public-header p,
        .pesquisa-public-card p,
        .pesquisa-public-identity span {
          color: var(--muted-text);
          margin: 0;
        }

        .pesquisa-public-card {
          display: grid;
          gap: 1rem;
          margin: 0 auto;
          max-width: 520px;
          width: 100%;
        }

        .pesquisa-public-alert {
          align-items: center;
          background: rgba(var(--primary-rgb), 0.08);
          border: 1px solid rgba(var(--primary-rgb), 0.18);
          border-radius: 10px;
          color: var(--text-color);
          display: flex;
          gap: 0.55rem;
          padding: 0.75rem;
        }

        .pesquisa-phone-input {
          font-size: 1.25rem;
          letter-spacing: 0.28em;
          text-align: center;
        }

        .pesquisa-public-help {
          color: var(--muted-text);
          font-size: 0.85rem;
          margin: 0.45rem 0 0;
        }

        .pesquisa-public-success {
          justify-items: center;
          text-align: center;
        }

        .pesquisa-public-success svg {
          color: #10b981;
        }

        .pesquisa-public-success h2 {
          margin: 0;
        }

        .pesquisa-public-identity {
          align-items: center;
          display: flex;
          justify-content: space-between;
          gap: 1rem;
        }

        .pesquisa-public-identity strong {
          color: var(--text-color);
        }

        @media (max-width: 560px) {
          .pesquisa-public-shell {
            align-items: stretch;
            padding: 0.75rem;
          }

          .pesquisa-public-identity {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
