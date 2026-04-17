/**
 * Utility functions for currency formatting and manipulation.
 */

/**
 * Formats a number as a currency string in Brazilian Real (BRL).
 * @param value The numeric value to format
 * @returns A formatted string like "R$ 1.250,00"
 */
export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formats a string of digits into a financial currency string (R$ 0,00).
 * Used for real-time masking.
 * Example: "4" -> "0,04", "40" -> "0,40", "4000" -> "40,00"
 */
export function formatFinancial(digits: string): string {
  const value = parseInt(digits || '0', 10) / 100;
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formats digits as BRL with symbol included.
 * Example: "4000" -> "R$ 40,00"
 */
export function formatFinancialWithSymbol(digits: string): string {
  return `R$ ${formatFinancial(digits)}`;
}

/**
 * Extracts only digits from any string.
 */
export function parseToDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Converts a numeric value into a string of digits (cents).
 */
export function toCentString(value: number): string {
  return Math.round(value * 100).toString();
}

/**
 * Parses a string or any value into a float, ensuring it's a valid number.
 */
export function parseCurrency(value: any): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  const cleaned = value.toString()
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
    
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}
