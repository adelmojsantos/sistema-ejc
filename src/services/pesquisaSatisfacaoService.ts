import { supabase } from '../lib/supabase';
import type {
  PesquisaSatisfacaoAcesso,
  PesquisaSatisfacaoEnvio,
  PesquisaSatisfacaoPerguntaFormData,
  PesquisaSatisfacaoPublicInfo,
  PesquisaSatisfacaoQuestion,
  PesquisaSatisfacaoResumoEquipe,
  PesquisaSatisfacaoResposta,
  PesquisaSatisfacaoRespostas,
  PesquisaSatisfacaoStatus,
} from '../types/pesquisaSatisfacao';

interface PerguntaRow {
  id: string;
  encontro_id: string;
  ordem: number;
  section_id: string;
  section_title: string;
  title: string;
  type: PesquisaSatisfacaoQuestion['type'];
  required: boolean;
  active: boolean;
}

export interface PesquisaSatisfacaoRespondente {
  participacaoId: string;
  nome: string;
  equipeId: string;
  equipeNome: string;
  status: PesquisaSatisfacaoStatus;
  respostas: PesquisaSatisfacaoRespostas;
  enviadoEm: string | null;
}

export interface PesquisaSatisfacaoOpcaoResumo {
  label: string;
  count: number;
}

export interface PesquisaSatisfacaoPerguntaResumo {
  pergunta: PesquisaSatisfacaoQuestion;
  totalRespondidas: number;
  media?: number;
  opcoes?: PesquisaSatisfacaoOpcaoResumo[];
  textos?: Array<{
    nome: string;
    equipeNome: string;
    texto: string;
  }>;
}

export interface PesquisaSatisfacaoPainel {
  perguntas: PesquisaSatisfacaoQuestion[];
  respondentes: PesquisaSatisfacaoRespondente[];
  totalParticipantes: number;
  totalEnviados: number;
  totalRascunhos: number;
  totalPendentes: number;
  perguntaResumos: PesquisaSatisfacaoPerguntaResumo[];
}

export interface PesquisaSatisfacaoConfig {
  encontro_id: string;
  publicada: boolean;
  publicada_em: string | null;
}

