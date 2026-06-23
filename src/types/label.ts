export type LabelFieldType =
  | 'nome'
  | 'equipe'
  | 'circulo'
  | 'visitaGrupo'
  | 'funcao'
  | 'telefone'
  | 'observacao'
  | 'codigo'
  | 'qrcode'
  | 'imagem'
  | 'icone'
  | 'logo';

export type LabelTextTransform = 'none' | 'uppercase' | 'lowercase' | 'capitalize';
export type LabelTextAlign = 'left' | 'center' | 'right';
export type SheetSize = 'a4' | 'letter' | 'custom';
export type SheetOrientation = 'portrait' | 'landscape';
export type LabelGrouping = 'none' | 'circulo' | 'equipe' | 'dupla';
export type LabelTeamColor = 'verde' | 'amarela' | 'vermelha';

export interface LabelField {
  id: string;
  type: LabelFieldType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  textAlign: LabelTextAlign;
  wrap: boolean;
  visible: boolean;
  textTransform: LabelTextTransform;
  value?: string;
  imageUrl?: string;
  backgroundColor?: string;
}

export interface PrintSettings {
  sheetSize: SheetSize;
  orientation: SheetOrientation;
  sheetWidth: number;
  sheetHeight: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  horizontalGap: number;
  verticalGap: number;
  columns: number;
  rows: number;
}

export interface LabelTemplate {
  id: string;
  name: string;
  width: number;
  height: number;
  padding: number;
  borderWidth: number;
  borderColor: string;
  borderRadius: number;
  backgroundColor: string;
  backgroundImage?: string;
  fields: LabelField[];
  printSettings: PrintSettings;
  createdAt: string;
  updatedAt: string;
}

export interface LabelDataItem {
  id: string;
  nome: string;
  equipe: string;
  equipeId: string | null;
  equipeCor: LabelTeamColor | null;
  visitaGrupoId: string | null;
  visitaGrupo: string;
  circulo: string;
  funcao: string;
  telefone: string;
  observacao: string;
  codigo: string;
  qrCode: string;
  imagem: string;
  tipo: 'participante' | 'encontreiro' | 'equipe' | 'circulo';
  status: 'confirmado' | 'pendente';
}

export type LabelPrintItem = LabelDataItem | null;

export interface LabelDataFilters {
  search: string;
  equipeId: string;
  equipeCor: '' | LabelTeamColor;
  equipeIds: string[];
  visitaGrupoId: string;
  circulo: string;
  status: string;
  tipo: string;
}
