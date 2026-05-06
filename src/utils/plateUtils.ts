/**
 * Limpa a placa para salvar no banco (remove hífens, espaços e deixa em maiúsculo)
 */
export const cleanPlate = (plate: string): string => {
  return plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
};

/**
 * Formata a placa para exibição visual
 * Formatos suportados:
 * - Padrão Cinza: AAA-1234 -> AAA-1234
 * - Mercosul: AAA1A11 -> AAA1A11 (Normalmente não usa hífen)
 */
export const formatPlate = (plate: string): string => {
  if (!plate) return '';
  
  // Limpa tudo e deixa em maiúsculo
  const clean = plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 7);
  
  // Se tiver menos de 3 caracteres, não tem como saber o formato ainda
  if (clean.length <= 3) return clean;

  // Verifica se o início segue o padrão de letras (AAA)
  const letters = clean.substring(0, 3);
  const rest = clean.substring(3);

  // Se for o padrão antigo (3 letras + números), adiciona o hífen
  // O padrão antigo é AAA-1234 (sempre números após as letras)
  // O padrão Mercosul é AAA1A11 (tem uma letra na posição 5)
  
  const isOldStyle = /^[A-Z]{3}[0-9]{1,4}$/.test(clean);
  
  if (isOldStyle) {
    return `${letters}-${rest}`;
  }

  // Se for Mercosul (AAA1A11), não costuma usar hífen, mas se o usuário quiser 
  // que formate conforme digita para o padrão antigo e depois "pule" para Mercosul, 
  // podemos deixar assim.
  
  return clean;
};
