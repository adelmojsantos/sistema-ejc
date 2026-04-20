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
  const clean = cleanPlate(plate);
  
  if (clean.length !== 7) return clean;

  // Verifica se é o padrão antigo (3 letras e 4 números)
  const isOldStyle = /^[A-Z]{3}[0-9]{4}$/.test(clean);
  
  if (isOldStyle) {
    return `${clean.substring(0, 3)}-${clean.substring(3)}`;
  }

  // Padrão Mercosul ou outros
  return clean;
};
