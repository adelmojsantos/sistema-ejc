import { describe, expect, it } from 'vitest';
import { isEncontroHistorico } from './encontroHistorico';

const now = new Date('2026-11-19T12:00:00');

describe('isEncontroHistorico', () => {
    it('considera histórico o encontro inativo com data de fim no passado', () => {
        expect(isEncontroHistorico({ ativo: false, data_fim: '2026-08-02' }, now)).toBe(true);
    });

    it('não considera histórico o encontro ativo, mesmo com data de fim no passado', () => {
        expect(isEncontroHistorico({ ativo: true, data_fim: '2026-08-02' }, now)).toBe(false);
    });

    it('não considera histórico o encontro que termina hoje ou no futuro', () => {
        expect(isEncontroHistorico({ ativo: false, data_fim: '2026-11-19' }, now)).toBe(false);
        expect(isEncontroHistorico({ ativo: false, data_fim: '2027-01-31' }, now)).toBe(false);
    });

    it('não considera histórico um encontro novo ou sem data de fim', () => {
        expect(isEncontroHistorico(undefined, now)).toBe(false);
        expect(isEncontroHistorico({ ativo: false, data_fim: '' }, now)).toBe(false);
    });
});
