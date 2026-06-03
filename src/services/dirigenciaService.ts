import { supabase } from '../lib/supabase';
import type {
  Dirigencia,
  DirigenciaEvento,
  DirigenciaIndicacao,
  DirigenciaMembro,
  DirigenciaStatus,
  IndicacaoStatus,
  IndicacaoTipo,
} from '../types/dirigencia';
import type { Pessoa } from '../types/pessoa';

const throwIfError = (error: { message: string } | null) => {
  if (error) throw error;
};

interface DirigenciaEventoRow extends Omit<DirigenciaEvento, 'executado_por_nome'> {
  profiles: { email: string } | { email: string }[] | null;
}

export interface DirigenciaAcesso {
  pessoa_id: string;
  nome_completo: string;
  email: string | null;
  possui_acesso: boolean;
  temporary_password: boolean | null;
}

export interface DirigenciaAcessosStatus {
  acessos: DirigenciaAcesso[];
  todos_prontos: boolean;
  pendentes: number;
  sem_email: number;
  criados?: number;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sessão expirada. Faça login novamente.');
  return { Authorization: `Bearer ${token}` };
}

export const dirigenciaService = {
  async listar(): Promise<Dirigencia[]> {
    const { data, error } = await supabase
      .from('dirigencias')
      .select('*')
      .order('created_at', { ascending: false });

    throwIfError(error);
    return (data ?? []) as Dirigencia[];
  },

  async listarMembros(dirigenciaId: string): Promise<DirigenciaMembro[]> {
    const { data, error } = await supabase
      .from('dirigencia_membros')
      .select('*, pessoas(id, nome_completo, email)')
      .eq('dirigencia_id', dirigenciaId)
      .order('entrou_em', { ascending: true });

    throwIfError(error);
    return (data ?? []) as unknown as DirigenciaMembro[];
  },

  async listarIndicacoes(dirigenciaId: string): Promise<DirigenciaIndicacao[]> {
    const { data, error } = await supabase
      .from('dirigencia_indicacoes')
      .select(`
        *,
        indicado:pessoas!dirigencia_indicacoes_indicado_pessoa_id_fkey(id, nome_completo, email),
        indicador:dirigencia_membros!dirigencia_indicacoes_indicador_membro_id_fkey(
          id,
          pessoas(id, nome_completo, email)
        )
      `)
      .eq('dirigencia_destino_id', dirigenciaId)
      .order('created_at', { ascending: true });

    throwIfError(error);
    return (data ?? []) as unknown as DirigenciaIndicacao[];
  },

  async listarEventos(dirigenciaId: string, limite?: number): Promise<DirigenciaEvento[]> {
    let query = supabase
      .from('dirigencia_eventos')
      .select('*, profiles(email)')
      .eq('dirigencia_id', dirigenciaId)
      .order('created_at', { ascending: false });

    if (limite) query = query.limit(limite);

    const { data, error } = await query;

    throwIfError(error);
    const eventos = (data ?? []) as unknown as DirigenciaEventoRow[];
    const emails = [...new Set(eventos.flatMap((evento) => {
      const profile = Array.isArray(evento.profiles) ? evento.profiles[0] : evento.profiles;
      return profile?.email ? [profile.email] : [];
    }))];

    const { data: pessoas, error: pessoasError } = emails.length > 0
      ? await supabase
          .from('pessoas')
          .select('email, nome_completo')
          .in('email', emails)
      : { data: [], error: null };

    throwIfError(pessoasError);
    const nomesPorEmail = new Map(
      (pessoas ?? []).map((pessoa) => [pessoa.email?.toLowerCase(), pessoa.nome_completo])
    );

    return eventos.map(({ profiles, ...evento }) => {
      const profile = Array.isArray(profiles) ? profiles[0] : profiles;
      const email = profile?.email;

      return {
        ...evento,
        executado_por_nome: email
          ? nomesPorEmail.get(email.toLowerCase()) || email
          : 'Usuário não identificado',
      };
    });
  },

  async buscarPessoas(busca: string): Promise<Pessoa[]> {
    const termo = busca.trim();
    if (termo.length < 2) return [];

    const { data, error } = await supabase
      .from('pessoas')
      .select('*')
      .or(`nome_completo.ilike.%${termo}%,email.ilike.%${termo}%`)
      .order('nome_completo')
      .limit(12);

    throwIfError(error);
    return (data ?? []) as Pessoa[];
  },

  async criar(nome: string, status: Extract<DirigenciaStatus, 'indicacao' | 'ativa'>): Promise<void> {
    const { error } = await supabase.rpc('criar_dirigencia', {
      p_nome: nome,
      p_status: status,
    });
    throwIfError(error);
  },

  async adicionarMembro(dirigenciaId: string, pessoaId: string): Promise<void> {
    const { error } = await supabase.rpc('adicionar_membro_dirigencia', {
      p_dirigencia_id: dirigenciaId,
      p_pessoa_id: pessoaId,
    });
    throwIfError(error);
  },

  async registrarSaida(membroId: string, motivo?: string): Promise<void> {
    const { error } = await supabase.rpc('registrar_saida_dirigente', {
      p_membro_id: membroId,
      p_motivo: motivo || null,
    });
    throwIfError(error);
  },

  async indicar(params: {
    dirigenciaDestinoId: string;
    indicadorMembroId?: string;
    indicadoPessoaId: string;
    tipo: IndicacaoTipo;
    motivo?: string;
  }): Promise<void> {
    const { error } = await supabase.rpc('adicionar_indicacao_dirigencia', {
      p_dirigencia_destino_id: params.dirigenciaDestinoId,
      p_indicador_membro_id: params.indicadorMembroId || null,
      p_indicado_pessoa_id: params.indicadoPessoaId,
      p_tipo: params.tipo,
      p_motivo: params.motivo || null,
    });
    throwIfError(error);
  },

  async atualizarStatusIndicacao(indicacaoId: string, status: IndicacaoStatus): Promise<void> {
    const { error } = await supabase.rpc('atualizar_status_indicacao_dirigencia', {
      p_indicacao_id: indicacaoId,
      p_status: status,
    });
    throwIfError(error);
  },

  async finalizarIndicacoes(dirigenciaId: string): Promise<void> {
    const { error } = await supabase.rpc('finalizar_indicacoes_dirigencia', {
      p_dirigencia_id: dirigenciaId,
    });
    throwIfError(error);
  },

  async reabrirIndicacoes(dirigenciaId: string): Promise<void> {
    const { error } = await supabase.rpc('reabrir_indicacoes_dirigencia', {
      p_dirigencia_id: dirigenciaId,
    });
    throwIfError(error);
  },

  async consultarAcessos(dirigenciaId: string): Promise<DirigenciaAcessosStatus> {
    const headers = await getAuthHeaders();
    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: {
        action: 'dirigencia-access-status',
        dirigenciaId,
      },
      headers,
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data as DirigenciaAcessosStatus;
  },

  async prepararAcessos(dirigenciaId: string): Promise<DirigenciaAcessosStatus> {
    const headers = await getAuthHeaders();
    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: {
        action: 'prepare-dirigencia-accesses',
        dirigenciaId,
      },
      headers,
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data as DirigenciaAcessosStatus;
  },

  async ativar(dirigenciaId: string): Promise<void> {
    const { error } = await supabase.rpc('ativar_nova_dirigencia', {
      p_dirigencia_id: dirigenciaId,
    });
    throwIfError(error);
  },
};
