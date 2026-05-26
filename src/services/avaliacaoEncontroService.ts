import { supabase } from '../lib/supabase';

export type AvaliacaoPerguntaTipo = 'texto' | 'texto_longo' | 'nota' | 'nota_justificativa' | 'participante_destaque' | 'sim_nao' | 'multipla_escolha';
export type AvaliacaoEnvioStatus = 'rascunho' | 'enviado';
export type AvaliacaoPerguntaOpcoes = string[] | { escala_min?: number; escala_max?: number } | null;

export interface AvaliacaoPergunta {
  id: string;
  encontro_id: string;
  ordem: number;
  titulo: string;
  descricao: string | null;
  tipo: AvaliacaoPerguntaTipo;
  obrigatoria: boolean;
  opcoes: AvaliacaoPerguntaOpcoes;
  ativa: boolean;
}

export interface AvaliacaoPerguntaFormData {
  encontro_id: string;
  ordem: number;
  titulo: string;
  descricao: string | null;
  tipo: AvaliacaoPerguntaTipo;
  obrigatoria: boolean;
  opcoes: AvaliacaoPerguntaOpcoes;
  ativa: boolean;
}

export interface AvaliacaoResposta {
  id: string;
  encontro_id: string;
  equipe_id: string;
  pergunta_id: string;
  resposta_texto: string | null;
  resposta_numero: number | null;
  resposta_json: unknown | null;
  respondido_por: string | null;
}

export interface AvaliacaoEnvio {
  id: string;
  encontro_id: string;
  equipe_id: string;
  status: AvaliacaoEnvioStatus;
  enviado_por: string | null;
  enviado_em: string | null;
}

export interface AvaliacaoEquipeResumo {
  equipe_id: string;
  equipe_nome: string;
  status: AvaliacaoEnvioStatus | 'pendente';
  enviado_em: string | null;
  total_respostas: number;
  total_perguntas: number;
}

export interface AvaliacaoRespostaInput {
  encontroId: string;
  equipeId: string;
  pergunta: AvaliacaoPergunta;
  valor: string;
  userId: string;
}

export interface AvaliacaoResumoIA {
  id: string;
  encontro_id: string;
  conteudo: string;
  provider: string;
  model: string;
  prompt_version: string;
  total_equipes: number;
  total_equipes_enviadas: number;
  total_respostas: number;
  gerado_por: string | null;
  created_at: string;
}

export interface GerarResumoIAResponse {
  resumo: AvaliacaoResumoIA;
  totalResumos: number;
  limite: number;
}

