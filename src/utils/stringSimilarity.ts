/**
 * Utilitários para busca aproximada de strings (Fuzzy Match) e similaridade de textos.
 */

/**
 * Calcula a similaridade entre duas strings usando o Coeficiente de Sørensen-Dice.
 * Retorna um valor entre 0 (totalmente diferente) e 1 (idêntico).
 */
export function getStringSimilarity(str1: string, str2: string): number {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);

  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return 0.0;

  const bigrams1 = getBigrams(s1);
  const bigrams2 = getBigrams(s2);

  let intersection = 0;
  const matches = new Set<string>();

  for (const b1 of bigrams1) {
    for (let i = 0; i < bigrams2.length; i++) {
      const b2 = bigrams2[i];
      if (b1 === b2 && !matches.has(`${b1}-${i}`)) {
        intersection++;
        matches.add(`${b1}-${i}`);
        break;
      }
    }
  }

  return (2.0 * intersection) / (bigrams1.length + bigrams2.length);
}

/**
 * Remove acentuação, caracteres especiais e converte a string para caixa baixa.
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9\s]/g, '') // remove símbolos
    .replace(/\s+/g, ' ') // normaliza espaços
    .trim();
}

/**
 * Quebra uma string em uma lista de bigramas (pares de caracteres adjacentes).
 */
function getBigrams(str: string): string[] {
  const bigrams: string[] = [];
  for (let i = 0; i < str.length - 1; i++) {
    bigrams.push(str.substring(i, i + 2));
  }
  return bigrams;
}

/**
 * Dicionário de sinônimos/correspondências manuais comuns do movimento EJC.
 * Se o termo lido pela IA (normalizado) contiver a chave, mapeamos para um termo padrão a fim de melhorar a similaridade.
 */
const ejcSynonyms: Record<string, string> = {
  canto: 'musica',
  musica: 'canto',
  recreacao: 'recreacao infantil',
  kids: 'recreacao infantil',
  som: 'som e iluminacao',
  iluminacao: 'som e iluminacao',
  mercado: 'mini mercado',
  ligacao: 'ligacoes',
};

/**
 * Busca a equipe mais aproximada a partir de uma lista de opções do banco de dados.
 * 
 * @param targetName O nome da equipe lido pela IA (ex: "canto", "som e iluminação")
 * @param options A lista de equipes vindas do banco de dados contendo { id: string, nome: string }
 * @param threshold Limiar mínimo de similaridade para aceitar o mapeamento (padrão: 0.35)
 * @returns O ID da equipe correspondente no banco de dados, ou null se não houver boa correspondência.
 */
export function findBestTeamMatch(
  targetName: string,
  options: { id: string; nome: string | null }[],
  threshold = 0.35
): string | null {
  if (!targetName || options.length === 0) return null;

  const targetNorm = normalizeString(targetName);

  // 1. Tenta correspondência exata ou parcial direta (ex: se o nome de um contém o do outro)
  for (const option of options) {
    if (!option.nome) continue;
    const optionNorm = normalizeString(option.nome);

    if (optionNorm === targetNorm) return option.id;
    if (optionNorm.includes(targetNorm) && targetNorm.length > 3) return option.id;
    if (targetNorm.includes(optionNorm) && optionNorm.length > 3) return option.id;
  }

  // 2. Aplica dicionário de sinônimos conhecidos do EJC
  let searchName = targetNorm;
  for (const synonymKey in ejcSynonyms) {
    if (targetNorm.includes(synonymKey)) {
      searchName = ejcSynonyms[synonymKey];
      break;
    }
  }

  // 3. Executa o algoritmo de similaridade Sørensen-Dice
  let bestScore = 0;
  let bestMatchId: string | null = null;

  for (const option of options) {
    if (!option.nome) continue;
    const optionNorm = normalizeString(option.nome);

    // Mede similaridade com o termo original e com o sinônimo
    const score1 = getStringSimilarity(targetNorm, optionNorm);
    const score2 = getStringSimilarity(searchName, optionNorm);
    const score = Math.max(score1, score2);

    if (score > bestScore) {
      bestScore = score;
      bestMatchId = option.id;
    }
  }

  // Só aceita se atingir o limiar de confiança
  return bestScore >= threshold ? bestMatchId : null;
}
