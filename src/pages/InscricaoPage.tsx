import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ChevronLeft, AlertTriangle, CheckCircle2, Users, Search, History } from 'lucide-react';
import { Header } from '../components/Header';
import { PessoaForm } from '../components/pessoa/PessoaForm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { encontroService } from '../services/encontroService';
import { pessoaService } from '../services/pessoaService';
import { inscricaoService } from '../services/inscricaoService';
import { preCadastroService } from '../services/preCadastroService';
import type { Encontro } from '../types/encontro';
import type { Pessoa, PessoaFormData } from '../types/pessoa';
import type { PreCadastroEntry } from '../types/preCadastro';

export function InscricaoPage() {
  const navigate = useNavigate();
  const [encontros, setEncontros] = useState<Encontro[]>([]);
  const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
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

  useEffect(() => {
    const loadEncontros = async () => {
      try {
        const data = await encontroService.listar();
        setEncontros(data);
        const active = data.find(e => e.ativo);
        if (active) setSelectedEncontroId(active.id);
        else if (data.length > 0) setSelectedEncontroId(data[0].id);
      } catch (err) {
        toast.error('Erro ao carregar encontros.');
      } finally {
        setIsLoadingEvents(false);
      }
    };
    loadEncontros();
  }, []);

  const performRegistration = async (pessoaId: string, isNew: boolean) => {
    setIsSaving(true);
    try {
      // 2. Vincular ao encontro
      await inscricaoService.criar({
        pessoa_id: pessoaId,
        encontro_id: selectedEncontroId,
        participante: true,
        equipe_id: null,
        coordenador: false
      });

      // Se veio de um pré-cadastro, marca como convertido
      if (selectedPreCadastro?.id) {
        await preCadastroService.updateStatus(selectedPreCadastro.id, 'convertido');
      }

      toast.success(isNew ? 'Pessoa cadastrada e inscrita com sucesso!' : 'Pessoa vinculada ao encontro com sucesso!');
      navigate('/');
    } catch (err) {
      toast.error('Erro ao realizar inscrição.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (data: PessoaFormData) => {
    setIsSaving(true);
    try {
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
      toast.error('Erro ao criar novo cadastro.');
      setIsSaving(false);
    }
  };

  return (
    <div className="app-shell">
      <Header />

      <main className="main-content container">
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button onClick={() => navigate(-1)} className="icon-btn">
              <ChevronLeft size={18} />
            </button>
            <div>
              <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55 }}>Inscrição</p>
              <h1 className="page-title" style={{ fontSize: '1.5rem' }}>Nova Inscrição Encontrista</h1>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>
          {/* Step 1: Event Selection */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                Encontro
              </h3>
              <button
                onClick={() => navigate('/cadastros/encontros/participantes')}
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
                <Users size={16} /> Visualizar Listagem Geral
              </button>
            </div>

            {isLoadingEvents ? (
              <div className="text-center py-4">Carregando encontros...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <select
                    className="form-input"
                    value={selectedEncontroId}
                    onChange={(e) => setSelectedEncontroId(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem' }}
                  >
                    {encontros.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.nome} {e.tema ? `(${e.tema})` : ''} {e.ativo ? '(Ativo)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {encontros.find(e => e.id === selectedEncontroId)?.ativo && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success-text)', fontWeight: 'bold', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                    <CheckCircle2 size={18} />
                    Este é o encontro configurado como ativo.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 1.5: Pre-Cadastro Search */}
          <div className="card">
            <h3 style={{ margin: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
              <History size={18} /> Importar do Pré-Cadastro
            </h3>
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
              initialData={initialFormData as any}
            />
          </div>
        </div>
      </main>

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
                    <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>CPF: {p.cpf || '—'} | {p.cidade || '—'}</div>
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
    </div>
  );
}
