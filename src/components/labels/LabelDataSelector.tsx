import { CheckSquare, ChevronDown, Loader, Search, Square, Users, X } from 'lucide-react';
import { useMemo } from 'react';
import type { Equipe } from '../../types/equipe';
import type { LabelDataFilters, LabelDataItem, LabelGrouping, LabelTeamColor } from '../../types/label';
import { matchesLabelTeamScope, sortLabelItems } from '../../utils/labelLayout';

interface LabelDataSelectorProps {
  items: LabelDataItem[];
  selectedIds: Set<string>;
  filters: LabelDataFilters;
  equipes: Equipe[];
  grouping: LabelGrouping;
  isLoading: boolean;
  onFiltersChange: (filters: LabelDataFilters) => void;
  onGroupingChange: (grouping: LabelGrouping) => void;
  onToggle: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onClear: () => void;
}

export function LabelDataSelector({
  items,
  selectedIds,
  filters,
  equipes,
  grouping,
  isLoading,
  onFiltersChange,
  onGroupingChange,
  onToggle,
  onSelectAll,
  onClear,
}: LabelDataSelectorProps) {
  const circles = useMemo(() => [...new Set(items.map((item) => item.circulo))].sort(), [items]);
  const filtered = useMemo(() => {
    const search = filters.search.toLocaleLowerCase('pt-BR').trim();
    return sortLabelItems(items.filter((item) =>
      (!search || `${item.nome} ${item.equipe} ${item.circulo}`.toLocaleLowerCase('pt-BR').includes(search)) &&
      (!filters.equipeId || item.equipeId === filters.equipeId) &&
      matchesLabelTeamScope(item, filters) &&
      (!filters.circulo || item.circulo === filters.circulo) &&
      (!filters.status || item.status === filters.status) &&
      (!filters.tipo || item.tipo === filters.tipo)
    ), grouping);
  }, [filters, grouping, items]);

  const setFilter = <K extends keyof LabelDataFilters>(key: K, value: LabelDataFilters[K]) => onFiltersChange({ ...filters, [key]: value });
  const toggleEquipe = (id: string) => setFilter('equipeIds', filters.equipeIds.includes(id) ? filters.equipeIds.filter((item) => item !== id) : [...filters.equipeIds, id]);
  const groupLabel = (item: LabelDataItem) => grouping === 'equipe' ? item.equipe : grouping === 'circulo' ? item.circulo : '';
  const printableSelectedCount = useMemo(() => items.filter((item) => selectedIds.has(item.id) && matchesLabelTeamScope(item, filters)).length, [filters, items, selectedIds]);

  return (
    <div className="label-selector">
      <div className="label-selection-settings">
        <div>
          <strong>Organização da impressão</strong>
          <span>Dentro de cada grupo, os nomes ficam em ordem alfabética.</span>
        </div>
        <label className="standard-label-group">
          <span className="form-label standard-label">Agrupar por</span>
          <select className="form-input" value={grouping} onChange={(event) => onGroupingChange(event.target.value as LabelGrouping)}>
            <option value="none">Somente ordem alfabética</option>
            <option value="circulo">Círculo</option>
            <option value="equipe">Equipe</option>
          </select>
        </label>
        <label className="standard-label-group">
          <span className="form-label standard-label">Cor das equipes</span>
          <select className="form-input" value={filters.equipeCor} onChange={(event) => setFilter('equipeCor', event.target.value as '' | LabelTeamColor)}>
            <option value="">Todas as cores</option>
            <option value="verde">Somente verdes</option>
            <option value="amarela">Somente amarelas</option>
            <option value="vermelha">Somente vermelhas</option>
          </select>
        </label>
        <details className="label-team-picker">
          <summary>Equipes específicas <span>{filters.equipeIds.length || 'Todas'}</span><ChevronDown size={15} /></summary>
          <div className="label-team-picker__menu">
            <button type="button" className="btn-secondary-sm" onClick={() => setFilter('equipeIds', [])}>Marcar todas</button>
            {equipes.map((equipe) => (
              <label key={equipe.id}>
                <input type="checkbox" checked={filters.equipeIds.includes(equipe.id)} onChange={() => toggleEquipe(equipe.id)} />
                <span className={`label-team-dot is-${equipe.acesso_plenario || 'verde'}`} />
                {equipe.nome || 'Equipe sem nome'}
              </label>
            ))}
          </div>
        </details>
      </div>

      <div className="label-selector-filters">
        <div className="form-input-wrapper">
          <Search size={16} className="form-input-icon" />
          <input className="form-input form-input--with-icon" placeholder="Buscar por nome, equipe ou círculo" value={filters.search} onChange={(event) => setFilter('search', event.target.value)} />
        </div>
        <select className="form-input" value={filters.circulo} onChange={(event) => setFilter('circulo', event.target.value)}>
          <option value="">Todos os círculos</option>
          {circles.map((circle) => <option key={circle} value={circle}>{circle}</option>)}
        </select>
        <select className="form-input" value={filters.status} onChange={(event) => setFilter('status', event.target.value)}>
          <option value="">Todos os status</option>
          <option value="confirmado">Confirmados</option>
          <option value="pendente">Pendentes</option>
        </select>
        <select className="form-input" value={filters.tipo} onChange={(event) => setFilter('tipo', event.target.value)}>
          <option value="">Todos os tipos</option>
          <option value="participante">Participantes</option>
          <option value="encontreiro">Encontreiros</option>
        </select>
      </div>

      <div className="label-selector-toolbar">
        <strong>{printableSelectedCount} etiqueta(s) serão geradas</strong>
        <div>
          <button type="button" className="btn-secondary-sm" onClick={() => onSelectAll(filtered.map((item) => item.id))}><CheckSquare size={15} /> Selecionar filtrados</button>
          <button type="button" className="btn-secondary-sm" onClick={() => onFiltersChange({ search: '', equipeId: '', equipeCor: '', equipeIds: [], circulo: '', status: '', tipo: '' })}><Search size={15} /> Limpar filtros</button>
          <button type="button" className="btn-secondary-sm" onClick={onClear}><X size={15} /> Limpar</button>
        </div>
      </div>

      {isLoading ? (
        <div className="label-empty-state"><Loader className="animate-spin" /> Carregando registros...</div>
      ) : (
        <div className="label-data-table-wrap">
          <table className="label-data-table">
            <thead><tr><th></th><th>Nome</th><th>Equipe</th><th>Círculo</th><th>Tipo</th><th>Status</th></tr></thead>
            <tbody>
              {filtered.map((item, index) => {
                const currentGroup = groupLabel(item);
                const previousGroup = index > 0 ? groupLabel(filtered[index - 1]) : '';
                return [
                  grouping !== 'none' && currentGroup !== previousGroup
                    ? <tr className="label-group-row" key={`group-${currentGroup}`}><td colSpan={6}>{currentGroup}</td></tr>
                    : null,
                  <tr key={item.id} className={selectedIds.has(item.id) ? 'is-selected' : ''} onClick={() => onToggle(item.id)}>
                    <td>{selectedIds.has(item.id) ? <CheckSquare size={18} /> : <Square size={18} />}</td>
                    <td><strong>{item.nome}</strong></td><td>{item.equipe}</td><td>{item.circulo}</td><td>{item.tipo}</td><td>{item.status}</td>
                  </tr>,
                ];
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="label-empty-state"><Users /> Nenhum registro encontrado.</div>}
        </div>
      )}
    </div>
  );
}
