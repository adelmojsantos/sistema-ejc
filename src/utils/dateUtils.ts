/**
 * Calcula a idade com base em uma data de nascimento.
 * @param birthDate string no formato ISO (YYYY-MM-DD)
 * @returns número representando a idade em anos
 */
export function calculateAge(birthDate: string | null | undefined): number | null {
    if (!birthDate) return null;
    
    const today = new Date();
    const birth = new Date(birthDate);
    
    if (isNaN(birth.getTime())) return null;
    
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    
    return age;
}
