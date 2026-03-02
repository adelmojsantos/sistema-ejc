/**
 * Normaliza uma string removendo acentos e convertendo para minúsculas.
 * Útil para buscas que devem desconsiderar acentuação.
 */
export function normalizeString(str: string): string {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}
