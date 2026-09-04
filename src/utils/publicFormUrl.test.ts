import { describe, expect, it } from 'vitest';
import { buildOnlineRegistrationUrl, buildPublicFormUrl } from './publicFormUrl';

describe('buildPublicFormUrl', () => {
  it('gera o mesmo endereço público para todos os pontos de compartilhamento', () => {
    expect(buildPublicFormUrl('encounter-52', 'https://ejc-capelinha.vercel.app'))
      .toBe('https://ejc-capelinha.vercel.app/formulario?encontro=encounter-52');
  });

  it('codifica identificadores antes de adicioná-los à URL', () => {
    expect(buildPublicFormUrl('encontro com espaço', 'http://localhost:5173'))
      .toBe('http://localhost:5173/formulario?encontro=encontro+com+espa%C3%A7o');
  });
});

describe('buildOnlineRegistrationUrl', () => {
  it('gera o endereço público da inscrição online no domínio atual', () => {
    expect(buildOnlineRegistrationUrl('https://www.ejccapelinha.com.br'))
      .toBe('https://www.ejccapelinha.com.br/inscricao-online');
  });
});
