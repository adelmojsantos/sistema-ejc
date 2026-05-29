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

Deno.serve(async (request) => {
  // Trata requisições de pre-flight CORS (OPTIONS)
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const geminiModel = Deno.env.get('GEMINI_MODEL') || 'gemini-1.5-flash';

    if (!geminiApiKey) {
      return jsonResponse(500, { error: 'Chave de API do Gemini não configurada no servidor.' });
    }

    const body = await request.json();
    const imageBase64DataUri = String(body?.image ?? '').trim();

    if (!imageBase64DataUri) {
      return jsonResponse(400, { error: 'A imagem em formato Base64 é obrigatória.' });
    }

    // Processa a imagem em base64 removendo o prefixo do Data URI se presente
    let mimeType = 'image/jpeg';
    let base64Data = imageBase64DataUri;

    const matches = imageBase64DataUri.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      mimeType = matches[1];
      base64Data = matches[2];
    }

    console.log(`[processar-foto-ficha] Processando imagem. Mime: ${mimeType}, Tamanho base64: ${base64Data.length} chars.`);

    const prompt = `
Você é uma inteligência artificial especializada em OCR e leitura inteligente de documentos manuscritos.
Analise a imagem da ficha de pós-encontro do movimento EJC que foi enviada.
Esta ficha possui um layout específico e você deve extrair as seguintes informações escritas à mão ou marcadas:

1. Seção "EQUIPE QUE GOSTARIA DE TRABALHAR (ESCOLHA 3 - Assinale 1, 2 e 3)"
Nesta seção, existem opções de equipes dispostas em colunas. Cada opção tem parênteses à esquerda "( )".
O jovem deve escrever os números "1", "2" e "3" dentro de exatamente três desses parênteses para indicar a sua 1ª, 2ª e 3ª opções de preferência de equipe, respectivamente.
Identifique quais equipes receberam os números "1", "2" e "3" e extraia seus nomes exatos.
As opções disponíveis na ficha são:
- Café
- Canto
- Cozinha
- Ligação
- Liturgia
- Mini Mercado
- Recreação Inf.
- Secretaria
- Som e Iluminação

Você deve retornar um array ordenado na prioridade 1, 2 e 3 (o elemento 0 do array é a preferência 1, o elemento 1 é a preferência 2, o elemento 2 é a preferência 3).
Se a pessoa escreveu "1" em "Cozinha", "2" em "Café" e "3" em "Canto", o array de preferências deve ser ["Cozinha", "Café", "Canto"].
Caso a numeração não esteja clara ou haja menos de 3 selecionadas, retorne as que encontrar na ordem respectiva. Se nenhuma for selecionada, retorne um array vazio [].

2. Seção "Toco Instrumento Musical"
A ficha possui os checkboxes: "Toco Instrumento Musical: ( ) Não  ( ) Sim  Quais?"
- Verifique se a marcação (um X, preenchimento, rasura ou círculo) está no parênteses de "Sim" ou de "Não".
  - Se estiver em "Sim", retorne "toca_instrumento" como true.
  - Se estiver em "Não" ou ambos vazios, retorne "toca_instrumento" como false.
- Extraia o texto escrito no campo "Quais?" (por exemplo: "Violão", "Teclado e Flauta", etc.) e retorne no campo "instrumentos". Se não houver nada escrito ou marcou Não, retorne null.

3. Seção "Tenho"
A ficha possui as opções: "Tenho: ( ) Carro  ( ) Moto"
- Verifique se há alguma marcação (X ou preenchimento) no parênteses de "Carro". Se sim, retorne "tem_carro" como true, caso contrário false.
- Verifique se há alguma marcação (X ou preenchimento) no parênteses de "Moto". Se sim, retorne "tem_moto" como true, caso contrário false.

4. Campo "Observações"
Verifique se existe algum texto manuscrito no campo de observações da ficha.
- Se houver texto, retorne em "observacoes" exatamente o conteúdo legível.
- Se o campo estiver vazio ou ilegível, retorne null.

Você deve responder estritamente com um JSON válido no formato abaixo, sem formatação Markdown adicional (sem blocos de código \`\`\`json).

Formato de Resposta (JSON):
{
  "toca_instrumento": boolean,
  "instrumentos": string | null,
  "tem_carro": boolean,
  "tem_moto": boolean,
  "observacoes": string | null,
  "preferencias": string[]
}
`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1000,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!geminiResponse.ok) {
      const details = await geminiResponse.text();
      console.error('[processar-foto-ficha] Gemini error:', details);
      return jsonResponse(502, { error: 'Falha ao processar imagem via inteligência artificial.' });
    }

    const geminiData = await geminiResponse.json();
    const responseText = geminiData?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text)
      .filter(Boolean)
      .join('\n')
      .trim();

    if (!responseText) {
      return jsonResponse(502, { error: 'A inteligência artificial não retornou dados legíveis.' });
    }

    console.log('[processar-foto-ficha] Resposta recebida da IA:', responseText);

    try {
      const parsedData = JSON.parse(responseText);
      return jsonResponse(200, parsedData);
    } catch (parseError) {
      console.error('[processar-foto-ficha] Erro ao fazer o parser do JSON do Gemini:', responseText, parseError);
      return jsonResponse(502, { error: 'Erro ao converter a resposta da IA em dados estruturados.' });
    }
  } catch (error) {
    console.error('[processar-foto-ficha] Erro inesperado:', error);
    return jsonResponse(500, { error: 'Erro interno ao processar a ficha.' });
  }
});
