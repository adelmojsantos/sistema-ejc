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

/**
 * Formata um número de telefone para o padrão (XX) XXXXX-XXXX ou (XX) XXXX-XXXX.
 */
export function formatPhone(phone: string | null | undefined): string {
    if (!phone) return '';
    
    // Remove tudo o que não é número
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.length === 11) {
        return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`;
    }
    
    if (cleaned.length === 10) {
        return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 6)}-${cleaned.substring(6)}`;
    }
    
    return phone; // Retorna o original se não tiver 10 ou 11 dígitos
}
