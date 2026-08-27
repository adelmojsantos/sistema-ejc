import { supabase } from '../lib/supabase';

export interface CirculoPublicParticipante {
  participacao_id: string;
  nome: string;
}

export interface CirculoPublicInfo {
  circulo_nome: string;
  mediadores: { nome: string }[];
  participantes: CirculoPublicParticipante[];
}

export interface PesquisaEncontristaGeneralInfo {
  encontro_id: string;
  encontro_nome: string;
  circulos: Array<{ circulo_id: number; nome: string }>;
}

export const circuloPublicoService = {
  async obterPesquisaGeneralInfo(encontroId: string): Promise<PesquisaEncontristaGeneralInfo> {
    const { data, error } = await supabase.rpc('get_pesquisa_encontrista_general_info', {
      p_encontro_id: encontroId,
    });
    if (error) throw error;
    return data as PesquisaEncontristaGeneralInfo;
  },

  async obterPesquisaCirculoInfo(circuloId: number, encontroId: string): Promise<CirculoPublicInfo> {
    const { data, error } = await supabase.rpc('get_pesquisa_encontrista_circulo_info', {
      p_circulo_id: circuloId,
      p_encontro_id: encontroId,
    });
    if (error) throw error;
    return data as CirculoPublicInfo;
  },
  /**
   * Retorna as informações públicas de um círculo para a tela de identificação.
   * Não expõe dados sensíveis (telefone, CPF, etc.) — apenas nomes e participacao_id.
   */
  async obterInfo(circulo_id: number, encontro_id: string): Promise<CirculoPublicInfo> {
    const { data, error } = await supabase.rpc('get_circulo_public_info', {
      p_circulo_id: circulo_id,
      p_encontro_id: encontro_id,
    });

    if (error) {
      console.error('Erro ao buscar info pública do círculo:', error);
      throw new Error(error.message || 'Círculo não encontrado.');
    }

    return data as CirculoPublicInfo;
  },
};
