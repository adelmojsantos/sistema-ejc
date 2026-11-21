import { supabase } from '../lib/supabase';

export type AccessRuleRole = 'coordenador' | 'integrante';

export interface AccessRuleTeam {
  id: string;
  nome: string;
}

export interface AccessRule {
  equipe_id: string;
  papel: AccessRuleRole;
  grupo_id: string;
}

export interface AccessProvisioningCandidate {
  participacao_id: string;
  pessoa_id: string;
  nome_completo: string;
  email: string | null;
  equipe_id: string;
  equipe_nome: string;
  papel: AccessRuleRole;
  grupo_ids: string[];
  grupos_nomes: string[];
  user_id: string | null;
  pessoa_vinculada: boolean;
  grupos_pendentes_ids: string[];
  status: 'sem_email' | 'sem_usuario' | 'sem_vinculo' | 'perfis_pendentes' | 'pronto' | 'conflito_vinculo';
}

export interface AccessProvisioningResult {
  participacao_id: string;
  pessoa_id: string;
  nome_completo: string;
  success: boolean;
  created: boolean;
  linked: boolean;
  granted: number;
  message?: string;
}

export type MyTeamAccessOverview =
  | {
      disponivel: false;
      motivo: 'encontro_inativo' | 'equipe_nao_habilitada';
      mensagem: string;
    }
  | {
      disponivel: true;
      encontro_id: string;
      encontro_nome: string;
      equipe_id: string;
      equipe_nome: string;
      grupos_nomes: string[];
      candidates: AccessProvisioningCandidate[];
    };

interface FunctionErrorWithContext {
  context?: { json?: () => Promise<unknown> };
}

/** Lê a mensagem devolvida pela Edge Function em respostas não-2xx. */
async function functionErrorMessage(error: unknown): Promise<Error> {
  const context = (error as FunctionErrorWithContext | null)?.context;
  if (context?.json) {
    try {
      const payload = await context.json();
      if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
        return new Error(payload.error);
      }
    } catch {
      // Corpo ausente ou não-JSON: mantém o erro original.
    }
  }
  return error instanceof Error ? error : new Error('Não foi possível concluir a operação.');
}

async function invokeAdminUsers<T>(
  body: Record<string, unknown>,
  options: { readErrorBody?: boolean } = {},
): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Sessão expirada. Faça login novamente.');

  const { data, error } = await supabase.functions.invoke('admin-users', {
    body,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) throw options.readErrorBody ? await functionErrorMessage(error) : error;
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export const accessProvisioningService = {
  async listTeams(encontroId: string): Promise<AccessRuleTeam[]> {
    const { data, error } = await supabase
      .from('participacoes')
      .select('equipe_id, equipes(id, nome)')
      .eq('encontro_id', encontroId)
      .not('equipe_id', 'is', null);

    if (error) throw error;

    const teams = new Map<string, AccessRuleTeam>();
    for (const row of data ?? []) {
      const equipe = Array.isArray(row.equipes) ? row.equipes[0] : row.equipes;
      if (row.equipe_id && equipe?.nome) {
        teams.set(row.equipe_id, { id: row.equipe_id, nome: equipe.nome });
      }
    }

    return [...teams.values()].sort((first, second) => first.nome.localeCompare(second.nome, 'pt-BR'));
  },

  async listRules(encontroId: string): Promise<AccessRule[]> {
    const { data, error } = await supabase
      .from('equipe_acesso_regras')
      .select('equipe_id, papel, grupo_id')
      .eq('encontro_id', encontroId);

    if (error) throw error;
    return (data ?? []) as AccessRule[];
  },

  async replaceRules(encontroId: string, rules: AccessRule[]): Promise<number> {
    const { data, error } = await supabase.rpc('substituir_regras_acesso_equipes', {
      p_encontro_id: encontroId,
      p_regras: rules,
    });

    if (error) throw error;
    return Number(data ?? 0);
  },

  async listCandidates(encontroId: string): Promise<AccessProvisioningCandidate[]> {
    const response = await invokeAdminUsers<{ candidates: AccessProvisioningCandidate[] }>(
      { action: 'list-configured-access-candidates', encontroId },
    );
    return response.candidates;
  },

  async prepareCandidates(encontroId: string, participacaoIds: string[]): Promise<AccessProvisioningResult[]> {
    const response = await invokeAdminUsers<{ results: AccessProvisioningResult[] }>(
      { action: 'prepare-configured-accesses', encontroId, participacaoIds },
    );
    return response.results;
  },

  /** Coordenação: integrantes da própria equipe com acesso configurado no encontro ativo. */
  async getMyTeamOverview(): Promise<MyTeamAccessOverview> {
    return invokeAdminUsers<MyTeamAccessOverview>({ action: 'list-my-team-access-candidates' }, { readErrorBody: true });
  },

  /** Coordenação: cria conta (convite) ou concede perfis pendentes dos integrantes selecionados. */
  async prepareMyTeamAccesses(participacaoIds: string[]): Promise<AccessProvisioningResult[]> {
    const response = await invokeAdminUsers<{ results: AccessProvisioningResult[] }>(
      { action: 'prepare-my-team-accesses', participacaoIds },
      { readErrorBody: true },
    );
    return response.results;
  },
};