export const avaliacaoEncontroService = {
  async listarPerguntas(encontroId: string): Promise<AvaliacaoPergunta[]> {
    const { data, error } = await supabase
      .from('avaliacao_perguntas')
      .select('id, encontro_id, ordem, titulo, descricao, tipo, obrigatoria, opcoes, ativa')
      .eq('encontro_id', encontroId)
      .eq('ativa', true)
      .order('ordem', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data ?? []) as AvaliacaoPergunta[];
  },

  async criarPergunta(formData: AvaliacaoPerguntaFormData): Promise<AvaliacaoPergunta> {
    const { data, error } = await supabase
      .from('avaliacao_perguntas')
      .insert([formData])
      .select('id, encontro_id, ordem, titulo, descricao, tipo, obrigatoria, opcoes, ativa')
      .single();

    if (error) throw error;
    return data as AvaliacaoPergunta;
  },

  async atualizarPergunta(id: string, formData: Partial<AvaliacaoPerguntaFormData>): Promise<AvaliacaoPergunta> {
    const { data, error } = await supabase
      .from('avaliacao_perguntas')
      .update(formData)
      .eq('id', id)
      .select('id, encontro_id, ordem, titulo, descricao, tipo, obrigatoria, opcoes, ativa')
      .single();

    if (error) throw error;
    return data as AvaliacaoPergunta;
  },

  async excluirPergunta(id: string): Promise<void> {
    const { error } = await supabase
      .from('avaliacao_perguntas')
      .update({ ativa: false })
      .eq('id', id);

    if (error) throw error;
  },

  async listarRespostas(encontroId: string, equipeId: string): Promise<AvaliacaoResposta[]> {
    const { data, error } = await supabase
      .from('avaliacao_respostas')
      .select('id, encontro_id, equipe_id, pergunta_id, resposta_texto, resposta_numero, resposta_json, respondido_por')
      .eq('encontro_id', encontroId)
      .eq('equipe_id', equipeId);

    if (error) throw error;
    return (data ?? []) as AvaliacaoResposta[];
  },

  async obterEnvio(encontroId: string, equipeId: string): Promise<AvaliacaoEnvio | null> {
    const { data, error } = await supabase
      .from('avaliacao_envios')
      .select('id, encontro_id, equipe_id, status, enviado_por, enviado_em')
      .eq('encontro_id', encontroId)
      .eq('equipe_id', equipeId)
      .maybeSingle();

    if (error) throw error;
    return data as AvaliacaoEnvio | null;
  },

  async obterEstado(encontroId: string, equipeId: string) {
    const [perguntas, respostas, envio] = await Promise.all([
      this.listarPerguntas(encontroId),
      this.listarRespostas(encontroId, equipeId),
      this.obterEnvio(encontroId, equipeId),
    ]);

    return { perguntas, respostas, envio };
  },

  async listarResumosIA(encontroId: string): Promise<AvaliacaoResumoIA[]> {
    const { data, error } = await supabase
      .from('avaliacao_resumos_ia')
      .select('id, encontro_id, conteudo, provider, model, prompt_version, total_equipes, total_equipes_enviadas, total_respostas, gerado_por, created_at')
      .eq('encontro_id', encontroId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as AvaliacaoResumoIA[];
  },

  async gerarResumoIA(encontroId: string): Promise<GerarResumoIAResponse> {
    const { data, error } = await supabase.functions.invoke('gerar-resumo-avaliacao', {
      body: { encontroId },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data as GerarResumoIAResponse;
  },

  async listarResumoEquipes(encontroId: string): Promise<AvaliacaoEquipeResumo[]> {
    const [perguntas, respostasResult, enviosResult, participacoesResult] = await Promise.all([
      this.listarPerguntas(encontroId),
      supabase
        .from('avaliacao_respostas')
        .select('equipe_id, pergunta_id')
        .eq('encontro_id', encontroId),
      supabase
        .from('avaliacao_envios')
        .select('equipe_id, status, enviado_em')
        .eq('encontro_id', encontroId),
      supabase
        .from('participacoes')
        .select('equipe_id, equipes(id, nome)')
        .eq('encontro_id', encontroId)
        .not('equipe_id', 'is', null),
    ]);

    if (respostasResult.error) throw respostasResult.error;
    if (enviosResult.error) throw enviosResult.error;
    if (participacoesResult.error) throw participacoesResult.error;

    const equipesMap = new Map<string, string>();
    for (const participacao of participacoesResult.data ?? []) {
      const equipe = Array.isArray(participacao.equipes) ? participacao.equipes[0] : participacao.equipes;
      if (participacao.equipe_id && equipe?.nome) {
        equipesMap.set(participacao.equipe_id, equipe.nome);
      }
    }

    const respostasPorEquipe = new Map<string, Set<string>>();
    for (const resposta of respostasResult.data ?? []) {
      if (!resposta.equipe_id || !resposta.pergunta_id) continue;
      if (!respostasPorEquipe.has(resposta.equipe_id)) {
        respostasPorEquipe.set(resposta.equipe_id, new Set());
      }
      respostasPorEquipe.get(resposta.equipe_id)!.add(resposta.pergunta_id);
    }

    const enviosMap = new Map<string, { status: AvaliacaoEnvioStatus; enviado_em: string | null }>();
    for (const envio of enviosResult.data ?? []) {
      if (!envio.equipe_id) continue;
      enviosMap.set(envio.equipe_id, {
        status: envio.status as AvaliacaoEnvioStatus,
        enviado_em: envio.enviado_em,
      });
    }

    return Array.from(equipesMap.entries())
      .map(([equipeId, equipeNome]) => {
        const envio = enviosMap.get(equipeId);
        const status: AvaliacaoEquipeResumo['status'] = envio?.status ?? 'pendente';
        return {
          equipe_id: equipeId,
          equipe_nome: equipeNome,
          status,
          enviado_em: envio?.enviado_em ?? null,
          total_respostas: respostasPorEquipe.get(equipeId)?.size ?? 0,
          total_perguntas: perguntas.length,
        };
      })
      .sort((a, b) => a.equipe_nome.localeCompare(b.equipe_nome));
  },

  async salvarResposta(input: AvaliacaoRespostaInput): Promise<void> {
    const payload = this.criarPayloadResposta(input);

    const { error } = await supabase
      .from('avaliacao_respostas')
      .upsert(payload, { onConflict: 'equipe_id,pergunta_id' });

    if (error) throw error;
  },

  async salvarRascunho(encontroId: string, equipeId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('avaliacao_envios')
      .upsert({
        encontro_id: encontroId,
        equipe_id: equipeId,
        status: 'rascunho',
        enviado_por: userId,
        enviado_em: null,
      }, { onConflict: 'encontro_id,equipe_id' });

    if (error) throw error;
  },

  async enviar(encontroId: string, equipeId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('avaliacao_envios')
      .upsert({
        encontro_id: encontroId,
        equipe_id: equipeId,
        status: 'enviado',
        enviado_por: userId,
        enviado_em: new Date().toISOString(),
      }, { onConflict: 'encontro_id,equipe_id' });

    if (error) throw error;
  },

  criarPayloadResposta({ encontroId, equipeId, pergunta, valor, userId }: AvaliacaoRespostaInput) {
    const cleanValue = valor.trim();

    if (pergunta.tipo === 'nota') {
      return {
        encontro_id: encontroId,
        equipe_id: equipeId,
        pergunta_id: pergunta.id,
        resposta_texto: null,
        resposta_numero: cleanValue ? Number(cleanValue) : null,
        resposta_json: null,
        respondido_por: userId,
      };
    }

    if (pergunta.tipo === 'nota_justificativa') {
      let parsed: { nota?: number | string; justificativa?: string } = {};
      try {
        parsed = cleanValue ? JSON.parse(cleanValue) : {};
      } catch {
        parsed = {};
      }

      const nota = parsed.nota !== undefined && parsed.nota !== '' ? Number(parsed.nota) : null;
      const justificativa = parsed.justificativa?.trim() || '';

      return {
        encontro_id: encontroId,
        equipe_id: equipeId,
        pergunta_id: pergunta.id,
        resposta_texto: justificativa || null,
        resposta_numero: nota,
        resposta_json: nota !== null || justificativa ? { nota, justificativa } : null,
        respondido_por: userId,
      };
    }

    if (pergunta.tipo === 'participante_destaque') {
      let parsed: { participacao_ids?: string[]; participantes_nomes?: string[]; justificativa?: string } = {};
      try {
        parsed = cleanValue ? JSON.parse(cleanValue) : {};
      } catch {
        parsed = {};
      }

      const participacaoIds = Array.isArray(parsed.participacao_ids) ? parsed.participacao_ids.filter(Boolean) : [];
      const participantesNomes = Array.isArray(parsed.participantes_nomes) ? parsed.participantes_nomes.filter(Boolean) : [];
      const justificativa = parsed.justificativa?.trim() || '';

      return {
        encontro_id: encontroId,
        equipe_id: equipeId,
        pergunta_id: pergunta.id,
        resposta_texto: justificativa || null,
        resposta_numero: null,
        resposta_json: participacaoIds.length > 0 || justificativa ? { participacao_ids: participacaoIds, participantes_nomes: participantesNomes, justificativa } : null,
        respondido_por: userId,
      };
    }

    if (pergunta.tipo === 'sim_nao') {
      return {
        encontro_id: encontroId,
        equipe_id: equipeId,
        pergunta_id: pergunta.id,
        resposta_texto: cleanValue || null,
        resposta_numero: null,
        resposta_json: cleanValue ? { valor: cleanValue } : null,
        respondido_por: userId,
      };
    }

    return {
      encontro_id: encontroId,
      equipe_id: equipeId,
      pergunta_id: pergunta.id,
      resposta_texto: cleanValue || null,
      resposta_numero: null,
      resposta_json: null,
      respondido_por: userId,
    };
  },

  respostaParaValor(resposta?: AvaliacaoResposta): string {
    if (!resposta) return '';
    if (resposta.resposta_json && typeof resposta.resposta_json === 'object' && 'nota' in resposta.resposta_json) {
      return JSON.stringify(resposta.resposta_json);
    }
    if (resposta.resposta_json && typeof resposta.resposta_json === 'object' && 'participacao_ids' in resposta.resposta_json) {
      return JSON.stringify(resposta.resposta_json);
    }
    if (resposta.resposta_numero !== null && resposta.resposta_numero !== undefined) {
      return String(resposta.resposta_numero);
    }
    return resposta.resposta_texto ?? '';
  },
};
