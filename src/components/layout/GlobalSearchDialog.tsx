import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CircleDot,
  PackageSearch,
  Search,
  ShoppingCart,
  User,
  Users,
  UsersRound,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  getGlobalSearchCommands,
  normalizeGlobalSearchText,
} from '../../config/globalSearchCommands';
import { useEncontros } from '../../contexts/EncontroContext';
import { useAuth } from '../../hooks/useAuth';
import { globalSearchService, type GlobalSearchResult, type GlobalSearchResultType } from '../../services/globalSearchService';
import {
  ALMOXARIFADO_ORDER_ROUTE_PERMISSIONS,
  ALMOXARIFADO_PURCHASE_HISTORY_ROUTE_PERMISSIONS,
  hasAnyPermission,
} from '../../utils/accessControl';
import { Modal } from '../ui/Modal';

interface GlobalSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPerson: (participacaoId: string) => void;
  suspended?: boolean;
}

const categoryLabels: Record<GlobalSearchResultType, string> = {
  pessoa: 'Pessoas',
  equipe: 'Equipes',
  dupla: 'Duplas de visitação',
  circulo: 'Círculos',
  pedido: 'Pedidos',
  compra: 'Compras realizadas',
};

const resultIcons = {
  pessoa: User,
  equipe: Users,
  dupla: UsersRound,
  circulo: CircleDot,
  pedido: PackageSearch,
  compra: ShoppingCart,
} satisfies Record<GlobalSearchResultType, typeof User>;

