import { describe, expect, it } from 'vitest';
import {
  evaluateCoordinatorScope,
  filterCoordinatorTeamCandidates,
  isCoordinatorReleasable,
  selectCoordinatorCandidates,
  validateCoordinatorEmailTarget,
} from './coordinatorAccess';

const encontro = { id: 'encontro-ativo', nome: 'EJC 2026' };
const equipe = { id: 'equipe-visitacao', nome: 'Visitação', libera_acesso_integrantes: true, deleted_at: null };
const participacao = { equipe_id: 'equipe-visitacao', coordenador: true };

describe('escopo da liberação de acessos pelo coordenador', () => {
  it('autoriza o coordenador de equipe habilitada no encontro ativo', () => {
    expect(evaluateCoordinatorScope({ encontro, participacao, equipe })).toEqual({
      ok: true,
      encontroId: 'encontro-ativo',
      encontroNome: 'EJC 2026',
      equipeId: 'equipe-visitacao',
      equipeNome: 'Visitação',
    });
  });

  it('recusa quando não há encontro ativo', () => {
    expect(evaluateCoordinatorScope({ encontro: null, participacao, equipe })).toMatchObject({ ok: false, reason: 'encontro_inativo' });
  });

  it('recusa integrante que não é coordenador', () => {
    expect(evaluateCoordinatorScope({ encontro, participacao: { ...participacao, coordenador: false }, equipe }))
      .toMatchObject({ ok: false, reason: 'nao_coordenador' });
    expect(evaluateCoordinatorScope({ encontro, participacao: null, equipe }))
      .toMatchObject({ ok: false, reason: 'nao_coordenador' });
  });

  it('recusa equipe sem a marcação, excluída ou diferente da participação', () => {
    expect(evaluateCoordinatorScope({ encontro, participacao, equipe: { ...equipe, libera_acesso_integrantes: false } }))
      .toMatchObject({ ok: false, reason: 'equipe_nao_habilitada' });
    expect(evaluateCoordinatorScope({ encontro, participacao, equipe: { ...equipe, deleted_at: '2026-01-01' } }))
      .toMatchObject({ ok: false, reason: 'equipe_nao_habilitada' });
    expect(evaluateCoordinatorScope({ encontro, participacao, equipe: { ...equipe, id: 'outra-equipe' } }))
      .toMatchObject({ ok: false, reason: 'equipe_nao_habilitada' });
  });
});

const candidates = [
  { participacao_id: 'p1', equipe_id: 'equipe-visitacao', papel: 'integrante' as const, status: 'sem_usuario' },
  { participacao_id: 'p2', equipe_id: 'equipe-visitacao', papel: 'integrante' as const, status: 'perfis_pendentes' },
  { participacao_id: 'p3', equipe_id: 'equipe-visitacao', papel: 'integrante' as const, status: 'sem_vinculo' },
  { participacao_id: 'p4', equipe_id: 'equipe-visitacao', papel: 'coordenador' as const, status: 'sem_usuario' },
  { participacao_id: 'p5', equipe_id: 'equipe-circulo', papel: 'integrante' as const, status: 'sem_usuario' },
];

describe('candidatos liberáveis pelo coordenador', () => {
  it('mantém somente integrantes da própria equipe', () => {
    expect(filterCoordinatorTeamCandidates(candidates, 'equipe-visitacao').map((candidate) => candidate.participacao_id))
      .toEqual(['p1', 'p2', 'p3']);
  });

  it('permite apenas criar conta e conceder perfis pendentes', () => {
    expect(isCoordinatorReleasable('sem_usuario')).toBe(true);
    expect(isCoordinatorReleasable('perfis_pendentes')).toBe(true);
    expect(isCoordinatorReleasable('sem_vinculo')).toBe(false);
    expect(isCoordinatorReleasable('conflito_vinculo')).toBe(false);
    expect(isCoordinatorReleasable('sem_email')).toBe(false);
    expect(isCoordinatorReleasable('pronto')).toBe(false);
  });

  it('aceita seleção válida da própria equipe', () => {
    const team = filterCoordinatorTeamCandidates(candidates, 'equipe-visitacao');
    const result = selectCoordinatorCandidates(team, ['p1', 'p2', 'p1']);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.selected.map((candidate) => candidate.participacao_id)).toEqual(['p1', 'p2']);
  });

  it('recusa pessoas de outra equipe, coordenadores e casos de vínculo', () => {
    const team = filterCoordinatorTeamCandidates(candidates, 'equipe-visitacao');
    expect(selectCoordinatorCandidates(team, ['p5']).ok).toBe(false);
    expect(selectCoordinatorCandidates(team, ['p4']).ok).toBe(false);
    expect(selectCoordinatorCandidates(team, ['p1', 'p3']).ok).toBe(false);
    expect(selectCoordinatorCandidates(team, []).ok).toBe(false);
  });
});

describe('cadastro de e-mail pela coordenação', () => {
  const team = [
    { participacao_id: 'p1', pessoa_id: 'pessoa-1', equipe_id: 'equipe-visitacao', papel: 'integrante' as const, status: 'sem_email' },
    { participacao_id: 'p2', pessoa_id: 'pessoa-2', equipe_id: 'equipe-visitacao', papel: 'integrante' as const, status: 'sem_usuario' },
  ];

  it('aceita integrante sem e-mail e normaliza o endereço', () => {
    const result = validateCoordinatorEmailTarget(team, 'p1', '  Fulano@Exemplo.com ');
    expect(result).toMatchObject({ ok: true, email: 'fulano@exemplo.com' });
    if (result.ok) expect(result.candidate.pessoa_id).toBe('pessoa-1');
  });

  it('não sobrescreve e-mail já cadastrado', () => {
    expect(validateCoordinatorEmailTarget(team, 'p2', 'novo@exemplo.com').ok).toBe(false);
  });

  it('recusa pessoa fora da equipe e e-mail inválido', () => {
    expect(validateCoordinatorEmailTarget(team, 'p9', 'novo@exemplo.com').ok).toBe(false);
    expect(validateCoordinatorEmailTarget(team, 'p1', 'sem-arroba').ok).toBe(false);
    expect(validateCoordinatorEmailTarget(team, 'p1', '').ok).toBe(false);
    expect(validateCoordinatorEmailTarget(team, 'p1', undefined).ok).toBe(false);
  });
});
