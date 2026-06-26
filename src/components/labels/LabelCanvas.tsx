import { memo } from 'react';
import type { LabelDataItem, LabelTemplate } from '../../types/label';
import { LabelFieldRenderer } from './LabelFieldRenderer';

interface LabelCanvasProps {
  template: LabelTemplate;
  item: LabelDataItem;
  editor?: boolean;
  selectedFieldId?: string;
  onSelectField?: (id: string) => void;
}

export const LabelCanvas = memo(function LabelCanvas({
  template,
  item,
  editor = false,
  selectedFieldId,
  onSelectField,
}: LabelCanvasProps) {
  const backgroundColor = item.tipo === 'manual' && item.backgroundColor
    ? item.backgroundColor
    : template.backgroundColor;

  return (
    <div
      className={`label-canvas ${editor ? 'label-canvas--editor' : ''}`}
      style={{
        width: `${template.width}mm`,
        height: `${template.height}mm`,
        padding: `${template.padding}mm`,
        border: `${template.borderWidth}mm solid ${template.borderColor}`,
        borderRadius: `${template.borderRadius}mm`,
        backgroundColor,
        backgroundImage: template.backgroundImage ? `url(${template.backgroundImage})` : undefined,
      }}
    >
      {template.fields.map((field) => (
        <div
          key={field.id}
          className={editor && selectedFieldId === field.id ? 'label-editor-field is-selected' : 'label-editor-field'}
          onClick={editor ? () => onSelectField?.(field.id) : undefined}
        >
          <LabelFieldRenderer field={field} item={item} />
        </div>
      ))}
    </div>
  );
});
