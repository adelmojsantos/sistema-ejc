import { AlertTriangle, CheckCircle, ChevronDown, Clock3, FileText, Search, Shirt, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { StorageLink } from '../storage/StorageLink';

export type CamisetaSeparationOrigin = 'equipes' | 'encontristas';
export type CamisetaPaymentFilter = 'todos' | 'pagos' | 'pendentes';

export interface CamisetaSeparationItem {
  id: string;
  groupKey: string;
  groupName: string;
  personName: string;
  modelName: string;
  size: string;
  quantity: number;
  paid: boolean;
  missingGroup?: boolean;
  proofReference?: string | null;
}

interface CamisetaSeparationPanelProps {
  teamItems: CamisetaSeparationItem[];
  encounteredItems: CamisetaSeparationItem[];
  loading?: boolean;
}

const paymentFilters: Array<{ value: CamisetaPaymentFilter; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'pagos', label: 'Pagos' },
  { value: 'pendentes', label: 'Pendentes' },
];

export function CamisetaSeparationPanel({
  teamItems,
  encounteredItems,
  loading = false,
}: CamisetaSeparationPanelProps) {
  const [view, setView] = useState<'separacao' | 'producao'>('separacao');
  const [origin, setOrigin] = useState<CamisetaSeparationOrigin>('equipes');
  const [paymentFilter, setPaymentFilter] = useState<CamisetaPaymentFilter>('todos');
  const [search, setSearch] = useState('');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());

  const allItems = useMemo(() => [...teamItems, ...encounteredItems], [teamItems, encounteredItems]);
  const sourceItems = origin === 'equipes' ? teamItems : encounteredItems;
  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');

  const visibleItems = useMemo(() => sourceItems.filter(item => {
    const matchesPayment = paymentFilter === 'todos'
      || (paymentFilter === 'pagos' && item.paid)
      || (paymentFilter === 'pendentes' && !item.paid);
    const matchesSearch = !normalizedSearch
      || item.personName.toLocaleLowerCase('pt-BR').includes(normalizedSearch)
      || item.groupName.toLocaleLowerCase('pt-BR').includes(normalizedSearch)
      || item.modelName.toLocaleLowerCase('pt-BR').includes(normalizedSearch)
      || item.size.toLocaleLowerCase('pt-BR').includes(normalizedSearch);

    return matchesPayment && matchesSearch;
  }), [normalizedSearch, paymentFilter, sourceItems]);

  const groups = useMemo(() => {
    const map = new Map<string, { name: string; missing: boolean; items: CamisetaSeparationItem[] }>();

    visibleItems.forEach(item => {
      const current = map.get(item.groupKey) ?? {
        name: item.groupName,
        missing: Boolean(item.missingGroup),
        items: [],
      };
      current.items.push(item);
      map.set(item.groupKey, current);
    });

    return Array.from(map.entries())
      .map(([key, group]) => ({
        key,
        ...group,
        items: [...group.items].sort((a, b) => {
          const personCompare = a.personName.localeCompare(b.personName, 'pt-BR');
          if (personCompare !== 0) return personCompare;
          const modelCompare = a.modelName.localeCompare(b.modelName, 'pt-BR');
          if (modelCompare !== 0) return modelCompare;
          return a.size.localeCompare(b.size, 'pt-BR');
        }),
      }))
      .sort((a, b) => Number(b.missing) - Number(a.missing) || a.name.localeCompare(b.name, 'pt-BR'));
  }, [visibleItems]);

  const units = (items: CamisetaSeparationItem[]) => items.reduce((sum, item) => sum + item.quantity, 0);
  const paidUnits = units(allItems.filter(item => item.paid));
  const pendingUnits = units(allItems.filter(item => !item.paid));

  const productionGroups = useMemo(() => {
    const map = new Map<string, Map<string, {
      size: string;
      teamUnits: number;
      encounteredUnits: number;
      paidUnits: number;
      pendingUnits: number;
    }>>();

    const append = (item: CamisetaSeparationItem, itemOrigin: CamisetaSeparationOrigin) => {
      const model = map.get(item.modelName) ?? new Map();
      const size = model.get(item.size) ?? {
        size: item.size,
        teamUnits: 0,
        encounteredUnits: 0,
        paidUnits: 0,
        pendingUnits: 0,
      };

      if (itemOrigin === 'equipes') size.teamUnits += item.quantity;
      else size.encounteredUnits += item.quantity;
      if (item.paid) size.paidUnits += item.quantity;
      else size.pendingUnits += item.quantity;

      model.set(item.size, size);
      map.set(item.modelName, model);
    };

    teamItems.forEach(item => append(item, 'equipes'));
    encounteredItems.forEach(item => append(item, 'encontristas'));

    return Array.from(map.entries())
      .map(([modelName, sizes]) => ({
        modelName,
        sizes: Array.from(sizes.values()).sort((a, b) => a.size.localeCompare(b.size, 'pt-BR', { numeric: true })),
      }))
      .map(group => ({
        ...group,
        totalUnits: group.sizes.reduce((sum, size) => sum + size.teamUnits + size.encounteredUnits, 0),
      }))
      .sort((a, b) => a.modelName.localeCompare(b.modelName, 'pt-BR'));
  }, [encounteredItems, teamItems]);

  const toggleGroup = (groupKey: string) => {
    setOpenGroups(current => {
      const next = new Set(current);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  return (
    <section className="camiseta-separation" aria-labelledby="camiseta-separation-title">
      <button
        type="button"
        className="camiseta-separation__toggle"
        aria-expanded={isPanelOpen}
        aria-controls="camiseta-separation-content"
        onClick={() => setIsPanelOpen(current => !current)}
      >
        <div className="camiseta-separation__toggle-title">
          <span className="camiseta-separation__toggle-icon"><Shirt size={21} aria-hidden="true" /></span>
          <div>
            <span className="camiseta-separation__eyebrow">Conferência e separação</span>
            <h2 id="camiseta-separation-title">Pedidos de camisetas</h2>
          </div>
        </div>
        <div className="camiseta-separation__compact-metrics" aria-label="Resumo dos pedidos">
          <span><small>Total</small><strong>{units(allItems)}</strong></span>
          <span className="is-paid"><small>Pagas</small><strong>{paidUnits}</strong></span>
          <span className="is-pending"><small>Pendentes</small><strong>{pendingUnits}</strong></span>
        </div>
        <span className="camiseta-separation__toggle-action">
          {isPanelOpen ? 'Ocultar pedidos' : 'Ver pedidos'}
          <ChevronDown size={19} aria-hidden="true" />
        </span>
      </button>

      {isPanelOpen && (
        <div id="camiseta-separation-content" className="camiseta-separation__content">
          <p className="camiseta-separation__description">
            Consulte quem pediu, confira pagamentos e veja os totais para produção.
          </p>

          <div className="camiseta-separation__modes" role="tablist" aria-label="Visão dos pedidos">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'separacao'}
              className={view === 'separacao' ? 'is-active' : ''}
              onClick={() => setView('separacao')}
            >
              Separação
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'producao'}
              className={view === 'producao' ? 'is-active' : ''}
              onClick={() => setView('producao')}
            >
              Produção
            </button>
          </div>

          {view === 'separacao' ? <>
          <div className="camiseta-separation__toolbar">
            <div className="camiseta-separation__origins" role="tablist" aria-label="Origem dos pedidos">
              <button
                type="button"
                role="tab"
                aria-selected={origin === 'equipes'}
                className={origin === 'equipes' ? 'is-active' : ''}
                onClick={() => setOrigin('equipes')}
              >
                <Users size={17} />
                Equipes
                <span>{units(teamItems)}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={origin === 'encontristas'}
                className={origin === 'encontristas' ? 'is-active' : ''}
                onClick={() => setOrigin('encontristas')}
              >
                <Users size={17} />
                Encontristas
                <span>{units(encounteredItems)}</span>
              </button>
            </div>

            <div className="camiseta-separation__filters" aria-label="Filtrar por pagamento">
              {paymentFilters.map(filter => (
                <button
                  key={filter.value}
                  type="button"
                  className={paymentFilter === filter.value ? 'is-active' : ''}
                  onClick={() => setPaymentFilter(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <label className="camiseta-separation__search">
              <Search size={17} aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder={origin === 'equipes' ? 'Buscar equipe, pessoa ou camiseta' : 'Buscar dupla, encontrista ou camiseta'}
              />
            </label>
          </div>

          {loading ? (
            <div className="camiseta-separation__empty">Carregando pedidos...</div>
          ) : groups.length === 0 ? (
            <div className="camiseta-separation__empty">
              Nenhum pedido encontrado com os filtros selecionados.
            </div>
          ) : (
            <div className="camiseta-separation__groups">
              {groups.map(group => {
                const total = units(group.items);
                const paid = units(group.items.filter(item => item.paid));
                const pending = total - paid;
                const people = new Set(group.items.map(item => item.personName)).size;
                const isGroupOpen = Boolean(normalizedSearch) || openGroups.has(group.key);

                return (
                  <article key={group.key} className={`camiseta-separation__group ${group.missing ? 'is-warning' : ''}`}>
                    <button
                      type="button"
                      className="camiseta-separation__group-toggle"
                      aria-expanded={isGroupOpen}
                      aria-disabled={Boolean(normalizedSearch)}
                      onClick={() => {
                        if (!normalizedSearch) toggleGroup(group.key);
                      }}
                    >
                      <div>
                        <span>{origin === 'equipes' ? 'Equipe' : 'Dupla de visitação'}</span>
                        <h3>
                          {group.missing && <AlertTriangle size={17} aria-hidden="true" />}
                          {group.name}
                        </h3>
                      </div>
                      <div className="camiseta-separation__group-totals">
                        <strong>{total} {total === 1 ? 'camiseta' : 'camisetas'}</strong>
                        <span>{people} {people === 1 ? 'pessoa' : 'pessoas'} · {paid} pagas · {pending} pendentes</span>
                      </div>
                      <ChevronDown className="camiseta-separation__group-chevron" size={19} aria-hidden="true" />
                    </button>

                    {isGroupOpen && (
                      <div className="camiseta-separation__rows">
                        {group.items.map(item => (
                          <div key={item.id} className="camiseta-separation__row">
                            <div className="camiseta-separation__person">
                              <strong>{item.personName}</strong>
                              <span>{item.modelName}</span>
                              {item.proofReference && (
                                <StorageLink
                                  reference={item.proofReference}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="camiseta-separation__proof"
                                >
                                  <FileText size={14} aria-hidden="true" />
                                  Ver comprovante
                                </StorageLink>
                              )}
                            </div>
                            <div className="camiseta-separation__order">
                              <span>Tamanho <strong>{item.size}</strong></span>
                              <span>Quantidade <strong>{item.quantity}</strong></span>
                            </div>
                            <span className={`camiseta-separation__payment ${item.paid ? 'is-paid' : 'is-pending'}`}>
                              {item.paid ? <CheckCircle size={15} /> : <Clock3 size={15} />}
                              {item.paid ? 'Pago' : 'Pendente'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
          </> : loading ? (
            <div className="camiseta-separation__empty">Carregando pedidos...</div>
          ) : productionGroups.length === 0 ? (
            <div className="camiseta-separation__empty">Nenhum pedido registrado para este encontro.</div>
          ) : (
            <div className="camiseta-production">
              {productionGroups.map(group => (
                <article key={group.modelName} className="camiseta-production__model">
                  <header>
                    <h3>{group.modelName}</h3>
                    <span>{group.totalUnits} {group.totalUnits === 1 ? 'camiseta' : 'camisetas'}</span>
                  </header>
                  <div className="camiseta-production__table">
                    <div className="camiseta-production__row camiseta-production__row--header" aria-hidden="true">
                      <span>Tamanho</span><span>Equipes</span><span>Encontristas</span><span>Total</span><span>Pagas</span><span>Pendentes</span>
                    </div>
                    {group.sizes.map(size => {
                      const total = size.teamUnits + size.encounteredUnits;
                      return (
                        <div key={size.size} className="camiseta-production__row">
                          <strong data-label="Tamanho">{size.size}</strong>
                          <span data-label="Equipes">{size.teamUnits}</span>
                          <span data-label="Encontristas">{size.encounteredUnits}</span>
                          <strong data-label="Total">{total}</strong>
                          <span data-label="Pagas" className="is-paid">{size.paidUnits}</span>
                          <span data-label="Pendentes" className="is-pending">{size.pendingUnits}</span>
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
