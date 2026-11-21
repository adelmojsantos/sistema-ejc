import { describe, expect, it } from 'vitest';
import type { AccessProvisioningCandidate } from '../services/accessProvisioningService';
import { buildTeamAccessInstructions, buildTeamAccessReleasePlan, isCoordinatorReleasable } from './teamAccessRelease';

function candidate(id: string, status: AccessProvisioningCandidate['status']): AccessProvisioningCandidate {
  return {
    participacao_id: id,
    pessoa_id: `pessoa-${id}`,
    nome_completo: `Integrante ${id}`,
    email: status === 'sem_email' ? null : `${id}@exemplo.test`,
    equipe_id: 'equipe',
    equipe_nome: 'Visitação',
    papel: 'integrante',
    grupo_ids: ['grupo'],
    grupos_nomes: ['Visitação'],
    user_id: status === 'sem_usuario' ? null : `user-${id}`,
    pessoa_vinculada: status !== 'sem_vinculo',
    grupos_pendentes_ids: status === 'pronto' ? [] : ['grupo'],
    status,
  };
}

describe('plano de liberação de acessos da equipe', () => {
  const candidates = [
    candidate('a', 'sem_usuario'),
    candidate('b', 'perfis_pendentes'),
    candidate('c', 'sem_usuario'),
    candidate('d', 'sem_vinculo'),
    candidate('e', 'pronto'),
  ];

  it('separa convites por e-mail de concessões de perfis', () => {
    const plan = buildTeamAccessReleasePlan(candidates, ['a', 'b', 'c']);
    expect(plan.convites.map(item => item.participacao_id)).toEqual(['a', 'c']);
    expect(plan.perfis.map(item => item.participacao_id)).toEqual(['b']);
  });

  it('ignora selecionados que a coordenação não pode liberar', () => {
    const plan = buildTeamAccessReleasePlan(candidates, ['d', 'e']);
    expect(plan.convites).toHaveLength(0);
    expect(plan.perfis).toHaveLength(0);
  });

  it('só libera criação de conta e perfis pendentes', () => {
    expect(isCoordinatorReleasable('sem_usuario')).toBe(true);
    expect(isCoordinatorReleasable('perfis_pendentes')).toBe(true);
    expect(isCoordinatorReleasable('sem_vinculo')).toBe(false);
    expect(isCoordinatorReleasable('conflito_vinculo')).toBe(false);
    expect(isCoordinatorReleasable('sem_email')).toBe(false);
    expect(isCoordinatorReleasable('pronto')).toBe(false);
  });

  it('gera orientações com o endereço do sistema', () => {
    const text = buildTeamAccessInstructions('https://sistema.exemplo.test');
    expect(text).toContain('Entre em https://sistema.exemplo.test');
    expect(text).toContain('spam');
  });
});
