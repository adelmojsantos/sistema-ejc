import { createClient } from '@supabase/supabase-js';

const LIMITE_RESUMOS_POR_ENCONTRO = 5;
const PROMPT_VERSION = 'pesquisa-satisfacao-v1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function stripHtml(value: unknown) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getJsonObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function formatResposta(pergunta: { tipo: string }, resposta: {
  resposta_texto: string | null;
  resposta_numero: number | null;
  resposta_json: unknown | null;
}) {
  const json = getJsonObject(resposta.resposta_json);

  if (pergunta.tipo === 'nota') {
    return resposta.resposta_numero !== null && resposta.resposta_numero !== undefined
      ? `Nota: ${resposta.resposta_numero}`
      : '';
  }

  if (pergunta.tipo === 'nota_justificativa') {
    const nota = json?.nota ?? resposta.resposta_numero;
    const justificativa = stripHtml(typeof json?.justificativa === 'string' ? json.justificativa : resposta.resposta_texto);
    return [`Nota: ${nota || '-'}`, justificativa ? `Justificativa: ${justificativa}` : ''].filter(Boolean).join(' | ');
  }

  if (pergunta.tipo === 'participante_destaque') {
    const nomes = Array.isArray(json?.participantes_nomes)
      ? json.participantes_nomes.filter((nome): nome is string => typeof nome === 'string' && !!nome.trim())
      : [];
    const justificativa = stripHtml(typeof json?.justificativa === 'string' ? json.justificativa : resposta.resposta_texto);
    return [
      nomes.length > 0 ? `Destaque(s): ${nomes.join(', ')}` : '',
      justificativa ? `Justificativa: ${justificativa}` : '',
    ].filter(Boolean).join(' | ');
  }

  if (pergunta.tipo === 'sim_nao') {
    const valor = stripHtml(resposta.resposta_texto);
    return valor === 'sim' ? 'Sim' : valor === 'nao' ? 'Não' : valor;
  }

  return stripHtml(resposta.resposta_texto);
}

