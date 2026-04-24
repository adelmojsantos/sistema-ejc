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
