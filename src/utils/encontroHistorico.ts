import type { Encontro } from '../types/encontro';

/**
 * Indica se o encontro já está encerrado (inativo e com data de fim no passado).
 * Espelha a regra da trigger `protect_historical_quadrante`, que torna o logo e o
 * conteúdo do Quadrante somente leitura nesses encontros.
 */
export function isEncontroHistorico(
    encontro: Pick<Encontro, 'ativo' | 'data_fim'> | null | undefined,
    now: Date = new Date(),
): boolean {
    if (!encontro?.data_fim || encontro.ativo) return false;
    const endOfEncounter = new Date(`${encontro.data_fim}T23:59:59`);
    return !Number.isNaN(endOfEncounter.getTime()) && endOfEncounter < now;
}
