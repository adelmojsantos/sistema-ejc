import { beforeEach, describe, expect, it, vi } from 'vitest';

type QueryResult = { data?: unknown; count?: number | null; error: unknown };

const { fromMock, insertMock, results } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  insertMock: vi.fn(),
  results: { destinoCount: null as QueryResult | null, origem: null as QueryResult | null },
}));

vi.mock('../lib/supabase', () => ({ supabase: { from: fromMock } }));
vi.mock('./publicImageStorageService', () => ({ uploadPublicImage: vi.fn() }));
vi.mock('../utils/imageOptimization', () => ({ getFileExtension: vi.fn(), optimizeImageForUpload: vi.fn() }));

import { PalestraCopiaError, palestraService } from './palestraService';

// Simula as duas leituras (contagem do destino e títulos da origem) e a inserção em lote.
function mockSupabase() {
  fromMock.mockImplementation(() => ({
    select: (_columns: string, options?: { head?: boolean }) => ({
      eq: () => (options?.head
        ? Promise.resolve(results.destinoCount)
        : { order: () => Promise.resolve(results.origem) }),
    }),
    insert: insertMock,
  }));
}

describe('palestraService.copiarDoEncontro', () => {
  beforeEach(() => {
    fromMock.mockReset();
    insertMock.mockReset();
    insertMock.mockResolvedValue({ error: null });
    results.destinoCount = { count: 0, error: null };
    results.origem = {
      data: [
        { titulo: 'Conheça-te', ordem: 1 },
        { titulo: 'Fé e Sentido da Vida', ordem: 2 },
      ],
      error: null,
    };
    mockSupabase();
  });

  it('copia somente título e ordem, deixando palestrante, resumo e foto em branco', async () => {
    const total = await palestraService.copiarDoEncontro('encontro-anterior', 'encontro-ativo');

    expect(total).toBe(2);
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledWith([
      {
        encontro_id: 'encontro-ativo',
        titulo: 'Conheça-te',
        ordem: 1,
        pessoa_id: null,
        palestrante_nome: null,
        palestrante_foto_url: null,
        palestrante_foto_posicao_y: 50,
        resumo: null,
      },
      {
        encontro_id: 'encontro-ativo',
        titulo: 'Fé e Sentido da Vida',
        ordem: 2,
        pessoa_id: null,
        palestrante_nome: null,
        palestrante_foto_url: null,
        palestrante_foto_posicao_y: 50,
        resumo: null,
      },
    ]);
  });

  it('não copia quando o encontro atual já possui palestras', async () => {
    results.destinoCount = { count: 3, error: null };

    await expect(palestraService.copiarDoEncontro('encontro-anterior', 'encontro-ativo'))
      .rejects.toBeInstanceOf(PalestraCopiaError);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('não copia quando o encontro de origem não possui palestras', async () => {
    results.origem = { data: [], error: null };

    await expect(palestraService.copiarDoEncontro('encontro-anterior', 'encontro-ativo'))
      .rejects.toThrow('O encontro escolhido não possui palestras para copiar.');
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('não copia um encontro para ele mesmo', async () => {
    await expect(palestraService.copiarDoEncontro('encontro-ativo', 'encontro-ativo'))
      .rejects.toBeInstanceOf(PalestraCopiaError);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('propaga erro do banco na inserção', async () => {
    insertMock.mockResolvedValue({ error: { message: 'permission denied' } });

    await expect(palestraService.copiarDoEncontro('encontro-anterior', 'encontro-ativo'))
      .rejects.toEqual({ message: 'permission denied' });
  });
});
