import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { AlertTriangle, CheckCircle2, Users, Search, History } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { PessoaForm } from '../components/pessoa/PessoaForm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { pessoaService } from '../services/pessoaService';
import { inscricaoService } from '../services/inscricaoService';
import { preCadastroService } from '../services/preCadastroService';
import { maskCpf } from '../utils/cpfUtils';
import type { Pessoa, PessoaFormData } from '../types/pessoa';
import type { PreCadastroEntry } from '../types/preCadastro';
import { calculateAge } from '../utils/dateUtils';
import { useEncontros } from '../contexts/EncontroContext';

export function InscricaoPage() {
  const navigate = useNavigate();
  const {
    encontros,
    encontroAtivo,
    encontroSelecionado,
    encontroSelecionadoId,
    selecionarEncontro,
    selecaoBloqueada,
    isLoading: isLoadingEvents,
  } = useEncontros();
  const [isSaving, setIsSaving] = useState(false);

  // Similarity Check State
  const [potentialMatches, setPotentialMatches] = useState<Pessoa[]>([]);
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [pendingData, setPendingData] = useState<PessoaFormData | null>(null);
  const [alreadyParticipant, setAlreadyParticipant] = useState<boolean>(false);
  const [selectedMatch, setSelectedMatch] = useState<Pessoa | null>(null);

  // Pre-Cadastro State
  const [preCadastroSearch, setPreCadastroSearch] = useState('');
  const [preCadastroResults, setPreCadastroResults] = useState<PreCadastroEntry[]>([]);
  const [isSearchingPre, setIsSearchingPre] = useState(false);
  const [selectedPreCadastro, setSelectedPreCadastro] = useState<PreCadastroEntry | null>(null);
  const [pessoaFormKey, setPessoaFormKey] = useState(0);
  const [initialFormData, setInitialFormData] = useState<Partial<PessoaFormData> | undefined>(undefined);
  const [showAgeModal, setShowAgeModal] = useState(false);
  const [userAge, setUserAge] = useState<number | null>(null);

  const performRegistration = async (pessoaId: string, isNew: boolean) => {
    setIsSaving(true);
    try {
      if (!encontroAtivo || encontroSelecionadoId !== encontroAtivo.id) {
        throw new Error('Não há encontro ativo disponível para inscrição.');
      }

      // 2. Vincular ao encontro
      await inscricaoService.criar({
        pessoa_id: pessoaId,
        encontro_id: encontroAtivo.id,
        participante: true,
        equipe_id: null,
        coordenador: false,
        dados_confirmados: false,
        confirmado_em: null,
        pago_taxa: false
      });

      // Se veio de um pré-cadastro, marca como convertido
      if (selectedPreCadastro?.id) {
        await preCadastroService.updateStatus(selectedPreCadastro.id, 'convertido');
      }

      toast.success(isNew ? 'Pessoa cadastrada e inscrita com sucesso!' : 'Pessoa vinculada ao encontro com sucesso!');
      
      // Reset form and state for next registration instead of navigating away
      setSelectedPreCadastro(null);
      setInitialFormData(undefined);
      setPendingData(null);
      setPotentialMatches([]);
      setSelectedMatch(null);
      setPessoaFormKey(prev => prev + 1); // Force form reset
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao realizar inscrição.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (data: PessoaFormData, _shouldConfirm: boolean) => {
    setIsSaving(true);
    try {
      // 0. Verificar idade (Mínimo 15 anos na data do encontro)
      const encontro = encontroAtivo;
      if (encontro && data.data_nascimento) {
        const age = calculateAge(data.data_nascimento, encontro.data_inicio);
        if (age !== null && age < 15) {
          setUserAge(age);
          setShowAgeModal(true);
          setIsSaving(false);
          return;
        }
      }

      // 1. Verificar semelhança
      const matches = await pessoaService.buscarPorSemelhanca(data.nome_completo, data.cpf);

      if (matches.length > 0) {
        setPotentialMatches(matches);
        setPendingData(data);
        setShowMatchDialog(true);
        setIsSaving(false);
        return;
      }

      // Se não houver matches, cria novo
      const novaPessoa = await pessoaService.criar(data);

      await performRegistration(novaPessoa.id, true);
    } catch {
      toast.error('Erro ao processar cadastro.');
      setIsSaving(false);
    }
  };

  const handleSearchPreCadastro = async () => {
    if (!preCadastroSearch.trim()) return;
    setIsSearchingPre(true);
    try {
      const results = await preCadastroService.searchByTerm(preCadastroSearch);
      setPreCadastroResults(results.filter(r => r.status === 'pendente'));
      if (results.length === 0) {
        toast.error('Nenhum pré-cadastro pendente encontrado.');
      }
    } catch {
      toast.error('Erro ao buscar pré-cadastro.');
    } finally {
      setIsSearchingPre(false);
    }
  };

  const handleSelectPreCadastro = (pre: PreCadastroEntry) => {
    setSelectedPreCadastro(pre);
    setInitialFormData({
      nome_completo: pre.nome_completo,
      email: pre.email || '',
      telefone: pre.telefone,
      data_nascimento: pre.data_nascimento || '',
    });
    // Increment key to force PessoaForm to re-mount with new initialData
    setPessoaFormKey(prev => prev + 1);
    setPreCadastroResults([]);
    setPreCadastroSearch('');
    toast.success(`Dados de ${pre.nome_completo} carregados!`);
  };

  const handleMatchSelect = async (pessoa: Pessoa) => {
    setSelectedMatch(pessoa);
    const isPart = await inscricaoService.verificarSeJaFoiParticipante(pessoa.id);
    setAlreadyParticipant(isPart);
  };

  const handleConfirmExisting = async () => {
    if (!selectedMatch) return;
    setShowMatchDialog(false);
    await performRegistration(selectedMatch.id, false);
  };

  const handleConfirmNew = async () => {
    if (!pendingData) return;
    setShowMatchDialog(false);
    setIsSaving(true);
    try {
      const novaPessoa = await pessoaService.criar(pendingData);
      await performRegistration(novaPessoa.id, true);
    } catch {
      toast.error('Erro ao criar novo cadastro.');
      setIsSaving(false);
    }
  };

  const pageHeader = (
    <PageHeader
      title="Nova Inscrição"
      subtitle="Portal / Inscrição"
      backPath="/dashboard"
    />
  );

  const contextIsInitializing = isLoadingEvents || (encontros.length > 0 && !encontroSelecionadoId);

  if (contextIsInitializing) {
    return (
      <>
        {pageHeader}
        <div className="card text-center py-4">Carregando encontro...</div>
      </>
    );
  }

  if (!encontroAtivo) {
    return (
      <>
        {pageHeader}
        <div className="card text-center py-4">
          <strong>Inscrições indisponíveis</strong>
          <p style={{ marginBottom: 0, opacity: 0.7 }}>Não há encontro ativo disponível para uma nova inscrição.</p>
        </div>
      </>
    );
  }

  if (encontroSelecionadoId !== encontroAtivo.id) {
    return (
      <>
        {pageHeader}
        <section className="card inscription-context-warning">
          <div className="inscription-context-warning__icon" aria-hidden="true">
            <AlertTriangle size={24} />
          </div>
          <div className="inscription-context-warning__content">
            <span className="inscription-context-warning__eyebrow">Contexto histórico selecionado</span>
            <h2>Você está consultando o {encontroSelecionado?.nome ?? 'encontro histórico'}</h2>
            <p>
              Novas inscrições só podem ser realizadas no encontro ativo. Para continuar, altere o contexto para <strong>{encontroAtivo.nome}</strong>.
            </p>
            {selecaoBloqueada && (
              <p className="inscription-context-warning__blocked">
                Seu perfil não permite alterar a edição selecionada. Retorne à tela anterior ou solicite acesso a um administrador.
              </p>
            )}
            <div className="inscription-context-warning__actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => selecionarEncontro(encontroAtivo.id)}
                disabled={selecaoBloqueada}
              >
                Trocar para {encontroAtivo.nome} e continuar
              </button>
              <button type="button" className="btn-outline" onClick={() => navigate(-1)}>
                Voltar
              </button>
            </div>
          </div>
        </section>
        <style>{`
          .inscription-context-warning {
            max-width: 760px;
            margin: 0 auto;
            padding: 1.5rem;
            display: flex;
            align-items: flex-start;
            gap: 1rem;
            border-color: rgba(245, 158, 11, 0.35);
            background: color-mix(in srgb, #f59e0b 7%, var(--card-bg));
          }
          .inscription-context-warning__icon {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            display: grid;
            place-items: center;
            flex: 0 0 auto;
            color: #f59e0b;
            background: rgba(245, 158, 11, 0.14);
          }
          .inscription-context-warning__content {
            min-width: 0;
          }
          .inscription-context-warning__eyebrow {
            color: #f59e0b;
            font-size: 0.75rem;
            font-weight: 800;
            letter-spacing: 0.06em;
            text-transform: uppercase;
          }
          .inscription-context-warning h2 {
            margin: 0.25rem 0 0.65rem;
            color: var(--text-color);
            font-size: 1.3rem;
          }
          .inscription-context-warning p {
            margin: 0;
            color: var(--muted-text);
            line-height: 1.55;
          }
          .inscription-context-warning__blocked {
            margin-top: 0.75rem !important;
            color: #ef4444 !important;
            font-weight: 700;
          }
          .inscription-context-warning__actions {
            margin-top: 1.25rem;
            display: flex;
            gap: 0.75rem;
            flex-wrap: wrap;
          }
          @media (max-width: 640px) {
            .inscription-context-warning {
              flex-direction: column;
              padding: 1.1rem;
            }
            .inscription-context-warning__actions button {
              width: 100%;
              min-height: 44px;
              justify-content: center;
            }
          }
        `}</style>
      </>
    );
  }

  return (
    <>
      {pageHeader}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', margin: '0 auto' }}>
          {/* Step 1: Event Selection */}
          <div className="card" style={{ padding: '1.35rem 1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <span style={{ display: 'block', color: 'var(--muted-text)', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Inscrição para
                </span>
                <h3 style={{ margin: '0.25rem 0 0', color: 'var(--text-color)', fontSize: '1.35rem' }}>
                  {encontroAtivo.nome} <span style={{ color: '#10b981', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase' }}>Ativo</span>
                </h3>
              </div>
              <button
                onClick={() => navigate(`/inscricao/participantes?encontro=${encontroAtivo.id}`)}
                className="btn-text"
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--primary-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                <Users size={16} /> Ver Encontristas Inscritos
              </button>
            </div>

          </div>

          {/* Step 1.5: Pre-Cadastro Search (Optional/Toggle) */}
          <div className="card">
            <button 
              onClick={() => {
                const el = document.getElementById('pre-cadastro-content');
                if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
              }}
              style={{ 
                width: '100%', 
                background: 'none', 
                border: 'none', 
                padding: 0, 
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', fontSize: '1.1rem', color: 'var(--text-color)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <History size={18} className="text-gradient" /> Importar do Pré-Cadastro
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--primary-color)', fontWeight: 600 }}>Clique para buscar</span>
              </h3>
            </button>
            
            <div id="pre-cadastro-content" style={{ display: 'none', marginTop: '1.5rem' }}>
            <p style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '1rem' }}>
              Se o jovem realizou o pré-cadastro na landing page, você pode buscar os dados dele aqui para agilizar o preenchimento.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Buscar por nome ou telefone..."
                  value={preCadastroSearch}
                  onChange={(e) => setPreCadastroSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchPreCadastro()}
                  style={{ width: '100%' }}
                />
              </div>
              <button
                onClick={handleSearchPreCadastro}
                className="btn-secondary"
                disabled={isSearchingPre}
                style={{ whiteSpace: 'nowrap' }}
              >
                {isSearchingPre ? 'Buscando...' : <span className="flex items-center gap-2"><Search size={16} /> Buscar</span>}
              </button>
            </div>

            {preCadastroResults.length > 0 && (
              <div style={{ marginTop: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                {preCadastroResults.map(pre => (
                  <div
                    key={pre.id}
                    onClick={() => handleSelectPreCadastro(pre)}
                    style={{
                      padding: '0.75rem 1rem',
                      borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: 'var(--card-bg)'
                    }}
                    className="transition-colors"
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{pre.nome_completo}</div>
                      <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                        {pre.telefone} {pre.email ? `| ${pre.email}` : ''}
                      </div>
                    </div>
                    <button className="btn-text" style={{ color: 'var(--primary-color)', fontSize: '0.8rem', fontWeight: 600 }}>
                      Selecionar
                    </button>
                  </div>
                ))}
              </div>
            )}

            {selectedPreCadastro && (
              <div style={{
                marginTop: '1rem',
                padding: '0.75rem',
                backgroundColor: 'var(--success-bg)',
                border: '1px solid var(--success-border)',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success-text)', fontSize: '0.9rem' }}>
                  <CheckCircle2 size={16} />
                  <span>Utilizando dados de: <strong>{selectedPreCadastro.nome_completo}</strong></span>
                </div>
                <button
                  onClick={() => {
                    setSelectedPreCadastro(null);
                    setInitialFormData(undefined);
                    setPessoaFormKey(prev => prev + 1);
                  }}
                  className="btn-text"
                  style={{ color: 'var(--danger-text)', fontSize: '0.8rem' }}
                >
                  Remover
                </button>
              </div>
            )}
            </div>
          </div>

          {/* Step 2: Person Data */}
          <div className="card">
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Dados do Encontrista
            </h2>
            <PessoaForm
              key={pessoaFormKey}
              onSubmit={handleSubmit}
              onCancel={() => navigate(-1)}
              isLoading={isSaving}
              initialData={initialFormData}
              requireBirthDate={true}
              requireFezEjc={true}
            />
          </div>
        </div>

      <ConfirmDialog
        isOpen={showMatchDialog}
        title="Possível Cadastro Existente"
        confirmText={alreadyParticipant ? "Entendi" : "Sim, usar este cadastro"}
        cancelText="Não, criar novo cadastro"
        onConfirm={alreadyParticipant ? () => setShowMatchDialog(false) : () => { handleConfirmExisting(); }}
        onCancel={() => setShowMatchDialog(false)}
        message={
          <div>
            <p style={{ marginBottom: '1rem' }}>
              Encontramos pessoas com nome ou CPF semelhantes. Selecione uma para verificar os detalhes:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem', maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem' }}>
              {potentialMatches.map(p => (
                <div
                  key={p.id}
                  onClick={() => handleMatchSelect(p)}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: selectedMatch?.id === p.id ? 'rgba(0,0,254,0.1)' : 'transparent',
                    border: `1px solid ${selectedMatch?.id === p.id ? 'var(--primary-color)' : 'var(--border-color)'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{p.nome_completo}</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>CPF: {maskCpf(p.cpf)} | {p.cidade || '—'}</div>
                  </div>
                  {selectedMatch?.id === p.id && <CheckCircle2 size={18} color="var(--primary-color)" />}
                </div>
              ))}
            </div>

            {selectedMatch && (
              <div style={{
                padding: '1rem',
                borderRadius: '8px',
                backgroundColor: alreadyParticipant ? 'var(--danger-bg)' : 'var(--success-bg)',
                border: `1px solid ${alreadyParticipant ? 'var(--danger-border)' : 'var(--success-border)'}`
              }}>
                {alreadyParticipant ? (
                  <div style={{ display: 'flex', gap: '0.75rem', color: 'var(--danger-text)' }}>
                    <AlertTriangle size={24} style={{ flexShrink: 0 }} />
                    <div>
                      <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Já participou anteriormente!</strong>
                      Essa pessoa já consta como encontrista em um encontro anterior.
                      O EJC pode ser feito apenas uma vez como encontrista.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '0.75rem', color: 'var(--success-text)' }}>
                    <CheckCircle2 size={24} style={{ flexShrink: 0 }} />
                    <div>
                      <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Cadastro liberado</strong>
                      Esta pessoa já existe no sistema (provavelmente trabalhou em equipes),
                      mas nunca foi encontrista. Deseja vinculá-la a este encontro?

                      <button
                        onClick={() => { handleConfirmExisting(); }}
                        className="btn-primary"
                        style={{ display: 'block', marginTop: '1rem', width: '100%' }}
                      >
                        Vincular Cadastro Existente
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!alreadyParticipant && (
              <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                <p style={{ opacity: 0.6, fontSize: '0.9rem', marginBottom: '0.5rem' }}>Ou se tiver certeza que é outra pessoa:</p>
                <button
                  onClick={() => { handleConfirmNew(); }}
                  className="btn-cancel"
                  style={{ textDecoration: 'underline', border: 'none', background: 'none', cursor: 'pointer' }}
                >
                  Continuar com Novo Cadastro
                </button>
              </div>
            )}
          </div>
        }
      />
      <ConfirmDialog
        isOpen={showAgeModal}
        title="Idade não permitida"
        message={
          <div style={{ textAlign: 'center' }}>
            <AlertTriangle size={48} color="#f59e0b" style={{ marginBottom: '1rem' }} />
            <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Este jovem tem apenas {userAge} anos.
            </p>
            <p style={{ opacity: 0.8 }}>
              Para participar do EJC, é necessário ter <strong>15 anos ou mais</strong> na data do encontro.
            </p>
            <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
              O cadastro não será realizado. Por favor, aguarde os próximos encontros.
            </p>
          </div>
        }
        confirmText="Entendi"
        onConfirm={() => {
          setShowAgeModal(false);
          // Reinicia o cadastro
          setSelectedPreCadastro(null);
          setInitialFormData(undefined);
          setPessoaFormKey(prev => prev + 1);
        }}
        onCancel={() => {
          setShowAgeModal(false);
          setSelectedPreCadastro(null);
          setInitialFormData(undefined);
          setPessoaFormKey(prev => prev + 1);
        }}
      />
    </>
  );
}
