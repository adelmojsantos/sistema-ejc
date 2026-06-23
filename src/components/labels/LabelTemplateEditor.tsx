import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import type { LabelField, LabelTemplate, PrintSettings, SheetSize } from '../../types/label';
import { LABEL_FIELD_OPTIONS, LABEL_PREVIEW_ITEM, SHEET_SIZES } from '../../utils/labelLayout';
import { FormField } from '../ui/FormField';
import { LabelCanvas } from './LabelCanvas';

interface LabelTemplateEditorProps {
  template: LabelTemplate;
  selectedFieldId: string;
  onChange: (template: LabelTemplate) => void;
  onSelectedFieldChange: (id: string) => void;
}

const numberValue = (value: string) => Number(value) || 0;

const FONT_OPTIONS = [
  'Plus Jakarta Sans',
  'Londrina Solid',
  'Arial',
  'Helvetica',
  'Verdana',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'system-ui',
  'sans-serif',
  'serif',
];

export function LabelTemplateEditor({ template, selectedFieldId, onChange, onSelectedFieldChange }: LabelTemplateEditorProps) {
  const selectedField = useMemo(() => template.fields.find((field) => field.id === selectedFieldId) || null, [selectedFieldId, template.fields]);
  const fontOptions = selectedField?.fontFamily && !FONT_OPTIONS.includes(selectedField.fontFamily)
    ? [selectedField.fontFamily, ...FONT_OPTIONS]
    : FONT_OPTIONS;
  const updateTemplate = <K extends keyof LabelTemplate>(key: K, value: LabelTemplate[K]) => onChange({ ...template, [key]: value });
  const updatePrint = <K extends keyof PrintSettings>(key: K, value: PrintSettings[K]) => onChange({ ...template, printSettings: { ...template.printSettings, [key]: value } });
  const updateField = <K extends keyof LabelField>(key: K, value: LabelField[K]) => {
    onChange({ ...template, fields: template.fields.map((field) => field.id === selectedFieldId ? { ...field, [key]: value } : field) });
  };

  const addField = () => {
    const field: LabelField = {
      id: crypto.randomUUID(), type: 'nome', label: 'Novo campo', x: 2, y: 2,
      width: Math.min(30, template.width - 4), height: 5, fontFamily: 'Plus Jakarta Sans',
      fontSize: 8, fontWeight: 600, color: '#111827', textAlign: 'left',
      wrap: false, visible: true, textTransform: 'none',
    };
    onChange({ ...template, fields: [...template.fields, field] });
    onSelectedFieldChange(field.id);
  };

  const removeField = () => {
    onChange({ ...template, fields: template.fields.filter((field) => field.id !== selectedFieldId) });
    onSelectedFieldChange(template.fields.find((field) => field.id !== selectedFieldId)?.id || '');
  };

  const setSheetSize = (sheetSize: SheetSize) => {
    if (sheetSize === 'custom') return updatePrint('sheetSize', sheetSize);
    onChange({ ...template, printSettings: { ...template.printSettings, sheetSize, sheetWidth: SHEET_SIZES[sheetSize].width, sheetHeight: SHEET_SIZES[sheetSize].height } });
  };

  const moveField = (axis: 'x' | 'y', delta: number) => {
    if (!selectedField) return;
    updateField(axis, Math.max(0, Number((selectedField[axis] + delta).toFixed(1))));
  };

  const readImage = (file: File | undefined, target: 'backgroundImage' | 'imageUrl') => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => target === 'backgroundImage'
      ? updateTemplate('backgroundImage', String(reader.result || ''))
      : updateField('imageUrl', String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  return (
    <div className="label-editor-simple">
      <aside className="label-fields-panel">
        <div className="label-panel-heading">
          <div><strong>Conteúdo</strong><span>Escolha o que aparece</span></div>
          <button type="button" className="btn-secondary-sm" onClick={addField} title="Adicionar campo"><Plus size={16} /></button>
        </div>
        <div className="label-field-cards">
          {template.fields.map((field) => (
            <button type="button" key={field.id} className={field.id === selectedFieldId ? 'is-selected' : ''} onClick={() => onSelectedFieldChange(field.id)}>
              <span>{field.label}<small>{LABEL_FIELD_OPTIONS.find((option) => option.value === field.type)?.label}</small></span>
              <span
                role="button"
                tabIndex={0}
                title={field.visible ? 'Ocultar' : 'Exibir'}
                onClick={(event) => {
                  event.stopPropagation();
                  onChange({ ...template, fields: template.fields.map((item) => item.id === field.id ? { ...item, visible: !item.visible } : item) });
                }}
              >
                {field.visible ? <Eye size={17} /> : <EyeOff size={17} />}
              </span>
            </button>
          ))}
        </div>

        <details className="label-settings-details">
          <summary>Etiqueta e folha <ChevronDown size={16} /></summary>
          <div className="label-settings-body">
            <FormField label="Nome do modelo" value={template.name} onChange={(event) => updateTemplate('name', event.target.value)} floating={false} />
            <div className="label-form-grid">
              <FormField label="Largura (mm)" type="number" step="0.1" value={template.width} onChange={(event) => updateTemplate('width', numberValue(event.target.value))} floating={false} />
              <FormField label="Altura (mm)" type="number" step="0.1" value={template.height} onChange={(event) => updateTemplate('height', numberValue(event.target.value))} floating={false} />
              <label className="standard-label-group"><span className="form-label standard-label">Folha</span><select className="form-input" value={template.printSettings.sheetSize} onChange={(event) => setSheetSize(event.target.value as SheetSize)}><option value="a4">A4</option><option value="letter">Carta</option><option value="custom">Personalizada</option></select></label>
              <label className="standard-label-group"><span className="form-label standard-label">Orientação</span><select className="form-input" value={template.printSettings.orientation} onChange={(event) => updatePrint('orientation', event.target.value as PrintSettings['orientation'])}><option value="portrait">Retrato</option><option value="landscape">Paisagem</option></select></label>
              {template.printSettings.sheetSize === 'custom' && <>
                <FormField label="Folha largura (mm)" type="number" step="0.1" value={template.printSettings.sheetWidth} onChange={(event) => updatePrint('sheetWidth', numberValue(event.target.value))} floating={false} />
                <FormField label="Folha altura (mm)" type="number" step="0.1" value={template.printSettings.sheetHeight} onChange={(event) => updatePrint('sheetHeight', numberValue(event.target.value))} floating={false} />
              </>}
              <FormField label="Colunas" type="number" min="1" value={template.printSettings.columns} onChange={(event) => updatePrint('columns', Math.max(1, numberValue(event.target.value)))} floating={false} />
              <FormField label="Linhas" type="number" min="1" value={template.printSettings.rows} onChange={(event) => updatePrint('rows', Math.max(1, numberValue(event.target.value)))} floating={false} />
            </div>
          </div>
        </details>

        <details className="label-settings-details">
          <summary>Ajustes avançados <ChevronDown size={16} /></summary>
          <div className="label-settings-body label-form-grid">
            <FormField label="Padding (mm)" type="number" step="0.1" value={template.padding} onChange={(event) => updateTemplate('padding', numberValue(event.target.value))} floating={false} />
            <FormField label="Borda (mm)" type="number" step="0.1" value={template.borderWidth} onChange={(event) => updateTemplate('borderWidth', numberValue(event.target.value))} floating={false} />
            <FormField label="Radius (mm)" type="number" step="0.1" value={template.borderRadius} onChange={(event) => updateTemplate('borderRadius', numberValue(event.target.value))} floating={false} />
            <FormField label="Espaço horizontal" type="number" step="0.1" value={template.printSettings.horizontalGap} onChange={(event) => updatePrint('horizontalGap', numberValue(event.target.value))} floating={false} />
            <FormField label="Espaço vertical" type="number" step="0.1" value={template.printSettings.verticalGap} onChange={(event) => updatePrint('verticalGap', numberValue(event.target.value))} floating={false} />
            {(['marginTop', 'marginRight', 'marginBottom', 'marginLeft'] as const).map((key) => <FormField key={key} label={{ marginTop: 'Margem superior', marginRight: 'Margem direita', marginBottom: 'Margem inferior', marginLeft: 'Margem esquerda' }[key]} type="number" step="0.1" value={template.printSettings[key]} onChange={(event) => updatePrint(key, numberValue(event.target.value))} floating={false} />)}
            <label className="standard-label-group"><span className="form-label standard-label">Fundo</span><input className="form-input label-color-input" type="color" value={template.backgroundColor} onChange={(event) => updateTemplate('backgroundColor', event.target.value)} /></label>
            <label className="standard-label-group"><span className="form-label standard-label">Cor da borda</span><input className="form-input label-color-input" type="color" value={template.borderColor} onChange={(event) => updateTemplate('borderColor', event.target.value)} /></label>
            <label className="standard-label-group"><span className="form-label standard-label">Imagem de fundo</span><input className="form-input" type="file" accept="image/*" onChange={(event) => readImage(event.target.files?.[0], 'backgroundImage')} /></label>
          </div>
        </details>
      </aside>

      <main className="label-visual-panel">
        <div className="label-panel-heading">
          <div><strong>Etiqueta</strong><span>Clique em um campo para editar</span></div>
          <span className="label-size-badge">{template.width} × {template.height} mm</span>
        </div>
        <div className="label-visual-stage">
          <LabelCanvas template={template} item={LABEL_PREVIEW_ITEM} editor selectedFieldId={selectedFieldId} onSelectField={onSelectedFieldChange} />
        </div>
      </main>

      <aside className="label-properties-panel">
        <div className="label-panel-heading"><div><strong>Propriedades</strong><span>{selectedField?.label || 'Selecione um campo'}</span></div></div>
        {selectedField ? (
          <>
            <div className="label-property-block">
              <div className="label-form-grid">
                <FormField label="Nome" value={selectedField.label} onChange={(event) => updateField('label', event.target.value)} floating={false} />
                <label className="standard-label-group"><span className="form-label standard-label">Conteúdo</span><select className="form-input" value={selectedField.type} onChange={(event) => updateField('type', event.target.value as LabelField['type'])}>{LABEL_FIELD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              </div>
              {(selectedField.type === 'icone' || selectedField.type === 'logo') && <FormField label="Texto fixo" value={selectedField.value || ''} onChange={(event) => updateField('value', event.target.value)} floating={false} />}
              {selectedField.type === 'logo' && <label className="standard-label-group"><span className="form-label standard-label">Arquivo do logo</span><input className="form-input" type="file" accept="image/*" onChange={(event) => readImage(event.target.files?.[0], 'imageUrl')} /></label>}
            </div>

            <div className="label-property-block">
              <strong>Posição</strong>
              <div className="label-nudge-controls">
                <button type="button" onClick={() => moveField('y', -0.5)} title="Mover para cima"><ChevronUp size={18} /></button>
                <button type="button" onClick={() => moveField('x', -0.5)} title="Mover para esquerda"><ChevronLeft size={18} /></button>
                <span>0,5 mm</span>
                <button type="button" onClick={() => moveField('x', 0.5)} title="Mover para direita"><ChevronRight size={18} /></button>
                <button type="button" onClick={() => moveField('y', 0.5)} title="Mover para baixo"><ChevronDown size={18} /></button>
              </div>
              <details className="label-inline-details">
                <summary>Valores exatos</summary>
                <div className="label-form-grid">{(['x', 'y', 'width', 'height'] as const).map((key) => <FormField key={key} label={`${key.toUpperCase()} (mm)`} type="number" step="0.1" value={selectedField[key]} onChange={(event) => updateField(key, numberValue(event.target.value))} floating={false} />)}</div>
              </details>
            </div>

            <div className="label-property-block">
              <strong>Texto</strong>
              <div className="label-form-grid">
                <FormField label="Tamanho (pt)" type="number" step="0.5" value={selectedField.fontSize} onChange={(event) => updateField('fontSize', numberValue(event.target.value))} floating={false} />
                <label className="standard-label-group"><span className="form-label standard-label">Peso</span><select className="form-input" value={selectedField.fontWeight} onChange={(event) => updateField('fontWeight', numberValue(event.target.value))}><option value="400">Normal</option><option value="600">Semibold</option><option value="700">Negrito</option><option value="800">Extra negrito</option></select></label>
                <label className="standard-label-group"><span className="form-label standard-label">Alinhamento</span><select className="form-input" value={selectedField.textAlign} onChange={(event) => updateField('textAlign', event.target.value as LabelField['textAlign'])}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label>
                <label className="standard-label-group"><span className="form-label standard-label">Cor</span><input className="form-input label-color-input" type="color" value={selectedField.color} onChange={(event) => updateField('color', event.target.value)} /></label>
              </div>
              <div className="label-check-row">
                <label><input type="checkbox" checked={selectedField.wrap} onChange={(event) => updateField('wrap', event.target.checked)} /> Quebrar linha</label>
              </div>
              <details className="label-inline-details">
                <summary>Mais opções de texto</summary>
                <div className="label-form-grid">
                  <label className="standard-label-group">
                    <span className="form-label standard-label">Fonte</span>
                    <select className="form-input" value={selectedField.fontFamily} onChange={(event) => updateField('fontFamily', event.target.value)}>
                      {fontOptions.map((font) => (
                        <option key={font} value={font} style={{ fontFamily: font }}>{font}</option>
                      ))}
                    </select>
                  </label>
                  <label className="standard-label-group"><span className="form-label standard-label">Transformação</span><select className="form-input" value={selectedField.textTransform} onChange={(event) => updateField('textTransform', event.target.value as LabelField['textTransform'])}><option value="none">Nenhuma</option><option value="uppercase">Maiúsculo</option><option value="lowercase">Minúsculo</option><option value="capitalize">Capitalizado</option></select></label>
                </div>
              </details>
            </div>
            <button type="button" className="btn-danger-outline label-remove-field" onClick={removeField}><Trash2 size={16} /> Remover campo</button>
          </>
        ) : <div className="label-empty-state">Selecione um campo na etiqueta ou na lista.</div>}
      </aside>
    </div>
  );
}
