import { supabase } from '../lib/supabase';
import type { Encontro } from '../types/encontro';
import type { Equipe } from '../types/equipe';
import type { InscricaoEnriched } from '../types/inscricao';
import type { RecepcaoDados, RecepcaoDadosFormData } from '../types/recepcao';
import type { RecreacaoDados, RecreacaoDadosFormData } from '../types/recreacao';

export interface ExternalAccessParams {
  encontro_id: string;
  equipe_id: string;
  nome: string;
  telefone_fim: string;
}

export interface ExternalSession {
  id: string;
  participacao_id: string;
  encontro_id: string;
  token: string;
  expires_at: string;
  participacoes?: {
    pessoa_id: string;
    equipe_id: string;
    dados_confirmados: boolean;
    pessoas: {
      nome_completo: string;
    };
    equipes: {
      nome: string;
    };
  };
}

export interface CirculoAccessParams {
  circulo_id: number;
  encontro_id: string;
  participacao_id: string;
  data_nascimento: string; // formato YYYY-MM-DD
  telefone_fim: string;    // 4 últimos dígitos
}

export interface ExternalFormContext {
  encontro: Pick<Encontro, 'id' | 'nome' | 'data_inicio' | 'formulario_publico_ativo'>;
  equipes: Array<Pick<Equipe, 'id' | 'nome'>>;
}

export interface ExternalRecreacaoContext {
  encontro: Pick<Encontro, 'id' | 'nome' | 'data_inicio'>;
  equipes: Array<Pick<Equipe, 'id' | 'nome'>>;
  participantes: InscricaoEnriched[];
  criancas: RecreacaoDados[];
}

export const externalAccessService = {
  async getFormContext(encontroId: string): Promise<ExternalFormContext | null> {
    const { data, error } = await supabase.rpc('get_external_form_context', {
      p_encontro_id: encontroId
    });

    if (error) throw error;
    return (data as ExternalFormContext | null) ?? null;
  },

  /**
   * Valida os dados do participante e gera um token de acesso temporário via RPC.
   */
  async validateExternalAccess(params: ExternalAccessParams): Promise<string> {
    const { data, error } = await supabase.rpc('validate_external_access', {
      p_encontro_id: params.encontro_id,
      p_equipe_id: params.equipe_id,
      p_nome: params.nome,
      p_telefone: params.telefone_fim
    });

    if (error) {
      console.error('Erro na validação externa:', error);
      throw new Error(error.message || 'Não foi possível validar seus dados.');
    }

    return data as string;
  },

  /**
   * Valida o encontrista pelo círculo (participacao_id + data_nascimento + 4 últimos dígitos do telefone)
   * e gera um token de acesso temporário com validade de 24 horas.
   */
  async validateCirculoAccess(params: CirculoAccessParams): Promise<string> {
    const { data, error } = await supabase.rpc('validate_circulo_access', {
      p_circulo_id: params.circulo_id,
      p_encontro_id: params.encontro_id,
      p_participacao_id: params.participacao_id,
      p_data_nascimento: params.data_nascimento,
      p_telefone_fim: params.telefone_fim,
    });

    if (error) {
      console.error('Erro na validação do círculo:', error);
      throw new Error(error.message || 'Não foi possível validar seus dados.');
    }

    return data as string;
  },

  /**
   * Recupera e valida uma sessão externa pelo token.
   */
  async getSession(token: string): Promise<ExternalSession> {
    const { data, error } = await supabase.rpc('get_external_session', {
      p_token: token
    });

    if (error || !data) {
       console.error('Erro ao buscar sessão externa:', error);
       throw new Error('Sessão inválida ou expirada.');
    }

    return data as unknown as ExternalSession;
  },

  async getRecepcao(token: string): Promise<RecepcaoDados | null> {
    const { data, error } = await supabase.rpc('get_external_recepcao', {
      p_token: token
    });
    if (error) throw error;
    return (data as RecepcaoDados | null) ?? null;
  },

  async saveRecepcao(token: string, formData: RecepcaoDadosFormData): Promise<RecepcaoDados> {
    const { data, error } = await supabase.rpc('save_external_recepcao', {
      p_token: token,
      p_data: formData
    });
    if (error || !data) throw error ?? new Error('Não foi possível salvar os dados.');
    return data as unknown as RecepcaoDados;
  },

  async deleteRecepcao(token: string, id: string): Promise<void> {
    const { data, error } = await supabase.rpc('delete_external_recepcao', {
      p_token: token,
      p_id: id
    });
    if (error || !data) throw error ?? new Error('Cadastro não encontrado ou sem permissão.');
  },

  async getRecreacaoContext(token: string): Promise<ExternalRecreacaoContext> {
    const { data, error } = await supabase.rpc('get_external_recreacao_context', {
      p_token: token
    });
    if (error || !data) throw error ?? new Error('Sessão inválida ou expirada.');
    return data as unknown as ExternalRecreacaoContext;
  },

  async saveRecreacao(
    token: string,
    formData: RecreacaoDadosFormData,
    id?: string
  ): Promise<RecreacaoDados> {
    const { data, error } = await supabase.rpc('save_external_recreacao', {
      p_token: token,
      p_id: id ?? null,
      p_data: formData
    });
    if (error || !data) throw error ?? new Error('Não foi possível salvar os dados.');
    return data as unknown as RecreacaoDados;
  },

  async deleteRecreacao(token: string, id: string): Promise<void> {
    const { data, error } = await supabase.rpc('delete_external_recreacao', {
      p_token: token,
      p_id: id
    });
    if (error || !data) throw error ?? new Error('Cadastro não encontrado ou sem permissão.');
  },

  async getExternalTeams(token: string, onlyPosEncontro = false): Promise<Array<Pick<Equipe, 'id' | 'nome'>>> {
    const { data, error } = await supabase.rpc('get_external_teams', {
      p_token: token,
      p_only_pos_encontro: onlyPosEncontro
    });
    if (error) throw error;
    return (data as Array<Pick<Equipe, 'id' | 'nome'>> | null) ?? [];
  }
};
