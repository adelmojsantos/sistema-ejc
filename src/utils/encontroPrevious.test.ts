import { describe, expect, it } from 'vitest';
import type { Encontro } from '../types/encontro';
import { findPreviousEncounter } from './encontroPrevious';

function encontro(id: string, edicao: number | null, dataInicio: string): Encontro {
  return {
    id,
    nome: `Encontro ${id}`,
    edicao,
    data_inicio: dataInicio,
    data_fim: dataInicio,
    local: null,
    descricao: null,
    ativo: false,
    formulario_publico_ativo: false,
    created_at: dataInicio,
    tema: null,
    musica: null,
    link_musica: null,
    link_youtube: null,
    limite_vagas_online: 0,
    valor_taxa: 0,
  };
}

describe('findPreviousEncounter', () => {
  it('usa a edição imediatamente anterior mesmo quando a lista está fora de ordem', () => {
    const encontros = [
      encontro('53', 53, '2026-10-01'),
      encontro('51', 51, '2025-10-01'),
      encontro('52', 52, '2026-04-01'),
    ];

    expect(findPreviousEncounter(encontros, '53')?.id).toBe('52');
  });

  it('usa a data quando não há edição anterior disponível', () => {
    const encontros = [
      encontro('atual', null, '2026-10-01'),
      encontro('antigo', null, '2025-10-01'),
      encontro('anterior', null, '2026-04-01'),
    ];

    expect(findPreviousEncounter(encontros, 'atual')?.id).toBe('anterior');
  });

  it('não retorna encontro futuro nem o próprio encontro', () => {
    const encontros = [
      encontro('primeiro', 1, '2025-01-01'),
      encontro('segundo', 2, '2026-01-01'),
    ];

    expect(findPreviousEncounter(encontros, 'primeiro')).toBeNull();
  });
});
