import type { VisitaStatus } from '../types/visitacao';
import type { IntencaoCamisetaItem } from '../services/visitacaoService';

export type VisitFormSectionId = 'visit' | 'operation' | 'personal' | 'family' | 'health' | 'notes';
export type VisitFormSectionStatus = 'neutral' | 'complete' | 'pending' | 'attention';

export interface VisitFormSnapshot {
  status: VisitaStatus;
  observacoes: string;
  taxaPaga: boolean;
  nomeCompleto: string;
  telefone: string;
  endereco: string;
  numero: string;
  complemento: string;
  cep: string;
  bairro: string;
  cidade: string;
  estado: string;
  dataNascimento: string;
  nomePai: string;
  telefonePai: string;
  nomeMae: string;
  telefoneMae: string;
  restricaoAlimentar: string;
  medicamentoContinuo: string;
  alergia: string;
  observacoesSaude: string;
  possuiRestricaoAlimentar: boolean | null;
  possuiAlergia: boolean | null;
  usaMedicamentoContinuo: boolean | null;
  possuiObservacaoSaude: boolean | null;
  intencoes: IntencaoCamisetaItem[];
}

const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ');

export const serializeVisitForm = (snapshot: VisitFormSnapshot) => JSON.stringify({
  ...snapshot,
  observacoes: normalizeText(snapshot.observacoes),
  nomeCompleto: normalizeText(snapshot.nomeCompleto),
  telefone: normalizeText(snapshot.telefone),
  endereco: normalizeText(snapshot.endereco),
  numero: normalizeText(snapshot.numero),
  complemento: normalizeText(snapshot.complemento),
  cep: normalizeText(snapshot.cep),
  bairro: normalizeText(snapshot.bairro),
  cidade: normalizeText(snapshot.cidade),
  estado: normalizeText(snapshot.estado).toUpperCase(),
  dataNascimento: normalizeText(snapshot.dataNascimento),
  nomePai: normalizeText(snapshot.nomePai),
  telefonePai: normalizeText(snapshot.telefonePai),
  nomeMae: normalizeText(snapshot.nomeMae),
  telefoneMae: normalizeText(snapshot.telefoneMae),
  restricaoAlimentar: normalizeText(snapshot.restricaoAlimentar),
  medicamentoContinuo: normalizeText(snapshot.medicamentoContinuo),
  alergia: normalizeText(snapshot.alergia),
  observacoesSaude: normalizeText(snapshot.observacoesSaude),
  intencoes: snapshot.intencoes.map((item) => ({
    id: item.id ?? null,
    modelo_id: item.modelo_id,
    tamanho: item.tamanho,
    quantidade: item.quantidade,
  })),
});

const hasCareAttention = (flag: boolean | null, description: string) => (
  flag === null || (flag === true && !description.trim())
);

export const getVisitFormSectionStatuses = (
  snapshot: VisitFormSnapshot,
  showValidationErrors = false,
): Record<VisitFormSectionId, VisitFormSectionStatus> => {
  const healthPending = [
    [snapshot.possuiRestricaoAlimentar, snapshot.restricaoAlimentar],
    [snapshot.possuiAlergia, snapshot.alergia],
    [snapshot.usaMedicamentoContinuo, snapshot.medicamentoContinuo],
    [snapshot.possuiObservacaoSaude, snapshot.observacoesSaude],
  ].some(([flag, description]) => hasCareAttention(flag as boolean | null, description as string));

  return {
    visit: 'neutral',
    operation: 'neutral',
    personal: 'neutral',
    family: 'neutral',
    health: healthPending ? (showValidationErrors ? 'attention' : 'pending') : 'complete',
    notes: 'neutral',
  };
};

export const countVisitFormPendingSections = (
  statuses: Record<VisitFormSectionId, VisitFormSectionStatus>,
) => Object.values(statuses).filter((status) => status === 'pending' || status === 'attention').length;

export const getCancelledVisitIntentions = (snapshot: unknown): IntencaoCamisetaItem[] => {
  if (!snapshot || typeof snapshot !== 'object') return [];
  const intentions = (snapshot as { intencoes_camiseta?: unknown }).intencoes_camiseta;
  if (!Array.isArray(intentions)) return [];

  return intentions.filter((item): item is IntencaoCamisetaItem => {
    if (!item || typeof item !== 'object') return false;
    const candidate = item as Partial<IntencaoCamisetaItem>;
    return typeof candidate.modelo_id === 'string'
      && typeof candidate.tamanho === 'string'
      && typeof candidate.quantidade === 'number';
  });
};
