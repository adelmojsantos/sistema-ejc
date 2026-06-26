import { CheckSquare, Plus, Square, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { LabelDataItem, LabelFieldType } from '../../types/label';
import { LABEL_FIELD_OPTIONS } from '../../utils/labelLayout';

type ManualLabelField = Extract<LabelFieldType, 'nome' | 'equipe' | 'circulo' | 'visitaGrupo' | 'funcao' | 'telefone' | 'observacao' | 'codigo' | 'qrcode' | 'imagem'>;

const manualFieldOptions = LABEL_FIELD_OPTIONS.filter((option): option is { value: ManualLabelField; label: string } => (
  option.value !== 'icone' && option.value !== 'logo'
));

const emptyManualItem: Omit<LabelDataItem, 'id' | 'tipo' | 'status' | 'equipeId' | 'equipeCor' | 'visitaGrupoId'> = {
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
  backgroundColor: '#ffffff',
};

interface LabelManualSelectorProps {
  manualItems: LabelDataItem[];
  selectedIds: Set<string>;
  onAddManualItem: (item: Omit<LabelDataItem, 'id' | 'tipo' | 'status' | 'equipeId' | 'equipeCor' | 'visitaGrupoId'>) => void;
  onRemoveManualItem: (id: string) => void;
  onToggle: (id: string) => void;
}

function getManualDisplayValue(item: LabelDataItem) {
  return item.nome || item.equipe || item.circulo || item.visitaGrupo || item.funcao || item.telefone || item.observacao || item.codigo || item.qrCode || item.imagem || 'Etiqueta avulsa';
}

function getManualFieldLabel(item: LabelDataItem) {
  const filledField = manualFieldOptions.find((option) => {
    const key = option.value === 'qrcode' ? 'qrCode' : option.value;
    return item[key]?.trim();
  });
  return filledField?.label || 'Dado';
}

function normalizeHexColor(value: string) {
  const trimmed = value.trim();
  const normalized = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toLowerCase() : '';
}

export function LabelManualSelector({ manualItems, selectedIds, onAddManualItem, onRemoveManualItem, onToggle }: LabelManualSelectorProps) {
  const [field, setField] = useState<ManualLabelField>('nome');
  const [value, setValue] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const selectedManualCount = useMemo(() => manualItems.filter((item) => selectedIds.has(item.id)).length, [manualItems, selectedIds]);
  const normalizedColor = normalizeHexColor(backgroundColor);

  const addManual = () => {
    const trimmed = value.trim();
    if (!trimmed || !normalizedColor) return;

    const nextItem = { ...emptyManualItem, backgroundColor: normalizedColor };
    if (field === 'qrcode') nextItem.qrCode = trimmed;
    else nextItem[field] = trimmed;

    onAddManualItem(nextItem);
    setValue('');
  };

  return (
    <div className="label-manual-panel">
      <div className="label-manual-builder">
        <div className="label-panel-heading">
          <div>
            <strong>Etiqueta avulsa</strong>
            <span>Selecione o dado e informe o texto que deve sair na etiqueta.</span>
          </div>
        </div>

        <div className="label-manual-builder__form">
          <label className="standard-label-group">
            <span className="form-label standard-label">Dado da etiqueta</span>
            <select className="form-input" value={field} onChange={(event) => setField(event.target.value as ManualLabelField)}>
              {manualFieldOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="standard-label-group">
            <span className="form-label standard-label">Conteúdo</span>
            <input
              className="form-input"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addManual();
                }
              }}
            />
          </label>
          <div className="label-manual-color-row">
            <label className="standard-label-group">
              <span className="form-label standard-label">Cor</span>
              <input
                className="form-input label-color-input"
                type="color"
                value={normalizedColor || '#ffffff'}
                onChange={(event) => setBackgroundColor(event.target.value)}
              />
            </label>
            <label className="standard-label-group">
              <span className="form-label standard-label">Hash</span>
              <input
                className="form-input"
                value={backgroundColor}
                onChange={(event) => setBackgroundColor(event.target.value)}
                placeholder="#ffffff"
                spellCheck={false}
              />
            </label>
          </div>
          <button type="button" className="btn-primary" onClick={addManual} disabled={!value.trim() || !normalizedColor}>
            <Plus size={16} /> Adicionar
          </button>
        </div>
      </div>

      <div className="label-manual-list">
        <div className="label-selector-toolbar">
          <strong>{selectedManualCount} avulsa(s) selecionada(s)</strong>
          <span>{manualItems.length} criada(s) nesta impressão</span>
        </div>

        {manualItems.length === 0 ? (
          <div className="label-empty-state">Nenhuma etiqueta avulsa criada.</div>
        ) : (
          <div className="label-data-table-wrap">
            <table className="label-data-table label-data-table--manual">
              <thead>
                <tr><th></th><th>Cor</th><th>Dado</th><th>Conteúdo</th><th></th></tr>
              </thead>
              <tbody>
                {manualItems.map((item) => (
                  <tr key={item.id} className={selectedIds.has(item.id) ? 'is-selected' : ''} onClick={() => onToggle(item.id)}>
                    <td>{selectedIds.has(item.id) ? <CheckSquare size={18} /> : <Square size={18} />}</td>
                    <td><span className="label-manual-color-swatch" style={{ backgroundColor: item.backgroundColor || '#ffffff' }} title={item.backgroundColor || '#ffffff'} /></td>
                    <td>{getManualFieldLabel(item)}</td>
                    <td><strong>{getManualDisplayValue(item)}</strong></td>
                    <td>
                      <button type="button" className="label-manual-remove" title="Remover avulsa" onClick={(event) => { event.stopPropagation(); onRemoveManualItem(item.id); }}>
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
