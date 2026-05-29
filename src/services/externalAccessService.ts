import { supabase } from '../lib/supabase';

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

export const externalAccessService = {
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
    const { data, error } = await supabase
      .from('external_sessions')
      .select(`
        *,
        participacoes (
          pessoa_id,
          equipe_id,
          dados_confirmados,
          pessoas (nome_completo),
          equipes (nome)
        )
      `)
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error) {
       console.error('Erro ao buscar sessão externa:', error);
       throw new Error('Sessão inválida ou expirada.');
    }

    return data as any;
  }
};
