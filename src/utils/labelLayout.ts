import type { LabelDataFilters, LabelDataItem, LabelField, LabelGrouping, LabelTemplate, PrintSettings } from '../types/label';

export const SHEET_SIZES = {
  a4: { width: 210, height: 297 },
  letter: { width: 215.9, height: 279.4 },
} as const;

const now = new Date().toISOString();

export const DEFAULT_LABEL_TEMPLATE: LabelTemplate = {
  id: 'default-colacril-6180',
  name: 'Carta 30 etiquetas - 66,7 x 25,4 mm',
  width: 66.7,
  height: 25.4,
  padding: 1.2,
  borderWidth: 0.25,
  borderColor: '#111827',
  borderRadius: 0,
  backgroundColor: '#ffffff',
  fields: [
    {
      id: 'field-logo',
      type: 'logo',
      label: 'Logo',
      x: 1.2,
      y: 2,
      width: 14,
      height: 21,
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 8,
      fontWeight: 600,
      color: '#111827',
      textAlign: 'center',
      wrap: false,
      visible: true,
      textTransform: 'none',
    },
    {
      id: 'field-codigo',
      type: 'codigo',
      label: 'Código',
      x: 18,
      y: 1.5,
      width: 25,
      height: 4,
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 8,
      fontWeight: 700,
      color: '#111827',
      textAlign: 'left',
      wrap: false,
      visible: true,
      textTransform: 'none',
    },
    {
      id: 'field-nome',
      type: 'nome',
      label: 'Nome',
      x: 18,
      y: 6,
      width: 46,
      height: 8,
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 9,
      fontWeight: 800,
      color: '#111827',
      textAlign: 'left',
      wrap: true,
      visible: true,
      textTransform: 'uppercase',
    },
    {
      id: 'field-equipe',
      type: 'equipe',
      label: 'Equipe',
      x: 18,
      y: 15,
      width: 27,
      height: 4,
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 7,
      fontWeight: 700,
      color: '#111827',
      textAlign: 'left',
      wrap: false,
      visible: true,
      textTransform: 'uppercase',
    },
    {
      id: 'field-funcao',
      type: 'funcao',
      label: 'Função',
      x: 18,
      y: 20,
      width: 27,
      height: 3.5,
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 6,
      fontWeight: 600,
      color: '#334155',
      textAlign: 'left',
      wrap: false,
      visible: true,
      textTransform: 'uppercase',
    },
    {
      id: 'field-qrcode',
      type: 'qrcode',
      label: 'QR Code',
      x: 54,
      y: 15,
      width: 10,
      height: 9,
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 6,
      fontWeight: 600,
      color: '#111827',
      textAlign: 'center',
      wrap: false,
      visible: true,
      textTransform: 'none',
    },
  ],
  printSettings: {
    sheetSize: 'letter',
    orientation: 'portrait',
    sheetWidth: 215.9,
    sheetHeight: 279.4,
    marginTop: 12.7,
    marginRight: 7.9,
    marginBottom: 12.7,
    marginLeft: 7.9,
    horizontalGap: 0,
    verticalGap: 0,
    columns: 3,
    rows: 10,
  },
  createdAt: now,
  updatedAt: now,
};

export const LABEL_FIELD_OPTIONS: { value: LabelField['type']; label: string }[] = [
  { value: 'nome', label: 'Nome' },
  { value: 'equipe', label: 'Equipe' },
  { value: 'circulo', label: 'Círculo' },
  { value: 'funcao', label: 'Função' },
  { value: 'telefone', label: 'Telefone' },
  { value: 'observacao', label: 'Observação' },
  { value: 'codigo', label: 'Código' },
  { value: 'qrcode', label: 'QR Code' },
  { value: 'imagem', label: 'Imagem' },
  { value: 'icone', label: 'Ícone/texto fixo' },
  { value: 'logo', label: 'Logo' },
];

export function cloneDefaultLabelTemplate(): LabelTemplate {
  return JSON.parse(JSON.stringify(DEFAULT_LABEL_TEMPLATE)) as LabelTemplate;
}

export function getOrientedSheetDimensions(settings: PrintSettings) {
  const portrait = { width: settings.sheetWidth, height: settings.sheetHeight };
  if (settings.orientation === 'portrait') return portrait;
  return { width: portrait.height, height: portrait.width };
}

export function getLabelsPerPage(settings: PrintSettings) {
  return Math.max(1, settings.columns * settings.rows);
}

export function paginateLabels(items: LabelDataItem[], settings: PrintSettings) {
  const perPage = getLabelsPerPage(settings);
  const pages: LabelDataItem[][] = [];
  for (let index = 0; index < items.length; index += perPage) {
    pages.push(items.slice(index, index + perPage));
  }
  return pages;
}

export function sortLabelItems(items: LabelDataItem[], grouping: LabelGrouping = 'none') {
  return [...items].sort((a, b) => {
    const groupA = grouping === 'equipe' ? a.equipe : grouping === 'circulo' ? a.circulo : '';
    const groupB = grouping === 'equipe' ? b.equipe : grouping === 'circulo' ? b.circulo : '';
    const groupComparison = groupA.localeCompare(groupB, 'pt-BR', { sensitivity: 'base' });
    if (groupComparison !== 0) return groupComparison;
    return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
  });
}

export function matchesLabelTeamScope(item: LabelDataItem, filters: LabelDataFilters) {
  if (filters.equipeCor && item.equipeCor !== filters.equipeCor) return false;
  if (filters.equipeIds.length > 0 && (!item.equipeId || !filters.equipeIds.includes(item.equipeId))) return false;
  return true;
}

export function validateLabelLayout(template: LabelTemplate): string[] {
  const { printSettings } = template;
  const sheet = getOrientedSheetDimensions(printSettings);
  const requiredWidth =
    printSettings.marginLeft +
    printSettings.marginRight +
    template.width * printSettings.columns +
    printSettings.horizontalGap * Math.max(0, printSettings.columns - 1);
  const requiredHeight =
    printSettings.marginTop +
    printSettings.marginBottom +
    template.height * printSettings.rows +
    printSettings.verticalGap * Math.max(0, printSettings.rows - 1);
  const errors: string[] = [];
  if (requiredWidth > sheet.width + 0.01) errors.push(`A grade excede a largura da folha em ${(requiredWidth - sheet.width).toFixed(1)} mm.`);
  if (requiredHeight > sheet.height + 0.01) errors.push(`A grade excede a altura da folha em ${(requiredHeight - sheet.height).toFixed(1)} mm.`);
  return errors;
}

export function getFieldValue(field: LabelField, item: LabelDataItem): string {
  if (field.type === 'icone') return field.value || '★';
  if (field.type === 'logo') return field.value || 'EJC';
  if (field.type === 'imagem') return item.imagem;
  if (field.type === 'qrcode') return item.qrCode || item.codigo;
  return item[field.type] || '';
}

export const LABEL_PREVIEW_ITEM: LabelDataItem = {
  id: 'preview',
  nome: 'Maria Aparecida',
  equipe: 'Secretaria',
  equipeId: null,
  equipeCor: 'verde',
  circulo: 'São Lucas',
  funcao: 'Coordenadora',
  telefone: '(11) 99999-9999',
  observacao: 'Informação complementar',
  codigo: '06085',
  qrCode: '06085',
  imagem: '',
  tipo: 'encontreiro',
  status: 'confirmado',
};
