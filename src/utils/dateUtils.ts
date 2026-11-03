/**
 * Calcula a idade com base em uma data de nascimento em relação a uma data de referência.
 * @param birthDate string no formato ISO (YYYY-MM-DD)
 * @param referenceDate data de referência (default: hoje)
 * @returns número representando a idade em anos
 */
export function calculateAge(birthDate: string | null | undefined, referenceDate: string | Date = new Date()): number | null {
    if (!birthDate) return null;
    
    const ref = typeof referenceDate === 'string' 
        ? new Date(referenceDate.includes('T') ? referenceDate : `${referenceDate}T00:00:00`) 
        : referenceDate;
        
    const birth = new Date(birthDate.includes('T') ? birthDate : `${birthDate}T00:00:00`);
    
    if (isNaN(birth.getTime()) || isNaN(ref.getTime())) return null;
    
    let age = ref.getFullYear() - birth.getFullYear();
    const monthDiff = ref.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < birth.getDate())) {
        age--;
    }
    
    return age;
}

/** Aplica a máscara dd/mm/aaaa a uma digitação livre, mantendo apenas dígitos. */
export function formatDateMask(input: string): string {
    const digits = input.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * Converte dd/mm/aaaa em YYYY-MM-DD.
 * Retorna string vazia se a data estiver incompleta, for inexistente (ex.: 31/02) ou o ano for anterior a 1900.
 */
export function maskedDateToIso(masked: string): string {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(masked);
    if (!match) return '';

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    if (year < 1900) return '';

    const date = new Date(year, month - 1, day);
    const isReal = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
    if (!isReal) return '';

    return `${match[3]}-${match[2]}-${match[1]}`;
}

/** Converte YYYY-MM-DD em dd/mm/aaaa. Retorna string vazia se o formato não for reconhecido. */
export function isoDateToMasked(iso: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}