export function GlobalSearchDialog({
  isOpen,
  onClose,
  onSelectPerson,
  suspended = false,
}: GlobalSearchDialogProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const savedScrollTopRef = useRef(0);
  const { encontroSelecionado, encontroSelecionadoId } = useEncontros();
  const { hasPermission, hasExactPermission, userParticipacao } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [partialFailure, setPartialFailure] = useState(false);

  const scope = useMemo(() => ({
    pessoas: hasAnyPermission(hasPermission, ['modulo_secretaria', 'modulo_cadastros', 'modulo_admin']),
    equipes: hasAnyPermission(hasPermission, ['modulo_secretaria', 'modulo_cadastros', 'modulo_admin']),
    duplas: hasAnyPermission(hasPermission, ['modulo_visitacao_coordenar', 'modulo_admin']),
    circulos: hasAnyPermission(hasPermission, ['modulo_circulos_coordenador', 'modulo_admin']),
    pedidos: hasAnyPermission(hasPermission, ALMOXARIFADO_ORDER_ROUTE_PERMISSIONS),
    compras: hasAnyPermission(hasPermission, ALMOXARIFADO_PURCHASE_HISTORY_ROUTE_PERMISSIONS),
  }), [hasPermission]);
  const commands = useMemo(() => {
    const context = {
      hasPermission,
      hasExactPermission,
      isCoordinator: Boolean(userParticipacao?.coordenador),
      teamName: userParticipacao?.equipes?.nome ?? '',
    };
    return getGlobalSearchCommands(context);
  }, [hasExactPermission, hasPermission, userParticipacao]);

  const normalizedQuery = normalizeGlobalSearchText(query);
  const matchingCommands = useMemo(() => {
    if (normalizedQuery.length === 0) {
      return commands.filter((command) => command.id.startsWith('root-'));
    }
    if (normalizedQuery.length < 2) return [];
    return commands.filter((command) => normalizeGlobalSearchText(
      `${command.label} ${command.description} ${command.keywords}`
    ).includes(normalizedQuery));
  }, [commands, normalizedQuery]);

  useEffect(() => {
    if (!isOpen || suspended) return;
    window.setTimeout(() => {
      inputRef.current?.focus();
      if (resultsRef.current) resultsRef.current.scrollTop = savedScrollTopRef.current;
    }, 0);
  }, [isOpen, suspended]);

  useEffect(() => {
    if (isOpen) return;
    setQuery('');
    setResults([]);
    setPartialFailure(false);
    savedScrollTopRef.current = 0;
  }, [isOpen]);

  useEffect(() => {
    const term = query.trim();
    if (!isOpen || suspended) return;
    if (term.length < 3 || !encontroSelecionadoId) {
      setResults([]);
      setPartialFailure(false);
      setLoading(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await globalSearchService.search({ encontroId: encontroSelecionadoId, term, scope });
        if (active) {
          setResults(response.results);
          setPartialFailure(response.partialFailure);
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [encontroSelecionadoId, isOpen, query, scope, suspended]);

  const groupedResults = useMemo(() => Object.entries(categoryLabels)
    .map(([type, label]) => ({
      type: type as GlobalSearchResultType,
      label,
      results: results.filter((result) => result.type === type),
    }))
    .filter((category) => category.results.length > 0), [results]);

  const handleSelect = (result: GlobalSearchResult) => {
    if (result.type === 'pessoa' && result.participacaoId) {
      savedScrollTopRef.current = resultsRef.current?.scrollTop ?? 0;
      onSelectPerson(result.participacaoId);
      return;
    }
    if (result.route) {
      resetAndClose();
      navigate(result.route);
    }
  };

  const handleModuleSelect = (path: string) => {
    resetAndClose();
    navigate(path);
  };

  const resetAndClose = () => {
    setQuery('');
    setResults([]);
    setPartialFailure(false);
    savedScrollTopRef.current = 0;
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={resetAndClose}
      title="Buscar no sistema"
      maxWidth="760px"
      suspended={suspended}
    >
      <div className="global-search">
        <div className="global-search__input-wrap">
          <Search size={21} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              savedScrollTopRef.current = 0;
              if (resultsRef.current) resultsRef.current.scrollTop = 0;
              setQuery(event.target.value);
            }}
            placeholder="Busque pessoa, equipe, dupla, círculo, pedido ou compra..."
            aria-label="Buscar no sistema"
          />
          {query.length > 0 && (
            <button
              type="button"
              className="global-search__clear"
              onClick={() => {
                setQuery('');
                setResults([]);
                setPartialFailure(false);
                savedScrollTopRef.current = 0;
                if (resultsRef.current) resultsRef.current.scrollTop = 0;
                inputRef.current?.focus();
              }}
              aria-label="Limpar pesquisa"
              title="Limpar pesquisa"
            >
              <X size={17} />
            </button>
          )}
          <kbd>Ctrl K</kbd>
        </div>

        <div className="global-search__context">
          Resultados em <strong>{encontroSelecionado?.nome ?? 'encontro selecionado'}</strong>
        </div>

        <div ref={resultsRef} className="global-search__results">
        {matchingCommands.length > 0 && (
          <section className="global-search__category global-search__modules">
            <h4>{normalizedQuery.length === 0 ? 'Áreas disponíveis' : 'Telas e atalhos'}</h4>
            <div className="global-search__module-grid">
              {matchingCommands.map((command) => {
                const Icon = command.icon;
                return (
                  <button key={command.id} type="button" onClick={() => handleModuleSelect(command.path)}>
                    <span className="global-search__result-icon"><Icon size={19} /></span>
                    <span><strong>{command.label}</strong><small>{command.description}</small></span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
        {normalizedQuery.length === 1 && (
          <div className="global-search__empty">Digite mais um caractere para buscar telas e atalhos.</div>
        )}
        {normalizedQuery.length === 2 && matchingCommands.length === 0 && (
          <div className="global-search__empty">Digite mais um caractere para buscar também nos registros.</div>
        )}
        {loading && <div className="global-search__empty">Buscando...</div>}
        {!loading && partialFailure && results.length > 0 && (
          <div className="global-search__notice">Algumas áreas não puderam ser consultadas agora.</div>
        )}
        {!loading && normalizedQuery.length >= 3 && groupedResults.length === 0 && matchingCommands.length === 0 && (
          <div className="global-search__empty">
            {partialFailure
              ? 'Não foi possível concluir a busca agora. Tente novamente.'
              : 'Nenhum resultado encontrado nas áreas que você pode acessar.'}
          </div>
        )}

        {!loading && groupedResults.map((category) => (
          <section key={category.type} className="global-search__category">
            <h4>{category.label}</h4>
            {category.results.map((result) => {
              const Icon = resultIcons[result.type];
              return (
                <button key={`${result.type}:${result.id}`} type="button" onClick={() => handleSelect(result)}>
                  <span className="global-search__result-icon"><Icon size={19} /></span>
                  <span>
                    <strong>{result.title}</strong>
                    <small>{result.description}</small>
                  </span>
                </button>
              );
            })}
          </section>
        ))}
        </div>
      </div>
    </Modal>
  );
}
