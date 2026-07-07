import { createClient } from '@supabase/supabase-js';

const PROMPT_VERSION = 'pesquisa-encontristas-v1';
const REPORT_VERSION = 1;
const MAX_CHARS = 18_000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function truncate(value: string, max = MAX_CHARS) {
  return value.length > max ? `${value.slice(0, max)}\n\n[conteúdo truncado]` : value;
}

function related<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function respostaTexto(resposta: Record<string, unknown> | undefined) {
  if (!resposta) return '';
  return String(resposta.texto ?? resposta.observacao ?? '').trim();
}

async function callGemini(apiKey: string, model: string, prompt: string) {
  const schema = {
    type: 'object',
    properties: {
      metadata: {
        type: 'object',
        properties: {
          encontroId: { type: 'string' },
          generatedAt: { type: 'string' },
          totalQuestions: { type: 'integer' },
          totalAnswers: { type: 'integer' },
          totalRespondents: { type: 'integer' },
          reportVersion: { type: 'integer' },
          promptVersion: { type: 'string' },
        },
        required: ['encontroId', 'generatedAt', 'totalQuestions', 'totalAnswers', 'totalRespondents', 'reportVersion', 'promptVersion'],
      },
      resumoGeral: {
        type: 'object',
        properties: {
          sintese: { type: 'string' },
          pontosFortes: { type: 'array', items: { type: 'string' } },
          principaisProblemas: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                tema: { type: 'string' },
                resumo: { type: 'string' },
                equipesOrigem: { type: 'array', items: { type: 'object', properties: { nome: { type: 'string' }, ocorrenciasAproximadas: { type: 'integer' } }, required: ['nome', 'ocorrenciasAproximadas'] } },
                ocorrenciasAproximadas: { type: 'integer' },
              },
              required: ['tema', 'resumo', 'equipesOrigem', 'ocorrenciasAproximadas'],
            },
          },
          equipesMaisCitadas: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                equipe: { type: 'string' },
                ocorrenciasAproximadas: { type: 'integer' },
                contexto: { type: 'string' },
              },
              required: ['equipe', 'ocorrenciasAproximadas', 'contexto'],
            },
          },
        },
        required: ['sintese', 'pontosFortes', 'principaisProblemas', 'equipesMaisCitadas'],
      },
      perguntas: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            questionId: { type: 'string' },
            pergunta: { type: 'string' },
            secao: { type: 'string' },
            tipo: { type: 'string' },
            quantidadeRespostas: { type: 'integer' },
            resumo: { type: 'string' },
            pontosPositivos: { type: 'array', items: { type: 'string' } },
            pontosNegativos: { type: 'array', items: { type: 'object', properties: { ponto: { type: 'string' }, descricao: { type: 'string' }, equipesOrigem: { type: 'array', items: { type: 'object', properties: { nome: { type: 'string' }, ocorrenciasAproximadas: { type: 'integer' } }, required: ['nome', 'ocorrenciasAproximadas'] } }, ocorrenciasAproximadas: { type: 'integer' }, recorrencia: { type: 'string' } }, required: ['ponto', 'descricao', 'equipesOrigem', 'ocorrenciasAproximadas', 'recorrencia'] } },
            sugestoesMencionadas: { type: 'array', items: { type: 'string' } },
          },
          required: ['questionId', 'pergunta', 'secao', 'tipo', 'quantidadeRespostas', 'resumo', 'pontosPositivos', 'pontosNegativos', 'sugestoesMencionadas'],
        },
      },
    },
    required: ['metadata', 'resumoGeral', 'perguntas'],
  };

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini retornou ${response.status}: ${await response.text()}`);
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('A IA não retornou conteúdo.');
  return JSON.parse(text);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Método não permitido.' });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const geminiModel = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash-lite';
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !geminiApiKey) {
      return jsonResponse(500, { error: 'Variáveis de ambiente ausentes.' });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData.user) return jsonResponse(401, { error: 'Sessão inválida.' });
    const { data: isAdmin } = await authClient.rpc('is_admin');
    if (!isAdmin) return jsonResponse(403, { error: 'Somente administradores podem gerar relatório com IA.' });

    const { encontroId } = await req.json() as { encontroId?: string };
    if (!encontroId) return jsonResponse(400, { error: 'encontroId é obrigatório.' });

    const { count } = await serviceClient
      .from('pesquisa_encontrista_resumos_ia')
      .select('id', { count: 'exact', head: true })
      .eq('encontro_id', encontroId);
    if ((count ?? 0) >= 5) return jsonResponse(403, { error: 'Limite de 5 relatórios atingido para este encontro.' });

    const [perguntasResult, enviosResult, fichasResult] = await Promise.all([
      serviceClient.from('pesquisa_encontrista_perguntas').select('id, ordem, section_title, title, type').eq('encontro_id', encontroId).eq('active', true).order('ordem'),
      serviceClient.from('pesquisa_encontrista_envios').select('respostas, status').eq('encontro_id', encontroId).eq('status', 'enviado'),
      serviceClient.from('pos_encontro_fichas').select('toca_instrumento, instrumentos, tem_carro, tem_moto, observacoes, pos_encontro_ficha_equipes(ordem_preferencia, equipes(nome))').eq('encontro_id', encontroId),
    ]);
    if (perguntasResult.error) throw perguntasResult.error;
    if (enviosResult.error) throw enviosResult.error;
    if (fichasResult.error) throw fichasResult.error;

    const perguntas = perguntasResult.data ?? [];
    const envios = enviosResult.data ?? [];
    if (!perguntas.length || !envios.length) return jsonResponse(400, { error: 'Não há perguntas ou respostas suficientes.' });

    const perguntaResumo = perguntas.map((pergunta) => {
      const respostas = envios.map((envio) => (envio.respostas as Record<string, Record<string, unknown>>)?.[pergunta.id]).filter(Boolean);
      return {
        pergunta,
        total: respostas.length,
        textos: respostas.map(respostaTexto).filter(Boolean),
        opcoes: respostas.map((resposta) => resposta.opcao ?? resposta.simNao ?? resposta.nota).filter(Boolean),
      };
    });

    const fichas = (fichasResult.data ?? []).map((ficha) => ({
      tocaInstrumento: Boolean(ficha.toca_instrumento),
      instrumentos: ficha.instrumentos,
      temCarro: Boolean(ficha.tem_carro),
      temMoto: Boolean(ficha.tem_moto),
      observacoes: ficha.observacoes,
      preferencias: (ficha.pos_encontro_ficha_equipes ?? []).map((pref) => {
        const equipe = related(pref.equipes);
        return `${pref.ordem_preferencia}ª ${equipe?.nome ?? 'Equipe sem nome'}`;
      }),
    }));

    const prompt = truncate([
      'Gere um relatório estruturado para a secretaria do EJC com base na avaliação dos encontristas.',
      'Não cite nomes de encontristas. Não invente dados. Consolide sugestões e pontos recorrentes.',
      `encontroId: ${encontroId}`,
      `totalRespondentes: ${envios.length}`,
      `promptVersion: ${PROMPT_VERSION}`,
      `reportVersion: ${REPORT_VERSION}`,
      '',
      'Perguntas e respostas consolidadas:',
      JSON.stringify(perguntaResumo),
      '',
      'Dados agregados das fichas pós-encontro:',
      JSON.stringify(fichas),
    ].join('\n'));

    const resultado = await callGemini(geminiApiKey, geminiModel, prompt);
    resultado.metadata = {
      encontroId,
      generatedAt: new Date().toISOString(),
      totalQuestions: perguntas.length,
      totalAnswers: envios.length,
      totalRespondents: envios.length,
      reportVersion: REPORT_VERSION,
      promptVersion: PROMPT_VERSION,
    };

    const { data: report, error: insertError } = await serviceClient
      .from('pesquisa_encontrista_resumos_ia')
      .insert({
        encontro_id: encontroId,
        conteudo: resultado.resumoGeral?.sintese ?? null,
        provider: 'gemini',
        model: geminiModel,
        prompt_version: PROMPT_VERSION,
        total_encontristas: fichas.length,
        total_respostas: envios.length,
        gerado_por: userData.user.id,
        status: 'completed',
        resultado,
        finalizado_em: new Date().toISOString(),
      })
      .select('*')
      .single();
    if (insertError) throw insertError;

    return jsonResponse(200, { report });
  } catch (error) {
    console.error('[gerar-resumo-encontristas]', error);
    return jsonResponse(500, { error: error instanceof Error ? error.message : 'Erro inesperado ao gerar relatório.' });
  }
});
