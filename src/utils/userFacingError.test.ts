import { describe, expect, it } from 'vitest';
import { userFacingError } from './userFacingError';

describe('userFacingError', () => {
  it('diferencia sessão expirada', () => {
    expect(userFacingError({ status: 401 })).toContain('sessão expirou');
  });

  it('diferencia falha de conexão', () => {
    expect(userFacingError(new Error('Failed to fetch'))).toContain('internet');
  });

  it('diferencia falta de permissão', () => {
    expect(userFacingError({ code: '42501', message: 'permission denied' }))
      .toContain('não tem permissão');
  });

  it('usa a mensagem segura definida pelo fluxo para erros desconhecidos', () => {
    expect(userFacingError(new Error('detalhe interno'), 'Falha ao salvar.'))
      .toBe('Falha ao salvar.');
  });
});
