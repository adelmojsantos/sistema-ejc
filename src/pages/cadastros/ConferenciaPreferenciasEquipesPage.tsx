import {
  CheckCircle2,
  ClipboardCheck,
  FilterX,
  Loader,
  Save,
  Search,
  Target,
  UserCheck,
  Users,
  UserX,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PageHeader } from '../../components/ui/PageHeader';
import { useEncontros } from '../../contexts/EncontroContext';
import { useEquipes } from '../../hooks/useEquipes';
import { inscricaoService } from '../../services/inscricaoService';
import { pesquisaEncontristaService } from '../../services/pesquisaEncontristaService';
import type { Encontro } from '../../types/encontro';
import type { InscricaoEnriched } from '../../types/inscricao';
import type { PesquisaEncontristaPreferenciasEncontro } from '../../types/pesquisaEncontrista';
import { findPreviousEncounter } from '../../utils/encontroPrevious';
import {
  buildTeamPreferenceConference,
  summarizeTeamPreferenceConference,
  type TeamPreferenceMatch,
} from '../../utils/teamPreferenceConference';
import './ConferenciaPreferenciasEquipesPage.css';

type AssignmentFilter = 'todos' | 'adicionados' | 'nao_adicionados';
type MatchFilter = 'todos' | 'alguma_opcao' | TeamPreferenceMatch;
type PreferencesFilter = 'todos' | 'com_preferencias' | 'sem_preferencias';

const matchLabels: Record<TeamPreferenceMatch, string> = {
  sem_equipe: 'Ainda sem equipe',
  primeira: '1ª opção atendida',
  segunda: '2ª opção atendida',
  terceira: '3ª opção atendida',
  fora_das_opcoes: 'Fora das opções',
};

