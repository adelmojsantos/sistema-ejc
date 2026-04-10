import type { Pessoa } from '../types/pessoa';

function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return matrix[b.length][a.length];
}

export function findSimilarPeoples(searchName: string, pessoasList: Pessoa[], searchPhone?: string): Pessoa[] {
  const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const target = normalize(searchName);
  const targetWords = target.split(/\s+/).filter(w => w.length > 2); // ignore small words like "de", "da"

  // 1. First attempt exact match (but we will skip exact if phone clearly diverges, 
  // actually let's just let the scoring handle it, so we'll only exact match if phone doesn't conflict)
  // To keep it simple, we just score everything.
  
  // 2. Partial word match scoring
  const results = pessoasList.map(p => {
    if (!p.nome_completo) return { pessoa: p, score: 0 };
    
    let phoneBonus = 0;
    let phonePenalty = 0;
    if (searchPhone && p.telefone) {
      const cSearch = searchPhone.replace(/\D/g, '');
      const cDb = p.telefone.replace(/\D/g, '');
      if (cSearch.length >= 8 && cDb.length >= 8) { // Only compare valid-ish phones
        if (cSearch === cDb || cSearch.endsWith(cDb) || cDb.endsWith(cSearch)) {
          phoneBonus += 1.0;
        } else {
          phonePenalty += 0.4; 
        }
      }
    }

    const pName = normalize(p.nome_completo);
    const pWords = pName.split(/\s+/).filter(w => w.length > 2);
    
    let matchScore = 0;
    
    // Penalize heavily if the first name doesn't match and isn't a simple typo
    if (pWords.length > 0 && targetWords.length > 0) {
      if (pWords[0] !== targetWords[0] && levenshtein(pWords[0], targetWords[0]) > 1) {
        matchScore -= Math.max(targetWords.length, pWords.length) * 0.5;
      }
    }
    
    let exactOrPartialMatches = 0;
    const matchedPWords = new Set<string>();

    for (const tw of targetWords) {
      if (pWords.includes(tw)) {
        matchScore += 1;
        matchedPWords.add(tw);
        exactOrPartialMatches++;
      } else {
        // partial word match for typos (e.g. freita vs freitas)
        const partial = pWords.find(pw => 
          !matchedPWords.has(pw) && (
          pw.startsWith(tw) || 
          tw.startsWith(pw) || 
          levenshtein(tw, pw) <= 2)
        );
        if (partial) {
          matchScore += 0.8;
          matchedPWords.add(partial);
          exactOrPartialMatches++;
        }
      }
    }
    
    const unmatchedTargetCount = targetWords.length - exactOrPartialMatches;
    const unmatchedPCount = pWords.length - matchedPWords.size;

    if (unmatchedTargetCount > 0 && unmatchedPCount > 0) {
      // Direct conflict: e.g. "Fernandes" vs "Sousa"
      matchScore -= 1.0;
    }
    
    matchScore -= phonePenalty;
    matchScore += phoneBonus;

    // Calculate final percentage compared to the longest name format
    const maxWords = Math.max(targetWords.length, pWords.length);
    const percentage = maxWords > 0 ? (matchScore / maxWords) : 0;
    
    return { pessoa: p, score: percentage };
  });

  // Filter those with more than 60% similarity and take the top 5
  return results
    .filter(r => r.score > 0.6)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(r => r.pessoa);
}
