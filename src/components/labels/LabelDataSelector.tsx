import { CheckSquare, ChevronDown, Loader, Plus, Search, Square, Trash2, Users, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Equipe } from '../../types/equipe';
import type { LabelDataFilters, LabelDataItem, LabelGrouping, LabelTeamColor } from '../../types/label';
import { getLabelGroupValue, matchesLabelFilters, sortLabelItems } from '../../utils/labelLayout';

interface LabelDataSelectorProps {
  items: LabelDataItem[];
  manualItems: LabelDataItem[];
  selectedIds: Set<string>;
  filters: LabelDataFilters;
  equipes: Equipe[];
  grouping: LabelGrouping;
  isLoading: boolean;
  onAddManualItem: (item: Omit<LabelDataItem, 'id' | 'tipo' | 'status' | 'equipeId' | 'equipeCor' | 'visitaGrupoId'>) => void;
  onRemoveManualItem: (id: string) => void;
  onFiltersChange: (filters: LabelDataFilters) => void;
  onGroupingChange: (grouping: LabelGrouping) => void;
  onToggle: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onClear: () => void;
}

export function LabelDataSelector({
  items,
  manualItems,
  selectedIds,
  filters,
  equipes,
  grouping,
  isLoading,
  onAddManualItem,
  onRemoveManualItem,
  onFiltersChange,
  onGroupingChange,
  onToggle,
  onSelectAll,
  onClear,
}: LabelDataSelectorProps) {
  const [manualForm, setManualForm] = useState({
    nome: '',
    equipe: '',
    visitaGrupo: '',
    circulo: '',
    funcao: '',
    telefone: '',
    observacao: '',
    codigo: '',
    qrCode: '',
    imagem: '',
  });
  const circles = useMemo(() => [...new Set(items.map((item) => item.circulo).filter(Boolean))].sort(), [items]);
  const visitGroups = useMemo(
    () => Array.from(
      items.reduce((map, item) => {
        if (item.visitaGrupoId) map.set(item.visitaGrupoId, item.visitaGrupo || 'Sem dupla');
        return map;
      }, new Map<string, string>()),
      ([id, nome]) => ({ id, nome }),
    ).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })),
    [items],
  );
  const filtered = useMemo(() => {
    return sortLabelItems(items.filter((item) => matchesLabelFilters(item, filters)), grouping);
  }, [filters, grouping, items]);

  const setFilter = <K extends keyof LabelDataFilters>(key: K, value: LabelDataFilters[K]) => onFiltersChange({ ...filters, [key]: value });
  const setManualField = (key: keyof typeof manualForm, value: string) => setManualForm((current) => ({ ...current, [key]: value }));
  const addManual = () => {
    onAddManualItem(manualForm);
    setManualForm({
      nome: '',
      equipe: '',
      visitaGrupo: '',
      circulo: '',
      funcao: '',
      telefone: '',
      observacao: '',
      codigo: '',
      qrCode: '',
      imagem: '',
    });
  };
  const toggleEquipe = (id: string) => setFilter('equipeIds', filters.equipeIds.includes(id) ? filters.equipeIds.filter((item) => item !== id) : [...filters.equipeIds, id]);
  const groupLabel = (item: LabelDataItem) => getLabelGroupValue(item, grouping);
  const printableSelectedCount = useMemo(() => items.filter((item) => selectedIds.has(item.id) && matchesLabelFilters(item, filters)).length, [filters, items, selectedIds]);

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
            <option value="dupla">Dupla da visitação</option>
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

      <div className="label-manual-entry">
        <div className="label-manual-entry__heading">
          <div>
            <strong>Etiqueta avulsa manual</strong>
            <span>Use para nomes ou dados que não estão cadastrados no sistema.</span>
          </div>
          <button type="button" className="btn-primary-sm" onClick={addManual}><Plus size={15} /> Adicionar</button>
        </div>
        <div className="label-manual-entry__grid">
          <label className="standard-label-group"><span className="form-label standard-label">Nome</span><input className="form-input" value={manualForm.nome} onChange={(event) => setManualField('nome', event.target.value)} /></label>
          <label className="standard-label-group"><span className="form-label standard-label">Equipe</span><input className="form-input" value={manualForm.equipe} onChange={(event) => setManualField('equipe', event.target.value)} /></label>
          <label className="standard-label-group"><span className="form-label standard-label">Função</span><input className="form-input" value={manualForm.funcao} onChange={(event) => setManualField('funcao', event.target.value)} /></label>
          <label className="standard-label-group"><span className="form-label standard-label">Telefone</span><input className="form-input" value={manualForm.telefone} onChange={(event) => setManualField('telefone', event.target.value)} /></label>
          <label className="standard-label-group"><span className="form-label standard-label">Dupla</span><input className="form-input" value={manualForm.visitaGrupo} onChange={(event) => setManualField('visitaGrupo', event.target.value)} /></label>
          <label className="standard-label-group"><span className="form-label standard-label">Círculo</span><input className="form-input" value={manualForm.circulo} onChange={(event) => setManualField('circulo', event.target.value)} /></label>
          <label className="standard-label-group"><span className="form-label standard-label">Código</span><input className="form-input" value={manualForm.codigo} onChange={(event) => setManualField('codigo', event.target.value)} /></label>
          <label className="standard-label-group"><span className="form-label standard-label">QR Code</span><input className="form-input" value={manualForm.qrCode} onChange={(event) => setManualField('qrCode', event.target.value)} /></label>
          <label className="standard-label-group label-manual-entry__wide"><span className="form-label standard-label">Observação</span><input className="form-input" value={manualForm.observacao} onChange={(event) => setManualField('observacao', event.target.value)} /></label>
          <label className="standard-label-group label-manual-entry__wide"><span className="form-label standard-label">Imagem URL</span><input className="form-input" value={manualForm.imagem} onChange={(event) => setManualField('imagem', event.target.value)} /></label>
        </div>
        {manualItems.length > 0 && <span className="label-manual-entry__count">{manualItems.length} manual(is) nesta impressão</span>}
      </div>

      <div className="label-selector-filters">
        <div className="form-input-wrapper">
          <Search size={16} className="form-input-icon" />
          <input className="form-input form-input--with-icon" placeholder="Buscar por nome, equipe, círculo ou dupla" value={filters.search} onChange={(event) => setFilter('search', event.target.value)} />
        </div>
        <select className="form-input" value={filters.visitaGrupoId} onChange={(event) => setFilter('visitaGrupoId', event.target.value)}>
          <option value="">Todas as duplas</option>
          {visitGroups.map((group) => <option key={group.id} value={group.id}>{group.nome}</option>)}
        </select>
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
          <option value="equipe">Equipes</option>
          <option value="circulo">Círculos</option>
          <option value="manual">Manuais</option>
        </select>
      </div>

      <div className="label-selector-toolbar">
        <strong>{printableSelectedCount} etiqueta(s) serão geradas</strong>
        <div>
          <button type="button" className="btn-secondary-sm" onClick={() => onSelectAll(filtered.map((item) => item.id))}><CheckSquare size={15} /> Selecionar filtrados</button>
          <button type="button" className="btn-secondary-sm" onClick={() => onFiltersChange({ search: '', equipeId: '', equipeCor: '', equipeIds: [], visitaGrupoId: '', circulo: '', status: '', tipo: '' })}><Search size={15} /> Limpar filtros</button>
          <button type="button" className="btn-secondary-sm" onClick={onClear}><X size={15} /> Limpar</button>
        </div>
      </div>

      {isLoading ? (
        <div className="label-empty-state"><Loader className="animate-spin" /> Carregando registros...</div>
      ) : (
        <div className="label-data-table-wrap">
          <table className="label-data-table">
            <thead><tr><th></th><th>Nome</th><th>Equipe</th><th>Dupla</th><th>Círculo</th><th>Tipo</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filtered.map((item, index) => {
                const currentGroup = groupLabel(item);
                const previousGroup = index > 0 ? groupLabel(filtered[index - 1]) : '';
                return [
                  grouping !== 'none' && currentGroup !== previousGroup
                    ? <tr className="label-group-row" key={`group-${currentGroup}`}><td colSpan={8}>{currentGroup}</td></tr>
                    : null,
                  <tr key={item.id} className={selectedIds.has(item.id) ? 'is-selected' : ''} onClick={() => onToggle(item.id)}>
                    <td>{selectedIds.has(item.id) ? <CheckSquare size={18} /> : <Square size={18} />}</td>
                    <td><strong>{item.nome}</strong></td><td>{item.equipe}</td><td>{item.visitaGrupo || '-'}</td><td>{item.circulo}</td><td>{item.tipo}</td><td>{item.status}</td>
                    <td>
                      {item.tipo === 'manual' && (
                        <button type="button" className="label-manual-remove" title="Remover manual" onClick={(event) => { event.stopPropagation(); onRemoveManualItem(item.id); }}>
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
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
