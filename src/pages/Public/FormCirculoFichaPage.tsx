import {
  Bike,
  Car,
  CheckCircle,
  CheckSquare,
  ChevronLeft, ChevronRight, FileText,
  Loader, LogOut,
  Music,
  Square,
  UserCheck
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import logoEjc from '../../assets/logo-ejc.svg';
import { PesquisaSatisfacaoForm, pesquisaSatisfacaoCompleta } from '../../components/pesquisa-satisfacao/PesquisaSatisfacaoForm';
import { ActionStepper, type ActionStep } from '../../components/ui/ActionStepper';
import { GroupedDropdown } from '../../components/ui/GroupedDropdown';
import { useCirculoAccess } from '../../hooks/useCirculoAccess';
import { equipeService } from '../../services/equipeService';
import { posEncontroService } from '../../services/posEncontroService';
import { pesquisaEncontristaService } from '../../services/pesquisaEncontristaService';
import type { Equipe } from '../../types/equipe';
import type { PosEncontroFicha } from '../../types/posEncontro';
import type { PesquisaEncontristaFluxo } from '../../types/pesquisaEncontrista';
import type { PesquisaSatisfacaoRespostas } from '../../types/pesquisaSatisfacao';


export default function FormCirculoFichaPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, meta, token, logout } = useCirculoAccess();

  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [fichaExistente, setFichaExistente] = useState<PosEncontroFicha | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [pesquisa, setPesquisa] = useState<PesquisaEncontristaFluxo | null>(null);
  const [respostasPesquisa, setRespostasPesquisa] = useState<PesquisaSatisfacaoRespostas>({});
  const [isSavingPesquisa, setIsSavingPesquisa] = useState(false);

  // Stepper state
  const [stepperStep, setStepperStep] = useState(1);
  const [subStep, setSubStep] = useState(1);
  const [fichaDraft, setFichaDraft] = useState({
    toca_instrumento: null as boolean | null,
    instrumentos: '',
    tem_carro: false,
    tem_moto: false,
    observacoes: '',
    preferencias: ['', '', ''] as string[],
  });

  // Redireciona para identificação se não autenticado
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Carrega equipes e ficha existente
  useEffect(() => {
    async function load() {
      if (!meta || !token) return;
      try {
        const [eqs, participantes, fluxoPesquisa] = await Promise.all([
          equipeService.listar(),
          posEncontroService.listarParticipantesCirculo(meta.encontro_id, meta.circulo_id),
          pesquisaEncontristaService.obterFluxo(token),
        ]);

        setEquipes(eqs.filter(eq => eq.aparece_pos_encontro !== false));
        setPesquisa(fluxoPesquisa);
        setRespostasPesquisa(fluxoPesquisa.respostas ?? {});

        const meu = participantes.find(p => p.participacao.id === meta.participacao_id);
        if (meu?.ficha) {
          const ficha = meu.ficha;
          const prefs = [...(ficha.pos_encontro_ficha_equipes ?? [])].sort(
            (a, b) => a.ordem_preferencia - b.ordem_preferencia
          );
          setFichaExistente(ficha);
          setFichaDraft({
            toca_instrumento: ficha.toca_instrumento,
            instrumentos: ficha.instrumentos ?? '',
            tem_carro: ficha.tem_carro,
            tem_moto: ficha.tem_moto,
            observacoes: ficha.observacoes ?? '',
            preferencias: [
              prefs.find(p => p.ordem_preferencia === 1)?.equipe_id ?? '',
              prefs.find(p => p.ordem_preferencia === 2)?.equipe_id ?? '',
              prefs.find(p => p.ordem_preferencia === 3)?.equipe_id ?? '',
            ],
          });
          setSubStep(prefs.filter(p => p.equipe_id).length === 3 ? 4 : 1);
        }
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
        toast.error('Erro ao carregar informações.');
      } finally {
        setIsLoadingData(false);
      }
    }
    load();
  }, [meta, token]);

  const handleSavePesquisa = async (status: 'rascunho' | 'enviado') => {
    if (!token || !pesquisa) return;
    if (status === 'enviado' && !pesquisaSatisfacaoCompleta(respostasPesquisa, pesquisa.perguntas)) {
      toast.error('Preencha todas as respostas obrigatórias antes de continuar.');
      return;
    }

    setIsSavingPesquisa(true);
    try {
      const result = await pesquisaEncontristaService.salvarPublico(token, respostasPesquisa, status);
      setPesquisa(current => current ? {
        ...current,
        status: result.status,
        respostas: result.respostas,
        enviado_em: result.enviado_em,
      } : current);
      setRespostasPesquisa(result.respostas);
      toast.success(status === 'enviado'
        ? 'Pesquisa enviada! Agora preencha sua ficha pós-encontro.'
        : 'Rascunho salvo.');
    } catch (error) {
      console.error('Erro ao salvar pesquisa do encontrista:', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar a pesquisa.');
    } finally {
      setIsSavingPesquisa(false);
    }
  };

  const handleSelectTeamDropdown = (teamId: string, index: number) => {
    const newPrefs = [...fichaDraft.preferencias];
    newPrefs[index] = teamId;

    setFichaDraft(prev => ({ ...prev, preferencias: newPrefs }));

    // Avança de forma inteligente
    if (newPrefs.every(p => p !== '')) {
      setSubStep(4);
    } else {
      const firstEmptyIndex = newPrefs.findIndex(p => p === '');
      setSubStep(firstEmptyIndex !== -1 ? firstEmptyIndex + 1 : 4);
    }
  };

  const getDropdownOptions = (currentIndex: number) =>
    equipes.map(eq => ({
      value: eq.id,
      label: eq.nome ?? '',
      disabled: fichaDraft.preferencias.some((prefId, idx) => prefId === eq.id && idx !== currentIndex),
    }));

  const subSteps: ActionStep[] = [0, 1, 2].map(index => {
    const eqId = fichaDraft.preferencias[index];
    const eq = equipes.find(e => e.id === eqId);
    return {
      id: `opt${index + 1}`,
      title: `${index + 1}ª Opção`,
      status: subStep === index + 1 ? 'current' : eqId ? 'completed' : 'pending',
      summary: eq ? <span>{eq.nome}</span> : undefined,
      onEdit: () => {
        setFichaDraft(prev => {
          const prefs = [...prev.preferencias];
          prefs[index] = '';
          return { ...prev, preferencias: prefs };
        });
        setSubStep(index + 1);
      },
      editLabel: 'Alterar',
      children: (
        <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
          <GroupedDropdown
            value={fichaDraft.preferencias[index]}
            onChange={val => handleSelectTeamDropdown(val, index)}
            items={getDropdownOptions(index)}
            placeholder="Selecione uma equipe..."
          />
        </div>
      ),
    };
  });

  const handleSave = async () => {
    if (!meta) return;

    const activePrefs = fichaDraft.preferencias.filter(Boolean);
    if (activePrefs.length !== 3) {
      toast.error('As 3 opções de equipe devem ser obrigatoriamente preenchidas.');
      return;
    }
    if (new Set(activePrefs).size !== 3) {
      toast.error('Você não pode escolher a mesma equipe em mais de uma opção.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        encontro_id: meta.encontro_id,
        participacao_id: meta.participacao_id,
        toca_instrumento: !!fichaDraft.toca_instrumento,
        instrumentos: fichaDraft.toca_instrumento ? (fichaDraft.instrumentos.trim() || null) : null,
        tem_carro: fichaDraft.tem_carro,
        tem_moto: fichaDraft.tem_moto,
        observacoes: fichaDraft.observacoes.trim() || null,
      };
      const preferenciasPayload = fichaDraft.preferencias
        .map((equipe_id, index) => ({ equipe_id, ordem_preferencia: index + 1 }))
        .filter(p => p.equipe_id);

      await posEncontroService.salvarFicha(payload, preferenciasPayload);
      toast.success('Ficha salva com sucesso!');
      setIsSuccess(true);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar a ficha. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const isNextDisabled = (() => {
    if (isSaving) return true;
    if (stepperStep === 1 && fichaDraft.toca_instrumento === null) return true;
    if (stepperStep === 1 && fichaDraft.toca_instrumento && !fichaDraft.instrumentos.trim()) return true;
    if (stepperStep === 3 && fichaDraft.preferencias.filter(Boolean).length !== 3) return true;
    return false;
  })();

  if (isLoading || isLoadingData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-color)' }}>
        <Loader className="animate-spin" size={32} color="var(--primary-color)" />
      </div>
    );
  }

  if (pesquisa?.publicada && pesquisa.status !== 'enviado') {
    return (
      <div className="pesquisa-public-shell fade-in">
        <main className="pesquisa-public-main">
          <header className="card pesquisa-public-header" style={{ padding: '1.25rem', textAlign: 'center' }}>
            <img src={logoEjc} alt="Logo EJC" className="public-logo-img" style={{ height: 56, width: 'auto' }} />
            <span style={{ display: 'block', color: 'var(--primary-color)', fontSize: '0.75rem', fontWeight: 900, marginTop: '0.75rem', textTransform: 'uppercase' }}>
              Etapa 1 de 2 · Avaliação do encontro
            </span>
            <h1 style={{ fontSize: '1.45rem', margin: '0.3rem 0' }}>{pesquisa.encontro_nome}</h1>
            <p style={{ color: 'var(--muted-text)', margin: 0 }}>
              Olá, {meta?.nome_encontrista}. Depois da pesquisa, você escolherá as equipes em que deseja trabalhar.
            </p>
          </header>
          <PesquisaSatisfacaoForm
            respostas={respostasPesquisa}
            questions={pesquisa.perguntas}
            saving={isSavingPesquisa}
            submitLabel="Enviar e continuar para a ficha"
            onChange={setRespostasPesquisa}
            onSaveDraft={() => handleSavePesquisa('rascunho')}
            onSubmit={() => handleSavePesquisa('enviado')}
          />
        </main>
        <style>{`
          .pesquisa-public-shell {
            background: var(--bg-color);
            min-height: 100vh;
            padding: 1.25rem;
          }
          .pesquisa-public-main {
            display: grid;
            gap: 1rem;
            margin: 0 auto;
            max-width: 920px;
            width: 100%;
          }
          @media (max-width: 560px) {
            .pesquisa-public-shell { padding: 0.75rem; }
          }
        `}</style>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="fade-in" style={{ minHeight: '100vh', background: 'var(--bg-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div className="card" style={{ maxWidth: '450px', width: '100%', textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', margin: '0 auto 1.5rem auto' }}>
            <CheckCircle size={48} />
          </div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>Ficha Enviada!</h1>
          <p style={{ opacity: 0.7, marginBottom: '0.5rem' }}>
            Obrigado, <strong>{meta?.nome_encontrista}</strong>!
          </p>
          <p style={{ opacity: 0.6, fontSize: '0.875rem', marginBottom: '2rem' }}>
            Suas informações foram registradas com sucesso.
          </p>
          <button
            onClick={() => setIsSuccess(false)}
            className="btn-primary"
            style={{ width: '100%', marginBottom: '0.75rem' }}
          >
            Revisar Ficha
          </button>
          <button
            onClick={() => { logout(); navigate('/'); }}
            className="btn-text"
            style={{ width: '100%', opacity: 0.6 }}
          >
            Sair e Finalizar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-color)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '1rem 1.5rem', background: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <img src={logoEjc} alt="Logo" className="public-logo-img" style={{ height: '32px', width: 'auto' }} />
          <div>
            <h2 style={{ fontSize: '1rem', margin: 0 }}>Etapa 2 de 2 · Ficha Pós-Encontro</h2>
            <p style={{ fontSize: '0.75rem', opacity: 0.5, margin: 0 }}>{meta?.nome_encontrista}</p>
          </div>
        </div>
        <button onClick={() => { logout(); navigate('/'); }} className="icon-btn" title="Sair">
          <LogOut size={18} />
        </button>
      </div>

      <div className="container" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: '600px', padding: '1.5rem 1rem', overflow: 'hidden', minHeight: 0 }}>
        {fichaExistente && (
          <div style={{ flexShrink: 0, padding: '0.75rem 1rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={16} />
            Você já preencheu sua ficha. Você pode alterar suas respostas abaixo.
          </div>
        )}

        {/* Stepper visual */}
        <div className="card" style={{ height: '600px', maxHeight: '100%', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden' }}>
          {/* Indicador de progresso — mesmo estilo do sistema interno */}
          <div className="ficha-stepper-header" style={{ flexShrink: 0 }}>
            {[
              { label: 'Música', Icon: Music },
              { label: 'Transporte', Icon: Car },
              { label: 'Equipes', Icon: UserCheck },
              { label: 'Obs.', Icon: FileText },
            ].map((s, i) => {
              const step = i + 1;
              const isActive = stepperStep === step;
              const isDone = stepperStep > step;
              return (
                <div key={s.label} className={`ficha-stepper-step ${isActive ? 'active' : isDone ? 'completed' : ''}`}>
                  <span className="step-number">{isDone ? '✓' : step}</span>
                  <span className="step-label">{s.label}</span>
                </div>
              );
            }).reduce<React.ReactNode[]>((acc, el, i) => {
              if (i > 0) acc.push(<div key={`line-${i}`} className="ficha-stepper-line" />);
              acc.push(el);
              return acc;
            }, [])}
          </div>

          {/* Conteúdo do step */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.75rem 1.5rem' }}>

            {/* Step 1: Música */}
            {stepperStep === 1 && (
              <div className="fade-in">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(168,85,247,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a855f7' }}>
                    <Music size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Habilidades Musicais</h3>
                    <p style={{ margin: 0, opacity: 0.6, fontSize: '0.85rem' }}>Você toca algum instrumento musical?</p>
                  </div>
                </div>

                <div className="instrumento-toggle-row">
                  <span style={{ fontWeight: 600 }}>Toca algum instrumento?</span>
                  <div className="toggle-buttons">
                    <button type="button" onClick={() => setFichaDraft(p => ({ ...p, toca_instrumento: false }))} style={{ padding: '0.4rem 1rem', borderRadius: '8px', border: '2px solid', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem', borderColor: fichaDraft.toca_instrumento === false ? '#ef4444' : 'var(--border-color)', background: fichaDraft.toca_instrumento === false ? 'rgba(239,68,68,0.1)' : 'transparent', color: fichaDraft.toca_instrumento === false ? '#ef4444' : 'var(--text-color)', transition: 'all 0.2s' }}>
                      Não
                    </button>
                    <button type="button" onClick={() => setFichaDraft(p => ({ ...p, toca_instrumento: true }))} style={{ padding: '0.4rem 1rem', borderRadius: '8px', border: '2px solid', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem', borderColor: fichaDraft.toca_instrumento === true ? '#10b981' : 'var(--border-color)', background: fichaDraft.toca_instrumento === true ? 'rgba(16,185,129,0.1)' : 'transparent', color: fichaDraft.toca_instrumento === true ? '#10b981' : 'var(--text-color)', transition: 'all 0.2s' }}>
                      Sim
                    </button>
                  </div>
                </div>

                {fichaDraft.toca_instrumento === true && (
                  <div className="form-group fade-in">
                    <label className="form-label">Quais instrumentos?</label>
                    <input type="text" className="form-input" placeholder="Ex: Violão, Teclado, Bateria..." value={fichaDraft.instrumentos} onChange={e => setFichaDraft(p => ({ ...p, instrumentos: e.target.value }))} />
                  </div>
                )}

                {fichaDraft.toca_instrumento === null && (
                  <p style={{ color: 'var(--accent-color)', fontSize: '0.82rem', fontWeight: 600 }}>* Selecione Sim ou Não para continuar.</p>
                )}
              </div>
            )}

            {/* Step 2: Transporte */}
            {stepperStep === 2 && (
              <div className="fade-in">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                    <Car size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Transporte</h3>
                    <p style={{ margin: 0, opacity: 0.6, fontSize: '0.85rem' }}>Selecione o que você possui.</p>
                  </div>
                </div>
                <div className="transport-options-grid">
                  <label className="transport-checkbox-card">
                    <input
                      type="checkbox"
                      checked={fichaDraft.tem_carro}
                      onChange={(e) => setFichaDraft(prev => ({ ...prev, tem_carro: e.target.checked }))}
                    />
                    <div className="card-content">
                      <span className="card-checkbox-indicator">
                        {fichaDraft.tem_carro ? <CheckSquare size={18} /> : <Square size={18} />}
                      </span>
                      <Car size={24} className="icon" />
                      <strong>Carro</strong>
                    </div>
                  </label>

                  <label className="transport-checkbox-card">
                    <input
                      type="checkbox"
                      checked={fichaDraft.tem_moto}
                      onChange={(e) => setFichaDraft(prev => ({ ...prev, tem_moto: e.target.checked }))}
                    />
                    <div className="card-content">
                      <span className="card-checkbox-indicator">
                        {fichaDraft.tem_moto ? <CheckSquare size={18} /> : <Square size={18} />}
                      </span>
                      <Bike size={24} className="icon" />
                      <strong>Moto</strong>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Step 3: Preferências de equipe */}
            {stepperStep === 3 && (
              <div className="fade-in">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(var(--primary-rgb),0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)' }}>
                    <UserCheck size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Preferências de Equipe</h3>
                    <p style={{ margin: 0, opacity: 0.6, fontSize: '0.85rem' }}>Selecione suas 3 opções de equipe.</p>
                  </div>
                </div>
                <ActionStepper steps={subSteps} orientation="vertical" />
                {subStep <= 3 && !fichaDraft.preferencias[subStep - 1] && (
                  <p style={{ color: 'var(--accent-color)', fontSize: '0.82rem', marginTop: '0.5rem', fontWeight: 600 }}>* Selecione uma equipe acima para avançar.</p>
                )}
              </div>
            )}

            {/* Step 4: Observações */}
            {stepperStep === 4 && (
              <div className="fade-in">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(100,116,139,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-text)' }}>
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Observações</h3>
                    <p style={{ margin: 0, opacity: 0.6, fontSize: '0.85rem' }}>Alguma informação adicional? (opcional)</p>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Observações</label>
                  <textarea className="form-input" rows={5} placeholder="Ex: tenho disponibilidade apenas aos sábados..." value={fichaDraft.observacoes} onChange={e => setFichaDraft(p => ({ ...p, observacoes: e.target.value }))} style={{ resize: 'vertical' }} />
                </div>
              </div>
            )}
          </div>

          {/* Footer de navegação */}
          <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', background: 'rgba(var(--primary-rgb),0.02)' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => stepperStep > 1 ? setStepperStep(p => p - 1) : null}
              disabled={stepperStep === 1}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <ChevronLeft size={16} />
              Anterior
            </button>

            <button
              type="button"
              className="btn-primary"
              disabled={isNextDisabled}
              onClick={() => stepperStep < 4 ? setStepperStep(p => p + 1) : handleSave()}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {stepperStep === 4
                ? isSaving ? <><Loader className="animate-spin" size={16} /> Salvando...</> : 'Salvar Ficha'
                : <> Próximo <ChevronRight size={16} /></>
              }
            </button>
          </div>
        </div>

        <p style={{ flexShrink: 0, textAlign: 'center', marginTop: '1rem', fontSize: '0.875rem', opacity: 0.4 }}>
          Seus dados são armazenados com segurança.
        </p>
      </div>
    </div>
  );
}
