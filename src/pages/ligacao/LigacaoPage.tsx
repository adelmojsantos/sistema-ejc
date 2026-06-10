import {
  CircleUserRound,
  Loader,
  Mail,
  Search,
  UserRound,
  UsersRound,
  X
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { PageHeader } from '../../components/ui/PageHeader';
import { useEncontros } from '../../contexts/EncontroContext';
import { useEquipes } from '../../contexts/EquipeContext';
import { useAuth } from '../../hooks/useAuth';
import { useDebounce } from '../../hooks/useDebounce';
import { encontroService } from '../../services/encontroService';
import { ligacaoService } from '../../services/ligacaoService';
import type { Encontro } from '../../types/encontro';
import type { LigacaoCorEquipe, LigacaoRegistro, LigacaoTipoPessoa } from '../../types/ligacao';
import { normalizeString } from '../../utils/stringUtils';
import './LigacaoPage.css';

type LigacaoFiltroCor = 'todas' | LigacaoCorEquipe;

const equipeCorLabel: Record<LigacaoCorEquipe, string> = {
  verde: 'Verde',
  amarela: 'Amarela',
  vermelha: 'Vermelha'
};

function LigacaoAvatar({ registro }: { registro: LigacaoRegistro }) {
  if (registro.foto_url) {
    return (
      <img
        className="ligacao-avatar"
        src={registro.foto_url}
        alt={registro.nome}
        style={{ objectPosition: `center ${registro.foto_posicao_y}%` }}
      />
    );
  }

  return (
    <div className="ligacao-avatar ligacao-avatar--placeholder" aria-hidden="true">
      {registro.nome.charAt(0).toUpperCase()}
    </div>
  );
}

function LigacaoCard({ registro }: { registro: LigacaoRegistro }) {
  const isParticipante = registro.tipo === 'participante';

  return (
    <article className={`ligacao-card ligacao-card--${registro.tipo} ${!isParticipante ? `ligacao-card--team-${registro.equipe_cor || 'verde'}` : ''}`}>
      <div className="ligacao-card__header">
        <LigacaoAvatar registro={registro} />
        <div className="ligacao-card__identity">
          <span className="ligacao-card__type">
            {isParticipante ? <UserRound size={13} /> : <CircleUserRound size={13} />}
            {isParticipante ? 'Participante' : 'Encontreiro'}
          </span>
          <h3>{registro.nome}</h3>
          {!isParticipante && (
            <div className={`ligacao-team-badge ligacao-team-badge--${registro.equipe_cor || 'verde'}`}>
              <span className="ligacao-team-badge__dot" />
              <span>Equipe: {registro.equipe || 'Não informada'}</span>
            </div>
          )}
        </div>
      </div>

      {isParticipante && (
        <dl className="ligacao-card__details">
          <div>
            <dt>Comunidade</dt>
            <dd>{registro.comunidade || 'Não informada'}</dd>
          </div>
          <div>
            <dt>Círculo</dt>
            <dd>{registro.circulo || 'Não informado'}</dd>
          </div>
          <div>
            <dt>Dupla de visitação</dt>
            <dd>{registro.dupla_visitacao || 'Não informada'}</dd>
          </div>
        </dl>
      )}
    </article>
  );
}

export function LigacaoPage() {
  const { hasPermission } = useAuth();
  const { encontros, encontroAtivo } = useEncontros();
  const { equipes } = useEquipes();
  const [selectedEncontroId, setSelectedEncontroId] = useState('');
  const [registros, setRegistros] = useState<LigacaoRegistro[]>([]);
  const [activeTab, setActiveTab] = useState<LigacaoTipoPessoa>('participante');
  const [teamColorFilter, setTeamColorFilter] = useState<LigacaoFiltroCor>('todas');
  const [teamFilter, setTeamFilter] = useState('todas');
  const [circleFilter, setCircleFilter] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const debouncedSearch = useDebounce(searchTerm, 300);

  const canChangeEncontro = hasPermission('modulo_admin');

  useEffect(() => {
    const selectedExists = encontros.some((encontro) => encontro.id === selectedEncontroId);
    if (!selectedEncontroId || !selectedExists) {
      setSelectedEncontroId(encontroAtivo?.id ?? encontros[0]?.id ?? '');
    }
  }, [encontroAtivo, encontros, selectedEncontroId]);

  const loadRegistros = useCallback(async () => {
    if (!selectedEncontroId) {
      setRegistros([]);
      return;
    }

    setIsLoading(true);
    try {
      setRegistros(await ligacaoService.listarPorEncontro(selectedEncontroId));
    } catch (error) {
      console.error('Erro ao carregar registros da Ligação:', error);
      toast.error('Não foi possível carregar a lista da Ligação.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedEncontroId]);

  useEffect(() => {
    loadRegistros();
  }, [loadRegistros]);

  const participantes = useMemo(
    () => registros.filter((registro) => registro.tipo === 'participante'),
    [registros]
  );

  const encontreiros = useMemo(
    () => registros.filter((registro) => registro.tipo === 'encontreiro'),
    [registros]
  );

  const circulos = useMemo(
    () => Array.from(new Set(participantes.map((registro) => registro.circulo).filter((circulo): circulo is string => !!circulo)))
      .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })),
    [participantes]
  );

  const filteredRegistros = useMemo(() => {
    const term = normalizeString(debouncedSearch.trim());
    const current = activeTab === 'participante' ? participantes : encontreiros;

    return current.filter((registro) => {
      if (activeTab === 'encontreiro' && teamColorFilter !== 'todas' && registro.equipe_cor !== teamColorFilter) {
        return false;
      }
      if (activeTab === 'encontreiro' && teamFilter !== 'todas' && registro.equipe_id !== teamFilter) {
        return false;
      }
      if (activeTab === 'participante' && circleFilter !== 'todos' && registro.circulo !== circleFilter) {
        return false;
      }

      if (!term) return true;

      const searchable = activeTab === 'participante'
        ? [registro.nome, registro.comunidade, registro.circulo, registro.dupla_visitacao]
        : [registro.nome, registro.equipe, registro.equipe_cor ? equipeCorLabel[registro.equipe_cor] : null];

      return normalizeString(searchable.filter(Boolean).join(' ')).includes(term);
    });
  }, [activeTab, circleFilter, debouncedSearch, encontreiros, participantes, teamColorFilter, teamFilter]);

  const encontroSelector = canChangeEncontro ? (
    <div className="ligacao-header-encontro">
      <LiveSearchSelect<Encontro>
        value={selectedEncontroId}
        onChange={(value) => setSelectedEncontroId(value)}
        fetchData={(search, page) => encontroService.buscarComPaginacao(search, page)}
        getOptionLabel={(encontro) => `${encontro.nome}${encontro.ativo ? ' (Ativo)' : ''}`}
        getOptionValue={(encontro) => encontro.id}
        placeholder="Selecionar encontro..."
        initialOptions={encontros}
      />
    </div>
  ) : undefined;

  const tabs = (
    <div className="ligacao-tabs" role="tablist" aria-label="Pessoas do encontro">
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'participante'}
        className={activeTab === 'participante' ? 'is-active' : ''}
        onClick={() => setActiveTab('participante')}
      >
        <UserRound size={17} />
        Participantes
        <span>{participantes.length}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'encontreiro'}
        className={activeTab === 'encontreiro' ? 'is-active' : ''}
        onClick={() => setActiveTab('encontreiro')}
      >
        <UsersRound size={17} />
        Encontreiros
        <span>{encontreiros.length}</span>
      </button>
    </div>
  );

  return (
    <div className="ligacao-page fade-in">
      <PageHeader
        title="Ligação"
        subtitle="Localização para entrega de cartas e recados"
        backPath="/dashboard"
        actions={encontroSelector}
        tabs={tabs}
      />

      <section className="ligacao-toolbar">
        <div className="form-group ligacao-search-group">
          <label className="form-label">Buscar</label>
          <div className="form-input-wrapper">
            <div className="form-input-icon">
              <Search size={16} />
            </div>
            <input
              type="text"
              className="form-input form-input--with-icon"
              placeholder={activeTab === 'participante'
                ? 'Nome, comunidade, círculo ou dupla...'
                : 'Nome ou equipe...'}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="ligacao-clear-search"
                onClick={() => setSearchTerm('')}
                aria-label="Limpar busca"
                title="Limpar busca"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {activeTab === 'participante' ? (
          <div className="form-group">
            <label className="form-label" htmlFor="ligacao-circulo-filter">Círculo</label>
            <select
              id="ligacao-circulo-filter"
              className="form-input"
              value={circleFilter}
              onChange={(event) => setCircleFilter(event.target.value)}
            >
              <option value="todos">Todos os círculos</option>
              {circulos.map((circulo) => (
                <option key={circulo} value={circulo}>{circulo}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="form-group">
            <label className="form-label" htmlFor="ligacao-equipe-filter">Equipe</label>
            <select
              id="ligacao-equipe-filter"
              className="form-input"
              value={teamFilter}
              onChange={(event) => setTeamFilter(event.target.value)}
            >
              <option value="todas">Todas as equipes</option>
              {equipes.map((equipe) => (
                <option key={equipe.id} value={equipe.id}>
                  {equipe.nome || 'Equipe sem nome'}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>

      <div className="ligacao-list-controls">
        {activeTab === 'encontreiro' && (
          <div className="ligacao-color-filter" role="group" aria-label="Filtrar pela cor da equipe">
            {(['todas', 'verde', 'amarela', 'vermelha'] as LigacaoFiltroCor[]).map((color) => (
              <button
                key={color}
                type="button"
                className={`ligacao-color-filter__button ligacao-color-filter__button--${color} ${teamColorFilter === color ? 'is-active' : ''}`}
                onClick={() => setTeamColorFilter(color)}
              >
                {color === 'todas' ? 'Todas as cores' : equipeCorLabel[color]}
              </button>
            ))}
          </div>
        )}
        <div className="ligacao-result-summary">
          <span>
            <strong>{filteredRegistros.length}</strong> de{' '}
            <strong>{activeTab === 'participante' ? participantes.length : encontreiros.length}</strong>{' '}
            {activeTab === 'participante' ? 'participantes' : 'encontreiros'}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="ligacao-state">
          <Loader className="spin" size={22} />
          Carregando lista...
        </div>
      ) : filteredRegistros.length === 0 ? (
        <div className="ligacao-state ligacao-state--empty">
          <Mail size={34} />
          <h3>Nenhum registro encontrado</h3>
          <p>Ajuste a busca ou os filtros para localizar outra pessoa.</p>
        </div>
      ) : (
        <section className="ligacao-grid">
          {filteredRegistros.map((registro) => (
            <LigacaoCard key={registro.participacao_id} registro={registro} />
          ))}
        </section>
      )}
    </div>
  );
}
