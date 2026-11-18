import { beforeEach, describe, expect, it } from 'vitest';
import {
    SESSION_IDLE_TIMEOUT_MS,
    SESSION_MAX_AGE_MS,
    checkSessionPolicy,
    clearSessionPolicyRecord,
    clearSessionExpiredReason,
    readSessionExpiredReason,
    evaluateSessionPolicy,
    getSessionKey,
    readSessionPolicyRecord,
    registerSessionActivity,
    storeSessionExpiredReason,
} from './sessionPolicy';

const HOUR = 60 * 60 * 1000;
const START = Date.UTC(2026, 10, 18, 12, 0, 0);

function fakeJwt(payload: Record<string, unknown>): string {
    const encode = (value: object) => btoa(JSON.stringify(value))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    return `${encode({ alg: 'HS256' })}.${encode(payload)}.assinatura`;
}

describe('sessionPolicy', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    it('usa os limites aprovados: 12 horas de inatividade e 7 dias de sessão', () => {
        expect(SESSION_IDLE_TIMEOUT_MS).toBe(12 * HOUR);
        expect(SESSION_MAX_AGE_MS).toBe(7 * 24 * HOUR);
    });

    it('identifica a sessão pelo session_id do JWT, com fallback para o usuário', () => {
        expect(getSessionKey({
            access_token: fakeJwt({ session_id: 'abc-123' }),
            user: { id: 'user-1' },
        })).toBe('session:abc-123');
        expect(getSessionKey({ access_token: 'token-invalido', user: { id: 'user-1' } })).toBe('user:user-1');
        expect(getSessionKey(null)).toBeNull();
    });

    it('expira por inatividade e por tempo máximo', () => {
        const record = { sessionKey: 's', signedInAt: START, lastActivityAt: START };

        expect(evaluateSessionPolicy(record, START + 12 * HOUR)).toBeNull();
        expect(evaluateSessionPolicy(record, START + 12 * HOUR + 1)).toBe('idle');
        expect(evaluateSessionPolicy(
            { ...record, lastActivityAt: START + 7 * 24 * HOUR },
            START + 7 * 24 * HOUR + 1
        )).toBe('max_age');
    });

    it('inicia o controle para sessões ainda desconhecidas sem expirá-las', () => {
        expect(checkSessionPolicy('session:existente', START)).toBeNull();
        expect(readSessionPolicyRecord()).toEqual({
            sessionKey: 'session:existente',
            signedInAt: START,
            lastActivityAt: START,
        });
    });

    it('um novo login substitui o registro da sessão anterior', () => {
        checkSessionPolicy('session:antiga', START);
        expect(checkSessionPolicy('session:nova', START + 30 * 24 * HOUR)).toBeNull();
        expect(readSessionPolicyRecord()?.signedInAt).toBe(START + 30 * 24 * HOUR);
    });

    it('atividade renova a inatividade, mas não o tempo máximo', () => {
        checkSessionPolicy('s', START);

        for (let hour = 6; hour <= 7 * 24; hour += 6) {
            const result = registerSessionActivity('s', START + hour * HOUR);
            expect(result).toBeNull();
        }

        expect(registerSessionActivity('s', START + 7 * 24 * HOUR + 1)).toBe('max_age');
    });

    it('não renova a sessão quando a interação ocorre depois do limite de inatividade', () => {
        checkSessionPolicy('s', START);
        expect(registerSessionActivity('s', START + 13 * HOUR)).toBe('idle');
        expect(readSessionPolicyRecord()?.lastActivityAt).toBe(START);
    });

    it('limpa o registro e o motivo da expiração', () => {
        checkSessionPolicy('s', START);
        clearSessionPolicyRecord();
        expect(readSessionPolicyRecord()).toBeNull();

        storeSessionExpiredReason('idle');
        expect(readSessionExpiredReason()).toBe('idle');
        clearSessionExpiredReason();
        expect(readSessionExpiredReason()).toBeNull();
    });
});
