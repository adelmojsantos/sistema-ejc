import { useMemo, useState } from 'react';
import type { LabelPrintItem, LabelTemplate } from '../../types/label';
import { paginateLabels } from '../../utils/labelLayout';
import { LabelCanvas } from './LabelCanvas';
import { LabelPrintArea } from './LabelPrintArea';

interface LabelPreviewProps {
  template: LabelTemplate;
  items: LabelPrintItem[];
}

export function LabelPreview({ template, items }: LabelPreviewProps) {
  const [mode, setMode] = useState<'labels' | 'sheet'>('labels');
  const pages = useMemo(() => paginateLabels(items, template.printSettings), [items, template.printSettings]);
  const readableItems = useMemo(() => items.filter((item): item is NonNullable<LabelPrintItem> => Boolean(item)), [items]);
  if (pages.length === 0) return <div className="label-empty-state">Selecione registros para visualizar as etiquetas.</div>;

  return (
    <div>
      <div className="label-preview-mode">
        <button type="button" className={mode === 'labels' ? 'is-active' : ''} onClick={() => setMode('labels')}>Etiquetas legíveis</button>
        <button type="button" className={mode === 'sheet' ? 'is-active' : ''} onClick={() => setMode('sheet')}>Folha de impressão</button>
      </div>
      {mode === 'labels' ? (
        <div className="label-readable-preview">
          {readableItems.slice(0, 12).map((item, index) => <LabelCanvas key={`${item.id}-${index}`} template={template} item={item} />)}
          {readableItems.length > 12 && <p>Exibindo 12 de {readableItems.length} etiquetas. Todas serão incluídas na impressão.</p>}
        </div>
      ) : (
        <div className="label-preview-scroll">
          <LabelPrintArea template={template} pages={pages.slice(0, 1)} className="label-print-area--preview" />
          {pages.length > 1 && <p className="label-preview-note">Exibindo a primeira de {pages.length} páginas.</p>}
        </div>
      )}
    </div>
  );
}