function normalized(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function encounterLabel(encontro: Pick<Encontro, 'nome' | 'edicao'> | null | undefined) {
  if (!encontro) return 'Não selecionado';
  if (encontro.edicao === null) return encontro.nome;

  const comparableName = normalized(encontro.nome).replace(/[^a-z0-9]/g, '');
  const editionBeforeEjc = `${encontro.edicao}ejc`;
  const ejcBeforeEdition = `ejc${encontro.edicao}`;
  if (comparableName.includes(editionBeforeEjc) || comparableName.includes(ejcBeforeEdition)) {
    return encontro.nome;
  }

  return `${encontro.edicao}º EJC · ${encontro.nome}`;
}

export function ConferenciaPreferenciasEquipesPage() {
  const { encontros, encontroSelecionado, encontroSelecionadoId } = useEncontros();
  const { equipes, isLoading: isLoadingEquipes } = useEquipes();
  const encontroAnterior = useMemo(
    () => findPreviousEncounter(encontros, encontroSelecionadoId),
    [encontros, encontroSelecionadoId],
  );
  const [preferencias, setPreferencias] = useState<PesquisaEncontristaPreferenciasEncontro | null>(null);
  const [participacoesAtuais, setParticipacoesAtuais] = useState<InscricaoEnriched[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>('todos');
  const [matchFilter, setMatchFilter] = useState<MatchFilter>('todos');
  const [preferencesFilter, setPreferencesFilter] = useState<PreferencesFilter>('todos');
  const [preferenceTeamFilter, setPreferenceTeamFilter] = useState('');
  const [currentTeamFilter, setCurrentTeamFilter] = useState('');
  const [staged, setStaged] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!encontroSelecionadoId || !encontroAnterior) {
      setPreferencias(null);
      setParticipacoesAtuais([]);
      setStaged({});
      setLoadError(false);
      setLoading(false);
      setConfirmOpen(false);
      return;
    }

    let active = true;
    setLoading(true);
    setLoadError(false);
    setPreferencias(null);
    setParticipacoesAtuais([]);
    setStaged({});
    setConfirmOpen(false);
    Promise.all([
      pesquisaEncontristaService.listarPreferenciasPorEncontrista(encontroAnterior.id),
      inscricaoService.listarResumoPorEncontro(encontroSelecionadoId),
    ])
      .then(([nextPreferencias, nextParticipacoes]) => {
        if (!active) return;
        setPreferencias(nextPreferencias);
        setParticipacoesAtuais(nextParticipacoes);
      })
      .catch((error) => {
        if (!active) return;
        console.error('Erro ao carregar conferência de preferências:', error);
        setLoadError(true);
        setPreferencias(null);
        setParticipacoesAtuais([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [encontroAnterior, encontroSelecionadoId]);

  const rows = useMemo(
    () => buildTeamPreferenceConference(
      preferencias?.encontristas ?? [],
      participacoesAtuais,
      equipes,
    ),
    [equipes, participacoesAtuais, preferencias],
  );
  const metrics = useMemo(() => summarizeTeamPreferenceConference(rows), [rows]);

  const filteredRows = useMemo(() => {
    const query = normalized(search.trim());
    return rows.filter((row) => {
      if (query && !normalized(row.encontrista.nome).includes(query)) return false;
      if (assignmentFilter === 'adicionados' && row.match === 'sem_equipe') return false;
      if (assignmentFilter === 'nao_adicionados' && row.match !== 'sem_equipe') return false;
      if (matchFilter === 'alguma_opcao' && !['primeira', 'segunda', 'terceira'].includes(row.match)) return false;
      if (
        matchFilter !== 'todos'
        && matchFilter !== 'alguma_opcao'
        && row.match !== matchFilter
      ) return false;
      if (preferencesFilter === 'com_preferencias' && row.encontrista.preferencias.length === 0) return false;
      if (preferencesFilter === 'sem_preferencias' && row.encontrista.preferencias.length > 0) return false;
      if (
        preferenceTeamFilter
        && !row.encontrista.preferencias.some((item) => item.equipeId === preferenceTeamFilter)
      ) return false;
      if (currentTeamFilter === '__none__' && row.currentTeamId) return false;
      if (
        currentTeamFilter
        && currentTeamFilter !== '__none__'
        && row.currentTeamId !== currentTeamFilter
      ) return false;
      return true;
    });
  }, [
    assignmentFilter,
    currentTeamFilter,
    matchFilter,
    preferenceTeamFilter,
    preferencesFilter,
    rows,
    search,
  ]);

  const stagedCount = Object.keys(staged).length;
  const setAssignment = (pessoaId: string, equipeId: string) => {
    setStaged((current) => {
      if (!equipeId) {
        const next = { ...current };
        delete next[pessoaId];
        return next;
      }
      return { ...current, [pessoaId]: equipeId };
    });
  };

  const clearFilters = () => {
    setSearch('');
    setAssignmentFilter('todos');
    setMatchFilter('todos');
    setPreferencesFilter('todos');
    setPreferenceTeamFilter('');
    setCurrentTeamFilter('');
  };

  const saveAssignments = async () => {
    if (!encontroSelecionadoId || stagedCount === 0) return;
    setSaving(true);
    try {
      const result = await pesquisaEncontristaService.atribuirEquipesEmLote(
        encontroSelecionadoId,
        Object.entries(staged).map(([pessoaId, equipeId]) => ({ pessoaId, equipeId })),
      );
      const nextParticipacoes = await inscricaoService.listarResumoPorEncontro(encontroSelecionadoId);
      setParticipacoesAtuais(nextParticipacoes);
      setStaged({});
      setConfirmOpen(false);
      toast.success(
        result.total + ' atribuição' + (result.total === 1 ? '' : 'ões')
        + ' confirmada' + (result.total === 1 ? '' : 's') + '.',
      );
    } catch (error) {
      console.error('Erro ao confirmar atribuições da conferência:', error);
      toast.error('Não foi possível confirmar o lote. Atualize a tela e verifique se alguém já recebeu uma equipe.');
    } finally {
      setSaving(false);
    }
  };

  const metricCards = [
    { label: 'Encontristas anteriores', value: metrics.total, icon: Users, tone: 'blue' },
    { label: 'Já adicionados', value: metrics.assigned, icon: UserCheck, tone: 'green' },
    { label: 'Ainda sem equipe', value: metrics.unassigned, icon: UserX, tone: 'orange' },
    { label: 'Em uma das opções', value: metrics.selectedChoice, icon: Target, tone: 'purple' },
    { label: 'Na 1ª opção', value: metrics.firstChoice, icon: CheckCircle2, tone: 'green' },
    { label: 'Na 2ª opção', value: metrics.secondChoice, icon: CheckCircle2, tone: 'blue' },
    { label: 'Na 3ª opção', value: metrics.thirdChoice, icon: CheckCircle2, tone: 'orange' },
    { label: 'Fora das opções', value: metrics.outsideChoices, icon: ClipboardCheck, tone: 'gray' },
  ] as const;

  return (
    <div className="container team-preference-conference">
      <PageHeader
        title="Conferência de preferências"
        subtitle="Compare as escolhas do encontro anterior com as equipes do encontro atual"
        backPath="/cadastros/montagem"
        actions={(
          <button
            type="button"
            className="btn-primary"
            disabled={stagedCount === 0 || saving}
            onClick={() => setConfirmOpen(true)}
          >
            {saving ? <Loader size={17} className="animate-spin" /> : <Save size={17} />}
            Confirmar atribuições ({stagedCount})
          </button>
        )}
      />

      {!encontroAnterior ? (
        <section className="card team-preference-conference__empty">
          Não existe um encontro anterior ao encontro selecionado.
        </section>
      ) : (
        <>
          <section className="card team-preference-conference__source">
            <ClipboardCheck size={22} />
            <div>
              <strong>Encontros comparados</strong>
              <span>
                Anterior: {encounterLabel(encontroAnterior)}
                {' → '}Atual: {encounterLabel(encontroSelecionado)}
              </span>
            </div>
          </section>

          <section className="team-preference-conference__metrics">
            {metricCards.map(({ label, value, icon: Icon, tone }) => (
              <article className={'card team-preference-metric team-preference-metric--' + tone} key={label}>
                <Icon size={19} />
                <div>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              </article>
            ))}
          </section>

          <section className="card team-preference-conference__filters">
            <label className="team-preference-filter-field">
              <span>Encontrista</span>
              <div className="team-preference-conference__search">
                <Search size={17} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nome..."
                />
              </div>
            </label>
            <label className="team-preference-filter-field">
              <span>Situação no encontro atual</span>
              <select
                value={assignmentFilter}
                onChange={(event) => setAssignmentFilter(event.target.value as AssignmentFilter)}
              >
                <option value="todos">Todos</option>
                <option value="adicionados">Já adicionados</option>
                <option value="nao_adicionados">Ainda sem equipe</option>
              </select>
            </label>
            <label className="team-preference-filter-field">
              <span>Resultado da preferência</span>
              <select
                value={matchFilter}
                onChange={(event) => setMatchFilter(event.target.value as MatchFilter)}
              >
                <option value="todos">Todos</option>
                <option value="alguma_opcao">Em alguma opção</option>
                <option value="primeira">1ª opção</option>
                <option value="segunda">2ª opção</option>
                <option value="terceira">3ª opção</option>
                <option value="fora_das_opcoes">Fora das opções</option>
              </select>
            </label>
            <label className="team-preference-filter-field">
              <span>Preferências informadas</span>
              <select
                value={preferencesFilter}
                onChange={(event) => setPreferencesFilter(event.target.value as PreferencesFilter)}
              >
                <option value="todos">Com ou sem preferências</option>
                <option value="com_preferencias">Com preferências</option>
                <option value="sem_preferencias">Sem preferências</option>
              </select>
            </label>
            <label className="team-preference-filter-field">
              <span>Equipe escolhida</span>
              <select
                value={preferenceTeamFilter}
                onChange={(event) => setPreferenceTeamFilter(event.target.value)}
              >
                <option value="">Qualquer equipe</option>
                {equipes.map((equipe) => <option key={equipe.id} value={equipe.id}>{equipe.nome}</option>)}
              </select>
            </label>
            <label className="team-preference-filter-field">
              <span>Equipe no encontro atual</span>
              <select
                value={currentTeamFilter}
                onChange={(event) => setCurrentTeamFilter(event.target.value)}
              >
                <option value="">Qualquer equipe</option>
                <option value="__none__">Sem equipe atual</option>
                {equipes.map((equipe) => <option key={equipe.id} value={equipe.id}>{equipe.nome}</option>)}
              </select>
            </label>
            <button type="button" className="btn-secondary team-preference-filter-clear" onClick={clearFilters}>
              <FilterX size={16} /> Limpar filtros
            </button>
          </section>

          {loading || isLoadingEquipes ? (
            <section className="card team-preference-conference__empty">
              <Loader size={24} className="animate-spin" /> Carregando conferência...
            </section>
          ) : loadError ? (
            <section className="card team-preference-conference__empty is-error">
              Não foi possível carregar a conferência de preferências.
            </section>
          ) : (
            <section className="card team-preference-conference__relation">
              <header>
                <div>
                  <strong>Relação de encontristas</strong>
                  <span>{filteredRows.length} de {rows.length}</span>
                </div>
                {stagedCount > 0 && <span className="team-preference-conference__draft">{stagedCount} no rascunho</span>}
              </header>
              {!filteredRows.length ? (
                <div className="team-preference-conference__empty">Nenhum encontrista corresponde aos filtros.</div>
              ) : (
                <div className="team-preference-table">
                  <div className="team-preference-table__header">
                    <span>Encontrista</span>
                    <span>Opções escolhidas</span>
                    <span>Equipe atual</span>
                    <span>Resultado</span>
                    <span>Atribuição</span>
                  </div>
                  {filteredRows.map((row) => {
                    const stagedTeamId = staged[row.encontrista.pessoaId] ?? '';
                    const stagedTeamName = equipes.find((item) => item.id === stagedTeamId)?.nome;
                    return (
                      <article className="team-preference-table__row" key={row.encontrista.pessoaId}>
                        <div data-label="Encontrista">
                          <strong>{row.encontrista.nome}</strong>
                          {!row.encontrista.preferencias.length && <small>Não informou opções</small>}
                        </div>
                        <div className="team-preference-table__choices" data-label="Opções escolhidas">
                          {row.encontrista.preferencias.length ? row.encontrista.preferencias.map((preferencia) => (
                            row.match === 'sem_equipe'
                            && preferencia.equipeDisponivel
                            && equipes.some((equipe) => equipe.id === preferencia.equipeId) ? (
                              <button
                                type="button"
                                key={preferencia.equipeId}
                                className={stagedTeamId === preferencia.equipeId ? 'is-selected' : ''}
                                onClick={() => setAssignment(row.encontrista.pessoaId, preferencia.equipeId)}
                              >
                                <b>{preferencia.ordemPreferencia}ª</b> {preferencia.equipeNome}
                              </button>
                            ) : (
                              <span
                                key={preferencia.equipeId}
                                className={!preferencia.equipeDisponivel ? 'is-unavailable' : undefined}
                              >
                                <b>{preferencia.ordemPreferencia}ª</b> {preferencia.equipeNome}
                              </span>
                            )
                          )) : <span className="is-muted">Sem preferências</span>}
                        </div>
                        <div data-label="Equipe atual">
                          {row.currentTeamName
                            ? <span className="team-preference-current-team">{row.currentTeamName}</span>
                            : <span className="is-muted">Sem equipe</span>}
                        </div>
                        <div data-label="Resultado">
                          <span className={'team-preference-match team-preference-match--' + row.match}>
                            {matchLabels[row.match]}
                          </span>
                        </div>
                        <div data-label="Atribuição">
                          {row.match !== 'sem_equipe' ? (
                            <span className="team-preference-assigned">Adicionado na equipe {row.currentTeamName}</span>
                          ) : (
                            <div className="team-preference-table__assignment">
                              <select
                                value={stagedTeamId}
                                onChange={(event) => setAssignment(row.encontrista.pessoaId, event.target.value)}
                                aria-label={'Equipe para ' + row.encontrista.nome}
                              >
                                <option value="">Selecionar equipe</option>
                                {equipes.map((equipe) => (
                                  <option key={equipe.id} value={equipe.id}>{equipe.nome}</option>
                                ))}
                              </select>
                              {stagedTeamName && <small>Rascunho: {stagedTeamName}</small>}
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </>
      )}

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Confirmar atribuições"
        message={
          'Deseja adicionar ' + stagedCount + ' encontrista' + (stagedCount === 1 ? '' : 's')
          + ' às equipes selecionadas? Pessoas que já tenham recebido uma equipe não serão movidas.'
        }
        confirmText="Confirmar lote"
        onConfirm={saveAssignments}
        onCancel={() => setConfirmOpen(false)}
        isLoading={saving}
      />
    </div>
  );
}
