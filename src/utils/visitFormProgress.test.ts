import { describe, expect, it } from 'vitest';
import {
  countVisitFormPendingSections,
  getCancelledVisitIntentions,
  getVisitFormSectionStatuses,
  serializeVisitForm,
  type VisitFormSnapshot,
} from './visitFormProgress';

const completeSnapshot = (): VisitFormSnapshot => ({
  status: 'realizada', observacoes: '', taxaPaga: false,
  nomeCompleto: 'Maria da Silva', telefone: '(16) 99999-9999',
  endereco: '', numero: '', complemento: '', cep: '', bairro: '', cidade: '', estado: '',
  dataNascimento: '', nomePai: '', telefonePai: '', nomeMae: '', telefoneMae: '',
  restricaoAlimentar: '', medicamentoContinuo: '', alergia: '', observacoesSaude: '',
  possuiRestricaoAlimentar: false, possuiAlergia: false,
  usaMedicamentoContinuo: false, possuiObservacaoSaude: false,
  intencoes: [],
});

describe('visitFormProgress', () => {
  it('identifica somente a saúde como pendente e mantém os demais blocos neutros', () => {
    const snapshot = completeSnapshot();
    snapshot.status = 'pendente';
    snapshot.possuiAlergia = null;

    const statuses = getVisitFormSectionStatuses(snapshot);

    expect(statuses.visit).toBe('neutral');
    expect(statuses.health).toBe('pending');
    expect(statuses.operation).toBe('neutral');
    expect(statuses.notes).toBe('neutral');
    expect(countVisitFormPendingSections(statuses)).toBe(1);
  });

  it('transforma pendência obrigatória em atenção após validar', () => {
    const snapshot = completeSnapshot();
    snapshot.possuiAlergia = true;

    expect(getVisitFormSectionStatuses(snapshot, true).health).toBe('attention');
  });

  it('normaliza espaços e ignora estado de pagamento persistido separadamente', () => {
    const first = completeSnapshot();
    first.nomeCompleto = ' Maria   da Silva ';
    first.intencoes = [{ id: '1', modelo_id: 'm1', tamanho: 'M', quantidade: 1, pago: false }];

    const second = completeSnapshot();
    second.intencoes = [{ id: '1', modelo_id: 'm1', tamanho: 'M', quantidade: 1, pago: true }];

    expect(serializeVisitForm(first)).toBe(serializeVisitForm(second));
  });

  it('recupera intenções preservadas no snapshot de uma participação cancelada', () => {
    const intention = { modelo_id: 'modelo-1', tamanho: 'M', quantidade: 2, pago: true };

    expect(getCancelledVisitIntentions({ intencoes_camiseta: [intention] })).toEqual([intention]);
    expect(getCancelledVisitIntentions({ intencoes_camiseta: [{ tamanho: 'M' }] })).toEqual([]);
    expect(getCancelledVisitIntentions(null)).toEqual([]);
  });
});
