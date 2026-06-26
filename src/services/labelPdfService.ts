import { jsPDF } from 'jspdf';
import type { LabelDataItem, LabelField, LabelPrintItem, LabelTemplate } from '../types/label';
import { getFieldValue, getOrientedSheetDimensions, paginateLabels } from '../utils/labelLayout';

function sanitizeFileName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-');
}

function transformText(value: string, transform: LabelField['textTransform']) {
  if (transform === 'uppercase') return value.toLocaleUpperCase('pt-BR');
  if (transform === 'lowercase') return value.toLocaleLowerCase('pt-BR');
  if (transform === 'capitalize') return value.replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase('pt-BR'));
  return value;
}

function getFontStyle(weight: number) {
  return weight >= 700 ? 'bold' : 'normal';
}

function getTextX(field: LabelField, originX: number) {
  if (field.textAlign === 'center') return originX + field.x + field.width / 2;
  if (field.textAlign === 'right') return originX + field.x + field.width;
  return originX + field.x;
}

async function loadImage(source: string): Promise<HTMLImageElement | null> {
  if (!source) return null;
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = source;
  });
}

function drawContainedImage(doc: jsPDF, image: HTMLImageElement, x: number, y: number, width: number, height: number, align: LabelField['textAlign']) {
  const ratio = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * ratio;
  const drawHeight = image.naturalHeight * ratio;
  const drawX = align === 'center' ? x + (width - drawWidth) / 2 : align === 'right' ? x + width - drawWidth : x;
  doc.addImage(image, 'PNG', drawX, y + (height - drawHeight) / 2, drawWidth, drawHeight, undefined, 'FAST');
}

async function svgToCanvas(svg: SVGElement): Promise<HTMLCanvasElement> {
  const serialized = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = await loadImage(url);
    if (!image) throw new Error('Não foi possível renderizar o QR Code.');
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas indisponível para renderizar o QR Code.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function drawField(
  doc: jsPDF,
  field: LabelField,
  item: LabelDataItem,
  originX: number,
  originY: number,
  qrSvg?: SVGElement,
) {
  if (!field.visible) return;
  const x = originX + field.x;
  const y = originY + field.y;

  if (field.backgroundColor) {
    doc.setFillColor(field.backgroundColor);
    doc.rect(x, y, field.width, field.height, 'F');
  }

  if (field.type === 'qrcode' && qrSvg) {
    const size = Math.min(field.width, field.height);
    const qrX = field.textAlign === 'center' ? x + (field.width - size) / 2 : field.textAlign === 'right' ? x + field.width - size : x;
    const canvas = await svgToCanvas(qrSvg);
    doc.addImage(canvas, 'PNG', qrX, y + (field.height - size) / 2, size, size, undefined, 'FAST');
    return;
  }

  const imageSource = field.type === 'imagem' ? item.imagem : field.type === 'logo' ? field.imageUrl : '';
  if (imageSource) {
    const image = await loadImage(imageSource);
    if (image) drawContainedImage(doc, image, x, y, field.width, field.height, field.textAlign);
    return;
  }

  const text = transformText(getFieldValue(field, item) || field.label, field.textTransform);
  doc.setFont('helvetica', getFontStyle(field.fontWeight));
  doc.setFontSize(field.fontSize);
  doc.setTextColor(field.color);
  doc.setLineHeightFactor(1.05);

  const lines = field.wrap ? doc.splitTextToSize(text, field.width) as string[] : [text];
  const lineHeightMm = field.fontSize * 0.3528 * 1.05;
  const maxLines = Math.max(1, Math.floor(field.height / lineHeightMm));
  const visibleLines = lines.slice(0, maxLines);
  const totalHeight = visibleLines.length * lineHeightMm;
  const baselineY = y + Math.max(lineHeightMm * 0.78, (field.height - totalHeight) / 2 + lineHeightMm * 0.78);
  doc.text(visibleLines, getTextX(field, originX), baselineY, { align: field.textAlign, maxWidth: field.width });
}

export const labelPdfService = {
  async gerar(printArea: HTMLElement, template: LabelTemplate, items: LabelPrintItem[]): Promise<void> {
    const pages = paginateLabels(items, template.printSettings);
    if (pages.length === 0) throw new Error('Nenhuma página disponível para gerar o PDF.');

    const qrSvgs = Array.from(printArea.querySelectorAll<SVGElement>('.label-field--media svg'));
    let qrIndex = 0;
    const sheet = getOrientedSheetDimensions(template.printSettings);
    const orientation = sheet.width > sheet.height ? 'landscape' : 'portrait';
    const doc = new jsPDF({ orientation, unit: 'mm', format: [sheet.width, sheet.height], compress: true });

    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
      if (pageIndex > 0) doc.addPage([sheet.width, sheet.height], orientation);

      for (let itemIndex = 0; itemIndex < pages[pageIndex].length; itemIndex += 1) {
        const item = pages[pageIndex][itemIndex];
        const column = itemIndex % template.printSettings.columns;
        const row = Math.floor(itemIndex / template.printSettings.columns);
        const originX = template.printSettings.marginLeft + column * (template.width + template.printSettings.horizontalGap);
        const originY = template.printSettings.marginTop + row * (template.height + template.printSettings.verticalGap);
        if (!item) continue;

        doc.setFillColor(item.tipo === 'manual' && item.backgroundColor ? item.backgroundColor : template.backgroundColor);
        if (template.borderRadius > 0) doc.roundedRect(originX, originY, template.width, template.height, template.borderRadius, template.borderRadius, 'F');
        else doc.rect(originX, originY, template.width, template.height, 'F');

        if (template.backgroundImage) {
          const background = await loadImage(template.backgroundImage);
          if (background) doc.addImage(background, 'PNG', originX, originY, template.width, template.height, undefined, 'FAST');
        }

        for (const field of template.fields) {
          const qrSvg = field.type === 'qrcode' && field.visible ? qrSvgs[qrIndex++] : undefined;
          await drawField(doc, field, item, originX, originY, qrSvg);
        }

        if (template.borderWidth > 0) {
          doc.setDrawColor(template.borderColor);
          doc.setLineWidth(template.borderWidth);
          if (template.borderRadius > 0) doc.roundedRect(originX, originY, template.width, template.height, template.borderRadius, template.borderRadius, 'S');
          else doc.rect(originX, originY, template.width, template.height, 'S');
        }
      }
    }

    doc.save(`${sanitizeFileName(template.name || 'etiquetas')}.pdf`);
  },
};
