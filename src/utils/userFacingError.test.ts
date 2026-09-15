import { describe, expect, it } from 'vitest';
import { userFacingError } from './userFacingError';

describe('userFacingError', () => {
  it('traduz credenciais inválidas sem revelar qual campo está incorreto', () => {
    expect(userFacingError({ code: 'invalid_credentials', message: 'Invalid login credentials' }))
      .toBe('E-mail ou senha incorretos. Confira os dados e tente novamente.');
  });

  it('traduz excesso de tentativas', () => {
    expect(userFacingError({ status: 429, message: 'Too many requests' }))
      .toContain('Muitas tentativas');
  });

  it('orienta quando o e-mail ainda não foi confirmado', () => {
    expect(userFacingError({ code: 'email_not_confirmed' }))
      .toContain('ainda não foi confirmado');
  });

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

  it('preserva uma orientação de negócio já escrita em português', () => {
    expect(userFacingError(
      new Error('O arquivo deve ter no máximo 25 MB.'),
      'Não foi possível enviar o arquivo.'
    )).toBe('O arquivo deve ter no máximo 25 MB.');
  });

  it('não expõe detalhes técnicos mesmo quando estão em português', () => {
    expect(userFacingError(
      new Error('Não foi possível acessar a tabela usuarios no Supabase.'),
      'Não foi possível carregar os usuários.'
    )).toBe('Não foi possível carregar os usuários.');
  });
});