export interface PesquisaSatisfacaoResumoIA {
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

export interface GerarPesquisaSatisfacaoResumoIAResponse {
  resumo: PesquisaSatisfacaoResumoIA;
  totalResumos: number;
  limite: number;
}

function normalizeRespostas(value: unknown): PesquisaSatisfacaoRespostas {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as PesquisaSatisfacaoRespostas;
}

function mapPergunta(row: PerguntaRow): PesquisaSatisfacaoQuestion {
  return {
    id: row.id,
    encontro_id: row.encontro_id,
    ordem: row.ordem,
    sectionId: row.section_id,
    sectionTitle: row.section_title,
    title: row.title,
    type: row.type,
    required: row.required,
    active: row.active,
  };
}

function respostaTexto(resposta: PesquisaSatisfacaoResposta | undefined) {
  if (!resposta) return '';
  return resposta.texto?.trim() || resposta.observacao?.trim() || '';
}

function formatOpcao(value: string) {
  if (value === 'sim') return 'Sim';
  if (value === 'nao') return 'Não';
  if (value === 'em_partes') return 'Em partes';
  return value;
}

export const pesquisaSatisfacaoService = {
  async obterConfig(encontroId: string): Promise<PesquisaSatisfacaoConfig> {
    const { data, error } = await supabase
      .from('pesquisa_satisfacao_config')
      .select('encontro_id, publicada, publicada_em')
      .eq('encontro_id', encontroId)
      .maybeSingle();

    if (error) throw error;
    return (data as PesquisaSatisfacaoConfig | null) ?? {
      encontro_id: encontroId,
      publicada: false,
      publicada_em: null,
    };
  },

  async atualizarPublicacao(encontroId: string, publicada: boolean): Promise<PesquisaSatisfacaoConfig> {
    const { data, error } = await supabase
      .from('pesquisa_satisfacao_config')
      .upsert({
        encontro_id: encontroId,
        publicada,
        publicada_em: publicada ? new Date().toISOString() : null,
      }, { onConflict: 'encontro_id' })
      .select('encontro_id, publicada, publicada_em')
      .single();

    if (error) throw error;
    return data as PesquisaSatisfacaoConfig;
  },

  async listarResumosIA(encontroId: string): Promise<PesquisaSatisfacaoResumoIA[]> {
    const { data, error } = await supabase
      .from('avaliacao_resumos_ia')
      .select('id, encontro_id, conteudo, provider, model, prompt_version, total_equipes, total_equipes_enviadas, total_respostas, gerado_por, created_at')
      .eq('encontro_id', encontroId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as PesquisaSatisfacaoResumoIA[];
  },

  async gerarResumoIA(encontroId: string): Promise<GerarPesquisaSatisfacaoResumoIAResponse> {
    const { data, error } = await supabase.functions.invoke('gerar-resumo-avaliacao', {
      body: { encontroId },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data as GerarPesquisaSatisfacaoResumoIAResponse;
  },

  async listarPerguntas(encontroId: string, includeInactive = false): Promise<PesquisaSatisfacaoQuestion[]> {
    let query = supabase
      .from('pesquisa_satisfacao_perguntas')
      .select('id, encontro_id, ordem, section_id, section_title, title, type, required, active')
      .eq('encontro_id', encontroId)
      .order('ordem', { ascending: true })
      .order('created_at', { ascending: true });

    if (!includeInactive) {
      query = query.eq('active', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return ((data ?? []) as PerguntaRow[]).map(mapPergunta);
  },

  async criarPergunta(formData: PesquisaSatisfacaoPerguntaFormData): Promise<PesquisaSatisfacaoQuestion> {
    const { data, error } = await supabase
      .from('pesquisa_satisfacao_perguntas')
      .insert([formData])
      .select('id, encontro_id, ordem, section_id, section_title, title, type, required, active')
      .single();

    if (error) throw error;
    return mapPergunta(data as PerguntaRow);
  },

  async atualizarPergunta(id: string, formData: Partial<PesquisaSatisfacaoPerguntaFormData>): Promise<PesquisaSatisfacaoQuestion> {
    const { data, error } = await supabase
      .from('pesquisa_satisfacao_perguntas')
      .update(formData)
      .eq('id', id)
      .select('id, encontro_id, ordem, section_id, section_title, title, type, required, active')
      .single();

    if (error) throw error;
    return mapPergunta(data as PerguntaRow);
  },

  async excluirPergunta(id: string): Promise<void> {
    const { error } = await supabase
      .from('pesquisa_satisfacao_perguntas')
      .update({ active: false })
      .eq('id', id);

    if (error) throw error;
  },

  async obterEnvioPorParticipacao(encontroId: string, participacaoId: string): Promise<PesquisaSatisfacaoEnvio | null> {
    const { data, error } = await supabase
      .from('pesquisa_satisfacao_envios')
      .select('id, encontro_id, equipe_id, participacao_id, respostas, status, enviado_em')
      .eq('encontro_id', encontroId)
      .eq('participacao_id', participacaoId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return { ...data, respostas: normalizeRespostas(data.respostas) } as PesquisaSatisfacaoEnvio;
  },

  async salvarLogado(params: {
    encontroId: string;
    equipeId: string;
    participacaoId: string;
    respostas: PesquisaSatisfacaoRespostas;
    status: 'rascunho' | 'enviado';
  }): Promise<PesquisaSatisfacaoEnvio> {
    const existing = await this.obterEnvioPorParticipacao(params.encontroId, params.participacaoId);
    if (existing?.status === 'enviado') {
      throw new Error('Pesquisa já enviada. Não é possível editar.');
    }

    const { data, error } = await supabase
      .from('pesquisa_satisfacao_envios')
      .upsert({
        encontro_id: params.encontroId,
        equipe_id: params.equipeId,
        participacao_id: params.participacaoId,
        respostas: params.respostas,
        status: params.status,
        enviado_em: params.status === 'enviado' ? new Date().toISOString() : null,
      }, { onConflict: 'encontro_id,participacao_id' })
      .select('id, encontro_id, equipe_id, participacao_id, respostas, status, enviado_em')
      .single();

    if (error) throw error;
    return { ...data, respostas: normalizeRespostas(data.respostas) } as PesquisaSatisfacaoEnvio;
  },

  async listarResumoEquipe(encontroId: string, equipeId: string): Promise<PesquisaSatisfacaoResumoEquipe> {
    const [participacoesResult, enviosResult] = await Promise.all([
      supabase
        .from('participacoes')
        .select('id, pessoas(nome_completo)')
        .eq('encontro_id', encontroId)
        .eq('equipe_id', equipeId),
      supabase
        .from('pesquisa_satisfacao_envios')
        .select('participacao_id, status')
        .eq('encontro_id', encontroId)
        .eq('equipe_id', equipeId),
    ]);

    if (participacoesResult.error) throw participacoesResult.error;
    if (enviosResult.error) throw enviosResult.error;

    const enviosPorParticipacao = new Map(
      (enviosResult.data ?? []).map((item) => [item.participacao_id, item.status as PesquisaSatisfacaoStatus])
    );
    const participacoes = (participacoesResult.data ?? []) as Array<{
      id: string;
      pessoas: { nome_completo: string } | null;
    }>;
    const integrantes = participacoes
      .map((participacao) => ({
        participacaoId: participacao.id,
        nome: participacao.pessoas?.nome_completo ?? 'Integrante sem nome',
        status: enviosPorParticipacao.get(participacao.id) ?? 'pendente',
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    const totalParticipantes = integrantes.length;
    const totalEnviados = enviosResult.data?.filter((item) => item.status === 'enviado').length ?? 0;
    const totalRascunhos = enviosResult.data?.filter((item) => item.status === 'rascunho').length ?? 0;

    return {
      totalParticipantes,
      totalEnviados,
      totalRascunhos,
      totalPendentes: Math.max(totalParticipantes - totalEnviados - totalRascunhos, 0),
      integrantes,
    };
  },

  async listarPainel(encontroId: string, equipeId?: string | null): Promise<PesquisaSatisfacaoPainel> {
    const [perguntas, participacoesResult, enviosResult] = await Promise.all([
      this.listarPerguntas(encontroId, true),
      supabase
        .from('participacoes')
        .select('id, equipe_id, pessoas(nome_completo), equipes(nome)')
        .eq('encontro_id', encontroId)
        .not('equipe_id', 'is', null),
      supabase
        .from('pesquisa_satisfacao_envios')
        .select('participacao_id, equipe_id, respostas, status, enviado_em')
        .eq('encontro_id', encontroId),
    ]);

    if (participacoesResult.error) throw participacoesResult.error;
    if (enviosResult.error) throw enviosResult.error;

    const enviosMap = new Map(
      (enviosResult.data ?? []).map((envio) => [envio.participacao_id, envio])
    );

    const respondentes = ((participacoesResult.data ?? []) as Array<{
      id: string;
      equipe_id: string;
      pessoas: { nome_completo: string } | null;
      equipes: { nome: string } | null;
    }>)
      .map((participacao) => {
        const envio = enviosMap.get(participacao.id);
        return {
          participacaoId: participacao.id,
          nome: participacao.pessoas?.nome_completo ?? 'Integrante sem nome',
          equipeId: participacao.equipe_id,
          equipeNome: participacao.equipes?.nome ?? 'Sem equipe',
          status: (envio?.status as PesquisaSatisfacaoStatus | undefined) ?? 'pendente',
          respostas: normalizeRespostas(envio?.respostas),
          enviadoEm: envio?.enviado_em ?? null,
        };
      })
      .filter((respondente) => !equipeId || respondente.equipeId === equipeId)
      .sort((a, b) => a.equipeNome.localeCompare(b.equipeNome, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR'));

    const enviados = respondentes.filter((item) => item.status === 'enviado');
    const perguntaResumos = perguntas.map((pergunta) => {
      const respostas = enviados
        .map((respondente) => ({ respondente, resposta: respondente.respostas[pergunta.id] }))
        .filter((item) => !!item.resposta);
      const resumo: PesquisaSatisfacaoPerguntaResumo = {
        pergunta,
        totalRespondidas: respostas.length,
      };

      if (pergunta.type === 'sim_nao_partes' || pergunta.type === 'sim_nao') {
        const values = pergunta.type === 'sim_nao_partes' ? ['sim', 'nao', 'em_partes'] : ['sim', 'nao'];
        resumo.opcoes = values.map((value) => ({
          label: formatOpcao(value),
          count: respostas.filter(({ resposta }) => pergunta.type === 'sim_nao_partes' ? resposta?.opcao === value : resposta?.simNao === value).length,
        }));
      }

      if (pergunta.type === 'nota') {
        const notas = respostas
          .map(({ resposta }) => resposta?.nota)
          .filter((nota): nota is number => typeof nota === 'number');
        resumo.media = notas.length > 0 ? notas.reduce((sum, nota) => sum + nota, 0) / notas.length : undefined;
        resumo.opcoes = Array.from({ length: 10 }, (_, index) => index + 1).map((nota) => ({
          label: String(nota),
          count: notas.filter((value) => value === nota).length,
        }));
      }

      if (pergunta.type === 'texto' || pergunta.type === 'sim_nao_partes') {
        resumo.textos = respostas
          .map(({ respondente, resposta }) => ({
            nome: respondente.nome,
            equipeNome: respondente.equipeNome,
            texto: respostaTexto(resposta),
          }))
          .filter((item) => item.texto);
      }

      return resumo;
    });

    return {
      perguntas,
      respondentes,
      totalParticipantes: respondentes.length,
      totalEnviados: respondentes.filter((item) => item.status === 'enviado').length,
      totalRascunhos: respondentes.filter((item) => item.status === 'rascunho').length,
      totalPendentes: respondentes.filter((item) => item.status === 'pendente').length,
      perguntaResumos,
    };
  },

  async obterPublicInfo(encontroId: string, equipeId: string): Promise<PesquisaSatisfacaoPublicInfo> {
    const { data, error } = await supabase.rpc('get_pesquisa_satisfacao_public_info', {
      p_encontro_id: encontroId,
      p_equipe_id: equipeId,
    });

    if (error) throw error;
    return data as PesquisaSatisfacaoPublicInfo;
  },

  async validarAcessoPublico(params: {
    encontroId: string;
    equipeId: string;
    participacaoId: string;
    telefone: string;
  }): Promise<PesquisaSatisfacaoAcesso> {
    const { data, error } = await supabase.rpc('validar_pesquisa_satisfacao_acesso', {
      p_encontro_id: params.encontroId,
      p_equipe_id: params.equipeId,
      p_participacao_id: params.participacaoId,
      p_telefone: params.telefone,
    });

    if (error) throw error;
    return { ...(data as PesquisaSatisfacaoAcesso), respostas: normalizeRespostas((data as PesquisaSatisfacaoAcesso).respostas) };
  },

  async salvarPublico(params: {
    encontroId: string;
    equipeId: string;
    participacaoId: string;
    telefone: string;
    respostas: PesquisaSatisfacaoRespostas;
    status: 'rascunho' | 'enviado';
  }): Promise<PesquisaSatisfacaoEnvio> {
    const { data, error } = await supabase.rpc('salvar_pesquisa_satisfacao_publica', {
      p_encontro_id: params.encontroId,
      p_equipe_id: params.equipeId,
      p_participacao_id: params.participacaoId,
      p_telefone: params.telefone,
      p_respostas: params.respostas,
      p_status: params.status,
    });

    if (error) throw error;
    return { ...(data as PesquisaSatisfacaoEnvio), respostas: normalizeRespostas((data as PesquisaSatisfacaoEnvio).respostas) };
  },
};
