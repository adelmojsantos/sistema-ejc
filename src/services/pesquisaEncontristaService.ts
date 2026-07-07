import { supabase } from '../lib/supabase';
import type {
  PesquisaSatisfacaoPerguntaFormData,
  PesquisaSatisfacaoQuestion,
  PesquisaSatisfacaoRespostas,
  PesquisaSatisfacaoStatus,
} from '../types/pesquisaSatisfacao';
import type {
  PesquisaEncontristaConfig,
  PesquisaEncontristaEquipeResumo,
  PesquisaEncontristaEnvio,
  PesquisaEncontristaFluxo,
  PesquisaEncontristaPainel,
  PesquisaEncontristaPerguntaResumo,
  PesquisaEncontristaResumoIA,
} from '../types/pesquisaEncontrista';

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

interface FichaEquipeRow {
  id: string;
  participacao_id: string;
  toca_instrumento: boolean | null;
  instrumentos: string | null;
  tem_carro: boolean | null;
  tem_moto: boolean | null;
  observacoes: string | null;
  participacoes?: {
    pessoas?: { nome_completo?: string | null } | { nome_completo?: string | null }[] | null;
  } | Array<{
    pessoas?: { nome_completo?: string | null } | { nome_completo?: string | null }[] | null;
  }> | null;
  pos_encontro_ficha_equipes?: Array<{
    equipe_id: string;
    ordem_preferencia: number;
    equipes?: { nome?: string | null } | { nome?: string | null }[] | null;
  }> | null;
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

function related<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeRespostas(value: unknown): PesquisaSatisfacaoRespostas {
  return value && typeof value === 'object'
    ? value as PesquisaSatisfacaoRespostas
    : {};
}

function formatOpcao(value: string): string {
  if (value === 'sim') return 'Sim';
  if (value === 'nao') return 'Não';
  if (value === 'em_partes') return 'Em partes';
  return value;
}

function respostaTexto(resposta: PesquisaSatisfacaoRespostas[string] | undefined): string {
  if (!resposta) return '';
  return resposta.texto?.trim() || resposta.observacao?.trim() || '';
}

export const pesquisaEncontristaService = {
  async obterFluxo(token: string): Promise<PesquisaEncontristaFluxo> {
    const { data, error } = await supabase.rpc('get_pesquisa_encontrista_fluxo', {
      p_token: token,
    });
    if (error) throw error;
    const fluxo = data as PesquisaEncontristaFluxo;
    return {
      ...fluxo,
      perguntas: (fluxo.perguntas ?? []).map((item) => mapPergunta(item as unknown as PerguntaRow)),
      respostas: fluxo.respostas ?? {},
    };
  },

  async salvarPublico(
    token: string,
    respostas: PesquisaSatisfacaoRespostas,
    status: 'rascunho' | 'enviado'
  ) {
    const { data, error } = await supabase.rpc('salvar_pesquisa_encontrista_publica', {
      p_token: token,
      p_respostas: respostas,
      p_status: status,
    });
    if (error) throw error;
    return data as {
      status: 'rascunho' | 'enviado';
      respostas: PesquisaSatisfacaoRespostas;
      enviado_em: string | null;
    };
  },

  async obterConfig(encontroId: string): Promise<PesquisaEncontristaConfig> {
    const { data, error } = await supabase
      .from('pesquisa_encontrista_config')
      .select('*')
      .eq('encontro_id', encontroId)
      .maybeSingle();
    if (error) throw error;
    return (data as PesquisaEncontristaConfig | null) ?? {
      encontro_id: encontroId,
      publicada: false,
      publicada_em: null,
    };
  },

  async atualizarPublicacao(encontroId: string, publicada: boolean) {
    const { data, error } = await supabase
      .from('pesquisa_encontrista_config')
      .upsert({
        encontro_id: encontroId,
        publicada,
        publicada_em: publicada ? new Date().toISOString() : null,
      }, { onConflict: 'encontro_id' })
      .select('*')
      .single();
    if (error) throw error;
    return data as PesquisaEncontristaConfig;
  },

  async listarPerguntas(encontroId: string, includeInactive = true) {
    let query = supabase
      .from('pesquisa_encontrista_perguntas')
      .select('*')
      .eq('encontro_id', encontroId)
      .order('ordem');
    if (!includeInactive) query = query.eq('active', true);
    const { data, error } = await query;
    if (error) throw error;
    return ((data ?? []) as PerguntaRow[]).map(mapPergunta);
  },

  async criarPergunta(formData: PesquisaSatisfacaoPerguntaFormData) {
    const { data, error } = await supabase
      .from('pesquisa_encontrista_perguntas')
      .insert(formData)
      .select('*')
      .single();
    if (error) throw error;
    return mapPergunta(data as PerguntaRow);
  },

  async atualizarPergunta(id: string, formData: Partial<PesquisaSatisfacaoPerguntaFormData>) {
    const { data, error } = await supabase
      .from('pesquisa_encontrista_perguntas')
      .update(formData)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return mapPergunta(data as PerguntaRow);
  },

  async excluirPergunta(id: string) {
    const { error } = await supabase
      .from('pesquisa_encontrista_perguntas')
      .update({ active: false })
      .eq('id', id);
    if (error) throw error;
  },

  async listarEnvios(encontroId: string) {
    const { data, error } = await supabase
      .from('pesquisa_encontrista_envios')
      .select('*, participacoes(pessoas(nome_completo))')
      .eq('encontro_id', encontroId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as PesquisaEncontristaEnvio[];
  },

  async listarPainel(encontroId: string): Promise<PesquisaEncontristaPainel> {
    const [perguntas, participacoesResult, enviosResult] = await Promise.all([
      this.listarPerguntas(encontroId, false),
      supabase
        .from('participacoes')
        .select('id, pessoas(nome_completo)')
        .eq('encontro_id', encontroId)
        .eq('participante', true),
      supabase
        .from('pesquisa_encontrista_envios')
        .select('participacao_id, respostas, status, enviado_em')
        .eq('encontro_id', encontroId),
    ]);

    if (participacoesResult.error) throw participacoesResult.error;
    if (enviosResult.error) throw enviosResult.error;

    const enviosMap = new Map(
      (enviosResult.data ?? []).map((envio) => [envio.participacao_id, envio]),
    );

    const respondentes = (participacoesResult.data ?? [])
      .map((participacao) => {
        const pessoa = related(participacao.pessoas);
        const envio = enviosMap.get(participacao.id);
        const status: PesquisaSatisfacaoStatus = (
          envio?.status as PesquisaSatisfacaoStatus | undefined
        ) ?? 'pendente';
        return {
          participacaoId: participacao.id,
          nome: pessoa?.nome_completo?.trim() || 'Encontrista sem nome',
          status,
          respostas: normalizeRespostas(envio?.respostas),
          enviadoEm: envio?.enviado_em ?? null,
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    const enviados = respondentes.filter((item) => item.status === 'enviado');
    const perguntaResumos: PesquisaEncontristaPerguntaResumo[] = perguntas.map((pergunta) => {
      const respostas = enviados
        .map((respondente) => ({
          respondente,
          resposta: respondente.respostas[pergunta.id],
        }))
        .filter((item) => !!item.resposta);

      const resumo: PesquisaEncontristaPerguntaResumo = {
        pergunta,
        totalRespondidas: respostas.length,
      };

      if (
        pergunta.type === 'sim_nao_partes'
        || pergunta.type === 'sim_nao'
        || pergunta.type === 'sim_nao_texto'
      ) {
        const values = pergunta.type === 'sim_nao_partes'
          ? ['sim', 'nao', 'em_partes']
          : ['sim', 'nao'];
        resumo.opcoes = values.map((value) => ({
          label: formatOpcao(value),
          count: respostas.filter(({ resposta }) => (
            pergunta.type === 'sim_nao_partes'
              ? resposta?.opcao === value
              : resposta?.simNao === value
          )).length,
        }));
      }

      if (pergunta.type === 'nota') {
        const notas = respostas
          .map(({ resposta }) => resposta?.nota)
          .filter((nota): nota is number => typeof nota === 'number');
        resumo.media = notas.length
          ? notas.reduce((total, nota) => total + nota, 0) / notas.length
          : undefined;
        resumo.opcoes = Array.from({ length: 10 }, (_, index) => index + 1).map((nota) => ({
          label: String(nota),
          count: notas.filter((value) => value === nota).length,
        }));
      }

      if (
        pergunta.type === 'texto'
        || pergunta.type === 'sim_nao_partes'
        || pergunta.type === 'sim_nao_texto'
      ) {
        resumo.textos = respostas
          .map(({ respondente, resposta }) => ({
            nome: respondente.nome,
            texto: respostaTexto(resposta),
          }))
          .filter((item) => item.texto);
      }

      return resumo;
    });

    return {
      totalParticipantes: respondentes.length,
      totalEnviados: respondentes.filter((item) => item.status === 'enviado').length,
      totalRascunhos: respondentes.filter((item) => item.status === 'rascunho').length,
      totalPendentes: respondentes.filter((item) => item.status === 'pendente').length,
      respondentes,
      perguntaResumos,
    };
  },

  async listarResumoEscolhasEquipes(encontroId: string): Promise<PesquisaEncontristaEquipeResumo[]> {
    const { data, error } = await supabase
      .from('pos_encontro_fichas')
      .select(`
        id,
        participacao_id,
        toca_instrumento,
        instrumentos,
        tem_carro,
        tem_moto,
        observacoes,
        participacoes (
          pessoas (nome_completo)
        ),
        pos_encontro_ficha_equipes (
          equipe_id,
          ordem_preferencia,
          equipes (nome)
        )
      `)
      .eq('encontro_id', encontroId);

    if (error) throw error;

    const resumoMap = new Map<string, PesquisaEncontristaEquipeResumo>();

    ((data ?? []) as unknown as FichaEquipeRow[]).forEach((ficha) => {
      const participacao = related(ficha.participacoes);
      const pessoa = related(participacao?.pessoas ?? null);
      const nome = pessoa?.nome_completo?.trim() || 'Encontrista sem nome';
      const preferencias = (ficha.pos_encontro_ficha_equipes ?? [])
        .map((preferencia) => {
          const equipe = related(preferencia.equipes ?? null);
          return {
            equipeId: preferencia.equipe_id,
            equipeNome: equipe?.nome?.trim() || 'Equipe sem nome',
            ordemPreferencia: preferencia.ordem_preferencia,
          };
        })
        .sort((a, b) => a.ordemPreferencia - b.ordemPreferencia);

      (ficha.pos_encontro_ficha_equipes ?? []).forEach((preferencia) => {
        const equipe = related(preferencia.equipes ?? null);
        const equipeNome = equipe?.nome?.trim() || 'Equipe sem nome';
        const current = resumoMap.get(preferencia.equipe_id) ?? {
          equipeId: preferencia.equipe_id,
          equipeNome,
          total: 0,
          primeiraOpcao: 0,
          segundaOpcao: 0,
          terceiraOpcao: 0,
          escolhas: [],
        };

        current.total += 1;
        if (preferencia.ordem_preferencia === 1) current.primeiraOpcao += 1;
        if (preferencia.ordem_preferencia === 2) current.segundaOpcao += 1;
        if (preferencia.ordem_preferencia === 3) current.terceiraOpcao += 1;
        current.escolhas.push({
          participacaoId: ficha.participacao_id,
          nome,
          ordemPreferencia: preferencia.ordem_preferencia,
          tocaInstrumento: ficha.toca_instrumento ?? false,
          instrumentos: ficha.instrumentos?.trim() || null,
          temCarro: ficha.tem_carro ?? false,
          temMoto: ficha.tem_moto ?? false,
          observacoes: ficha.observacoes?.trim() || null,
          preferencias,
        });
        current.escolhas.sort((a, b) => a.ordemPreferencia - b.ordemPreferencia || a.nome.localeCompare(b.nome, 'pt-BR'));
        resumoMap.set(preferencia.equipe_id, current);
      });
    });

    return Array.from(resumoMap.values())
      .sort((a, b) => b.total - a.total || a.equipeNome.localeCompare(b.equipeNome, 'pt-BR'));
  },

  async listarResumosIA(encontroId: string): Promise<PesquisaEncontristaResumoIA[]> {
    const { data, error } = await supabase
      .from('pesquisa_encontrista_resumos_ia')
      .select('id, encontro_id, conteudo, provider, model, prompt_version, total_encontristas, total_respostas, gerado_por, created_at, status, resultado, erro_mensagem, finalizado_em')
      .eq('encontro_id', encontroId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as PesquisaEncontristaResumoIA[];
  },

  async gerarResumoIA(encontroId: string): Promise<PesquisaEncontristaResumoIA> {
    const { data, error } = await supabase.functions.invoke('gerar-resumo-encontristas', {
      body: { encontroId },
    });

    if (error) {
      const context = (error as { context?: Response }).context;
      let apiMessage = '';
      if (context) {
        try {
          const payload = await context.clone().json() as { error?: string };
          apiMessage = payload.error ?? '';
        } catch {
          // resposta sem JSON
        }
      }
      throw new Error(apiMessage || error.message);
    }
    if (data?.error) throw new Error(data.error);
    return data.report as PesquisaEncontristaResumoIA;
  },
};
