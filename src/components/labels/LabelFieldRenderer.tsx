import { QRCodeSVG } from 'qrcode.react';
import type { CSSProperties } from 'react';
import type { LabelDataItem, LabelField } from '../../types/label';
import { getFieldValue } from '../../utils/labelLayout';

interface LabelFieldRendererProps {
  field: LabelField;
  item: LabelDataItem;
}

export function LabelFieldRenderer({ field, item }: LabelFieldRendererProps) {
  if (!field.visible) return null;
  const value = getFieldValue(field, item);
  const horizontalAlignment: CSSProperties['justifyContent'] = {
    left: 'flex-start',
    center: 'center',
    right: 'flex-end',
  }[field.textAlign];
  const style: CSSProperties = {
    position: 'absolute',
    left: `${field.x}mm`,
    top: `${field.y}mm`,
    width: `${field.width}mm`,
    height: `${field.height}mm`,
    fontFamily: field.fontFamily,
    fontSize: `${field.fontSize}pt`,
    fontWeight: field.fontWeight,
    color: field.color,
    textAlign: field.textAlign,
    justifyContent: horizontalAlignment,
    textTransform: field.textTransform === 'none' ? undefined : field.textTransform,
    whiteSpace: field.wrap ? 'normal' : 'nowrap',
    overflow: 'hidden',
    overflowWrap: 'anywhere',
    backgroundColor: field.backgroundColor || 'transparent',
  };

  if (field.type === 'qrcode') {
    return (
      <div className="label-field label-field--media" style={style}>
        <QRCodeSVG value={value || item.id} size={256} level="M" />
      </div>
    );
  }

  if (field.type === 'imagem') {
    return (
      <div className="label-field label-field--media" style={style}>
        {value ? <img src={value} alt="" /> : <span>Imagem</span>}
      </div>
    );
  }

  if (field.type === 'logo' && field.imageUrl) {
    return (
      <div className="label-field label-field--media" style={style}>
        <img src={field.imageUrl} alt="Logo" />
      </div>
    );
  }

  return <div className="label-field" style={style}>{value || field.label}</div>;
}
