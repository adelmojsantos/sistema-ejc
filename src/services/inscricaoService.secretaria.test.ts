import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: {},
}));

import { SECRETARIA_SAFE_PERSON_FIELDS } from './inscricaoService';

describe('campos de pessoa permitidos nas listas da Secretaria', () => {
  it.each([
    'alergia',
    'restricao_alimentar',
    'medicamento_continuo',
    'observacoes_saude',
    'possui_alergia',
    'possui_restricao_alimentar',
    'possui_observacao_saude',
    'usa_medicamento_continuo',
  ])('não solicita o campo sensível %s', (field) => {
    expect(SECRETARIA_SAFE_PERSON_FIELDS).not.toContain(field);
  });

  it('mantém somente os dados de identificação necessários ao fluxo', () => {
    expect(SECRETARIA_SAFE_PERSON_FIELDS).toContain('nome_completo');
    expect(SECRETARIA_SAFE_PERSON_FIELDS).toContain('telefone');
    expect(SECRETARIA_SAFE_PERSON_FIELDS).toContain('endereco');
  });
});
