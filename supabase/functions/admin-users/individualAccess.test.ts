import { describe, expect, it } from 'vitest';
import {
  individualAccessConflict,
  normalizeGroupIds,
  profileFailureMessage,
} from './individualAccess';

describe('individual access provisioning', () => {
  it('normaliza e remove perfis de acesso duplicados', () => {
    expect(normalizeGroupIds([' grupo-1 ', 'grupo-1', 'grupo-2'])).toEqual(['grupo-1', 'grupo-2']);
    expect(normalizeGroupIds(undefined)).toBeNull();
    expect(normalizeGroupIds('grupo-1')).toEqual([]);
  });

  it('impede uma segunda conta para a mesma pessoa', () => {
    expect(individualAccessConflict(
      'pessoa-1',
      { id: 'user-1', email: 'anterior@example.com', pessoa_id: 'pessoa-1' },
      [],
    )).toContain('já possui uma conta');
  });

  it('diferencia e-mail vinculado a outra pessoa de conta sem vínculo', () => {
    expect(individualAccessConflict(
      'pessoa-1',
      null,
      [{ id: 'user-2', email: 'conta@example.com', pessoa_id: 'pessoa-2' }],
    )).toContain('outra pessoa');

    expect(individualAccessConflict(
      'pessoa-1',
      null,
      [{ id: 'user-2', email: 'conta@example.com', pessoa_id: null }],
    )).toContain('sem pessoa vinculada');
  });

  it('traduz conflitos de integridade sem expor detalhes do banco', () => {
    expect(profileFailureMessage('23505')).toContain('outra conta');
    expect(profileFailureMessage('23503')).toContain('não está mais disponível');
    expect(profileFailureMessage('XX000')).toContain('Nenhuma conta foi mantida');
  });
});