function getNotaResposta(resposta: { resposta_numero: number | null; resposta_json: unknown | null }) {
  if (resposta.resposta_numero !== null && resposta.resposta_numero !== undefined) {
    return Number(resposta.resposta_numero);
  }

  const json = getJsonObject(resposta.resposta_json);
  const nota = json?.nota;
  if (typeof nota === 'number') return nota;
  if (typeof nota === 'string' && nota.trim()) return Number(nota);
  return null;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function formatAverage(value: number | null) {
  if (value === null) return 'sem média';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
}

function formatPesquisaResposta(tipo: string, value: unknown) {
  const resposta = getJsonObject(value);
  if (!resposta) return '';

  if (tipo === 'nota') {
    return typeof resposta.nota === 'number' ? `Nota: ${resposta.nota}` : '';
  }

  if (tipo === 'sim_nao') {
    return resposta.simNao === 'sim' ? 'Sim' : resposta.simNao === 'nao' ? 'Não' : '';
  }

  if (tipo === 'sim_nao_partes') {
    const opcao = resposta.opcao === 'sim'
      ? 'Sim'
      : resposta.opcao === 'nao'
        ? 'Não'
        : resposta.opcao === 'em_partes'
          ? 'Em partes'
          : '';
    const observacao = stripHtml(resposta.observacao);
    return [opcao, observacao ? `Observação: ${observacao}` : ''].filter(Boolean).join(' | ');
  }

  return stripHtml(resposta.texto);
}

function getPesquisaNota(value: unknown) {
  const resposta = getJsonObject(value);
  return typeof resposta?.nota === 'number' ? resposta.nota : null;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const geminiModel = Deno.env.get('GEMINI_MODEL') || 'gemini-3.1-flash-lite';

    if (!supabaseUrl || !serviceRoleKey || !geminiApiKey) {
      return jsonResponse(500, { error: 'Variáveis de ambiente ausentes para gerar o resumo.' });
    }

    const body = await request.json();
    const encontroId = String(body?.encontroId ?? '').trim();

    if (!encontroId) {
      return jsonResponse(400, { error: 'encontroId é obrigatório.' });
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse(401, { error: 'Sessão não encontrada.' });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const jwt = authHeader.replace('Bearer ', '');
    const { data: authUserData, error: authUserError } = await adminClient.auth.getUser(jwt);

    if (authUserError || !authUserData.user) {
      return jsonResponse(401, { error: 'Sessão inválida.' });
    }

    const requesterId = authUserData.user.id;

    const { data: requesterIsAdmin, error: profileError } = await adminClient
      .rpc('is_admin', { check_user: requesterId });

    if (profileError) {
      return jsonResponse(500, { error: 'Erro ao validar permissão.' });
    }

    if (!requesterIsAdmin) {
      return jsonResponse(403, { error: 'Somente administradores podem gerar resumo com IA.' });
    }

    const { count, error: countError } = await adminClient
      .from('avaliacao_resumos_ia')
      .select('id', { count: 'exact', head: true })
      .eq('encontro_id', encontroId);

    if (countError) {
      return jsonResponse(500, { error: 'Erro ao contar resumos existentes.' });
    }

    const totalResumos = count ?? 0;
    if (totalResumos >= LIMITE_RESUMOS_POR_ENCONTRO) {
      return jsonResponse(403, { error: 'Limite de 5 resumos atingido para este encontro.' });
    }

    const [encontroResult, perguntasResult, enviosResult, participacoesResult] = await Promise.all([
      adminClient
        .from('encontros')
        .select('id, nome')
        .eq('id', encontroId)
        .maybeSingle(),
      adminClient
        .from('pesquisa_satisfacao_perguntas')
        .select('id, ordem, title, type, active')
        .eq('encontro_id', encontroId)
        .eq('active', true)
        .order('ordem', { ascending: true }),
      adminClient
        .from('pesquisa_satisfacao_envios')
        .select('equipe_id, participacao_id, respostas, status')
        .eq('encontro_id', encontroId)
        .eq('status', 'enviado'),
      adminClient
        .from('participacoes')
        .select('id, equipe_id, pessoas(nome_completo), equipes(nome)')
        .eq('encontro_id', encontroId)
        .not('equipe_id', 'is', null),
    ]);

    if (encontroResult.error) throw encontroResult.error;
    if (perguntasResult.error) throw perguntasResult.error;
    if (enviosResult.error) throw enviosResult.error;
    if (participacoesResult.error) throw participacoesResult.error;

    const encontro = encontroResult.data;
    if (!encontro) {
      return jsonResponse(404, { error: 'Encontro não encontrado.' });
    }

    const perguntas = perguntasResult.data ?? [];
    const envios = enviosResult.data ?? [];

    if (perguntas.length === 0 || envios.length === 0) {
      return jsonResponse(400, { error: 'Não há perguntas ou respostas suficientes para gerar resumo.' });
    }

    const participacoesMap = new Map<string, { nome: string; equipeNome: string }>();
    const equipesMap = new Map<string, string>();
    for (const participacao of participacoesResult.data ?? []) {
      const equipe = Array.isArray(participacao.equipes) ? participacao.equipes[0] : participacao.equipes;
      const pessoa = Array.isArray(participacao.pessoas) ? participacao.pessoas[0] : participacao.pessoas;
      if (participacao.equipe_id && equipe?.nome) {
        equipesMap.set(participacao.equipe_id, equipe.nome);
      }
      participacoesMap.set(participacao.id, {
        nome: pessoa?.nome_completo ?? 'Integrante não identificado',
        equipeNome: equipe?.nome ?? 'Equipe não identificada',
      });
    }

    const dadosPorPergunta = perguntas.map((pergunta) => {
      const respostasDaPergunta = envios
        .map((envio) => {
          const respostas = getJsonObject(envio.respostas);
          const value = respostas?.[pergunta.id];
          const texto = formatPesquisaResposta(pergunta.type, value);
          const participacao = participacoesMap.get(envio.participacao_id);
          return texto ? {
            texto,
            nota: getPesquisaNota(value),
            nome: participacao?.nome ?? 'Integrante não identificado',
            equipeNome: participacao?.equipeNome ?? equipesMap.get(envio.equipe_id) ?? 'Equipe não identificada',
          } : null;
        })
        .filter((resposta): resposta is { texto: string; nota: number | null; nome: string; equipeNome: string } => !!resposta);
      const notas = pergunta.type === 'nota'
        ? respostasDaPergunta
            .map((resposta) => resposta.nota)
            .filter((nota): nota is number => nota !== null && Number.isFinite(nota))
        : [];
      const media = average(notas);
      const linhas = respostasDaPergunta
        .map((resposta) => {
          return `- ${resposta.nome} · ${resposta.equipeNome}: ${resposta.texto}`;
        })
        .filter(Boolean);

      return [
        `Pergunta #${pergunta.ordem}: ${pergunta.title}`,
        `Tipo: ${pergunta.type}`,
        `Total de respostas: ${respostasDaPergunta.length}`,
        pergunta.type === 'nota'
          ? `Média das notas: ${formatAverage(media)}`
          : null,
        `Respostas por integrante e equipe:`,
        linhas.length > 0 ? linhas.join('\n') : '- Sem respostas',
      ].filter(Boolean).join('\n');
    });

    const totalEquipes = equipesMap.size;
    const totalEquipesEnviadas = new Set(envios.map((envio) => envio.equipe_id)).size;

    const prompt = [
      'Você é um assistente de análise de pesquisas de satisfação de um encontro religioso/comunitário.',
      'Gere um resumo geral em português do Brasil, objetivo e útil para dirigentes.',
      'Não invente informações. Use apenas o conteúdo fornecido.',
      'Agrupe termos e ideias semelhantes, como comunicação, organização, espiritualidade, alimentação, estrutura, horários e trabalho em equipe.',
      'Inclua um resumo por pergunta. Para perguntas de nota, mostre a média informada nos dados e interprete brevemente o que ela sugere.',
      'Considere diferenças entre equipes quando houver padrões relevantes, sem expor nomes individuais no texto final.',
      '',
      'Formato obrigatório:',
      '# Resumo executivo',
      '# Resumo por pergunta',
      'Use subtítulos no formato "## Pergunta N - título".',
      'Para perguntas de nota, comece com uma linha exatamente no formato Markdown: "> **Média: X**".',
      '# Temas recorrentes',
      '# Pontos fortes',
      '# Pontos de atenção',
      '# Sugestões práticas para o próximo encontro',
      '',
      `Encontro: ${encontro.nome}`,
      `Equipes vinculadas: ${totalEquipes}`,
      `Equipes com respostas enviadas: ${totalEquipesEnviadas}`,
      `Integrantes com respostas enviadas: ${envios.length}`,
      '',
      `Dados por pergunta:\n${dadosPorPergunta.join('\n\n---\n\n')}`,
    ].join('\n');

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2500,
          },
        }),
      },
    );

    if (!geminiResponse.ok) {
      const details = await geminiResponse.text();
      console.error('[gerar-resumo-avaliacao] Gemini error:', details);
      return jsonResponse(502, { error: 'Erro ao chamar Gemini para gerar resumo.' });
    }

    const geminiData = await geminiResponse.json();
    const conteudo = geminiData?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text)
      .filter(Boolean)
      .join('\n')
      .trim();

    if (!conteudo) {
      return jsonResponse(502, { error: 'Gemini não retornou conteúdo para o resumo.' });
    }

    const { data: resumo, error: insertError } = await adminClient
      .from('avaliacao_resumos_ia')
      .insert({
        encontro_id: encontroId,
        conteudo,
        provider: 'gemini',
        model: geminiModel,
        prompt_version: PROMPT_VERSION,
        total_equipes: totalEquipes,
        total_equipes_enviadas: totalEquipesEnviadas,
        total_respostas: envios.length,
        gerado_por: requesterId,
      })
      .select('id, encontro_id, conteudo, provider, model, prompt_version, total_equipes, total_equipes_enviadas, total_respostas, gerado_por, created_at')
      .single();

    if (insertError) {
      return jsonResponse(500, { error: 'Resumo gerado, mas não foi possível salvar no banco.' });
    }

    return jsonResponse(200, {
      resumo,
      totalResumos: totalResumos + 1,
      limite: LIMITE_RESUMOS_POR_ENCONTRO,
    });
  } catch (error) {
    console.error('[gerar-resumo-avaliacao] Unexpected error:', error);
    return jsonResponse(500, { error: 'Erro inesperado ao gerar resumo.' });
  }
});
