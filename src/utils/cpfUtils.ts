/**
 * Utilitários para CPF — LGPD: valida autenticamente o dígito verificador
 * para evitar cadastrar identificadores inválidos que dificultem associar
 * o titular correto aos seus dados.
 */

/** Remove qualquer caractere não numérico e retorna apenas os 11 dígitos. */
export function cpfDigits(cpf: string): string {
    return cpf.replace(/\D/g, '');
}

/** Formata uma string de dígitos como CPF (ex: "12345678909" → "123.456.789-09"). */
export function formatCpf(value: string | null | undefined): string {
    if (!value) return '';
    const digits = cpfDigits(value).slice(0, 11);
    return digits
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

/**
 * Mascara o CPF para exibição em listagens, preservando apenas os últimos
 * 4 dígitos (ex: "123.456.789-09" → "***.***.789-09").
 * LGPD Art. 46 — segurança e proteção de dado sensível em interfaces.
 */
export function maskCpf(cpf: string | null | undefined): string {
    if (!cpf) return '—';
    const digits = cpfDigits(cpf);
    if (digits.length < 11) return '—';
    return `***.***.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/**
 * Valida o CPF matematicamente (algoritmo dos dígitos verificadores).
 * Rejeita sequências trivialmente inválidas como "111.111.111-11".
 */
export function isValidCpf(cpf: string | null | undefined): boolean {
    if (!cpf) return false;
    const digits = cpfDigits(cpf);

    if (digits.length !== 11) return false;

    // Rejeita sequências com todos os dígitos iguais
    if (/^(\d)\1{10}$/.test(digits)) return false;

    // Validação do 1º dígito verificador
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(digits[9])) return false;

    // Validação do 2º dígito verificador
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(digits[10])) return false;

    return true;
}
