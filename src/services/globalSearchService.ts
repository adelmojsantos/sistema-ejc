import { supabase } from '../lib/supabase';
import { almoxarifadoService } from './almoxarifadoService';
import { circuloParticipacaoService } from './circuloParticipacaoService';
import { visitacaoService } from './visitacaoService';

export type GlobalSearchResultType =
  | 'pessoa'
  | 'equipe'
  | 'dupla'
  | 'circulo'
  | 'pedido'
  | 'compra';

export interface GlobalSearchResult {
  id: string;
  type: GlobalSearchResultType;
  title: string;
  description: string;
  participacaoId?: string;
  route?: string;
}

export interface GlobalSearchResponse {
  results: GlobalSearchResult[];
  partialFailure: boolean;
}

interface SearchScope {
  pessoas: boolean;
  equipes: boolean;
  duplas: boolean;
  circulos: boolean;
  pedidos: boolean;
  compras: boolean;
}

interface SearchOptions {
  encontroId: string;
  term: string;
  scope: SearchScope;
  limit?: number;
}

interface ParticipationSearchRow {
  id: string;
  participante: boolean | null;
  coordenador: boolean | null;
  pessoas: { id: string; nome_completo: string } | Array<{ id: string; nome_completo: string }> | null;
  equipes: { id: string; nome: string | null } | Array<{ id: string; nome: string | null }> | null;
}

const firstRelation = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

const normalize = (value?: string | null) =>
  value
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim() ?? '';

const matches = (value: string | null | undefined, term: string) =>
  normalize(value).includes(normalize(term));

async function searchParticipations(
  encontroId: string,
  term: string,
  scope: Pick<SearchScope, 'pessoas' | 'equipes'>,
  limit: number
) {
  if (!scope.pessoas && !scope.equipes) return [];

  const results: GlobalSearchResult[] = [];

  if (scope.pessoas) {
    const { data, error } = await supabase
      .from('participacoes')
      .select('id, participante, coordenador, pessoas!inner(id, nome_completo), equipes(id, nome)')
      .eq('encontro_id', encontroId)
      .ilike('pessoas.nome_completo', `%${term}%`)
      .limit(limit);
    if (error) throw error;

    ((data ?? []) as ParticipationSearchRow[]).forEach((row) => {
        const pessoa = firstRelation(row.pessoas);
        const equipe = firstRelation(row.equipes);
        if (!pessoa) return;
        results.push({
          id: pessoa.id,
          participacaoId: row.id,
          type: 'pessoa',
          title: pessoa.nome_completo,
          description: row.participante
            ? 'Encontrista'
            : `${equipe?.nome ?? 'Sem equipe'}${row.coordenador ? ' · Coordenação' : ''}`,
        });
    });
  }

  if (scope.equipes) {
    const { data, error } = await supabase
      .from('participacoes')
      .select('id, participante, coordenador, pessoas(id, nome_completo), equipes!inner(id, nome)')
      .eq('encontro_id', encontroId)
      .ilike('equipes.nome', `%${term}%`)
      .limit(100);
    if (error) throw error;

    const seen = new Set<string>();
    ((data ?? []) as ParticipationSearchRow[]).forEach((row) => {
      const equipe = firstRelation(row.equipes);
      if (!equipe || seen.has(equipe.id) || seen.size >= limit) return;
      seen.add(equipe.id);
      results.push({
        id: equipe.id,
        type: 'equipe',
        title: equipe.nome ?? 'Equipe sem nome',
        description: 'Equipe de trabalho',
        route: `/cadastros/equipes?busca=${encodeURIComponent(equipe.nome ?? '')}`,
      });
    });
  }

  return results;
}

export const globalSearchService = {
  async search({ encontroId, term, scope, limit = 5 }: SearchOptions): Promise<GlobalSearchResponse> {
    const tasks: Array<Promise<GlobalSearchResult[]>> = [
      searchParticipations(encontroId, term, scope, limit),
    ];

    if (scope.duplas) {
      tasks.push(visitacaoService.listarGrupos(encontroId).then((groups) =>
        groups
          .filter((group) => matches(group.nome, term))
          .slice(0, limit)
          .map((group) => ({
            id: group.id,
            type: 'dupla' as const,
            title: group.nome ?? 'Dupla sem nome',
            description: 'Dupla de visitação',
            route: `/visitacao/coordenador?grupo=${group.id}`,
          }))
      ));
    }

    if (scope.circulos) {
      tasks.push(circuloParticipacaoService.listarPorEncontro(encontroId).then((links) => {
        const seen = new Set<number>();
        return links.flatMap((link) => {
          if (seen.has(link.circulo_id) || !matches(link.circulos?.nome, term) || seen.size >= limit) return [];
          seen.add(link.circulo_id);
          return [{
            id: String(link.circulo_id),
            type: 'circulo' as const,
            title: link.circulos?.nome ?? 'Círculo sem nome',
            description: 'Círculo do encontro',
            route: `/circulos/montagem?circulo=${link.circulo_id}`,
          }];
        });
      }));
    }

    if (scope.pedidos) {
      tasks.push(almoxarifadoService.listarPedidos(encontroId, { busca: term }).then((orders) =>
        orders.slice(0, limit).map((order) => ({
          id: order.id,
          type: 'pedido' as const,
          title: order.titulo,
          description: order.equipe?.nome ?? 'Pedido geral',
          route: `/compras/almoxarifado/pedidos?busca=${encodeURIComponent(term)}`,
        }))
      ));
    }

    if (scope.compras) {
      tasks.push(almoxarifadoService.listarCompras(encontroId).then((purchases) =>
        purchases
          .filter((purchase) =>
            matches(purchase.mercado_fornecedor, term)
            || purchase.itens?.some((item) => matches(item.item?.nome, term)))
          .slice(0, limit)
          .map((purchase) => ({
            id: purchase.id,
            type: 'compra' as const,
            title: purchase.mercado_fornecedor || 'Compra sem fornecedor',
            description: `Compra · ${purchase.status}`,
            route: `/compras/almoxarifado/compras-realizadas/${purchase.id}`,
          }))
      ));
    }

    const settled = await Promise.allSettled(tasks);
    return {
      results: settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []),
      partialFailure: settled.some((result) => result.status === 'rejected'),
    };
  },
};
