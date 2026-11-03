import { describe, expect, it } from 'vitest';
import { formatDateMask, isoDateToMasked, maskedDateToIso } from './dateUtils';

describe('formatDateMask', () => {
    it('formata enquanto digita', () => {
        expect(formatDateMask('1')).toBe('1');
        expect(formatDateMask('120')).toBe('12/0');
        expect(formatDateMask('12032013')).toBe('12/03/2013');
    });

    it('ignora não-dígitos e limita a 8 dígitos', () => {
        expect(formatDateMask('12/03/2013999')).toBe('12/03/2013');
        expect(formatDateMask('ab')).toBe('');
    });
});

describe('maskedDateToIso', () => {
    it('converte data válida', () => {
        expect(maskedDateToIso('12/03/2013')).toBe('2013-03-12');
    });

    it('retorna vazio para data incompleta, inexistente ou ano antigo', () => {
        expect(maskedDateToIso('12/03/20')).toBe('');
        expect(maskedDateToIso('31/02/2010')).toBe('');
        expect(maskedDateToIso('12/13/2010')).toBe('');
        expect(maskedDateToIso('12/03/1850')).toBe('');
    });

    it('aceita 29/02 em ano bissexto', () => {
        expect(maskedDateToIso('29/02/2004')).toBe('2004-02-29');
        expect(maskedDateToIso('29/02/2003')).toBe('');
    });
});

describe('isoDateToMasked', () => {
    it('converte ISO para máscara', () => {
        expect(isoDateToMasked('2013-03-12')).toBe('12/03/2013');
        expect(isoDateToMasked('')).toBe('');
    });
});
