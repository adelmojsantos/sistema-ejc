import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
    registerPasskey: vi.fn(),
    update: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
    supabase: {
        auth: {
            registerPasskey: authMocks.registerPasskey,
            passkey: { update: authMocks.update },
        },
    },
}));

import {
    consumePasskeyOfferPending,
    defaultPasskeyName,
    getPasskeyDeviceState,
    isPasskeyCeremonyInterrupted,
    markPasskeyOfferPending,
    passkeyErrorMessage,
    passkeyService,
    setPasskeyDeviceState,
} from './passkeyService';

describe('passkeyService', () => {
    beforeEach(() => {
        authMocks.registerPasskey.mockReset();
        authMocks.update.mockReset();
        localStorage.clear();
        sessionStorage.clear();
    });

    it('trata cancelamento da biometria como interrupção neutra', () => {
        const cause = Object.assign(new Error('The operation either timed out or was not allowed.'), {
            name: 'NotAllowedError',
        });
        const error = { name: 'WebAuthnError', code: 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY', cause };

        expect(isPasskeyCeremonyInterrupted(error)).toBe(true);
        expect(isPasskeyCeremonyInterrupted({ code: 'ERROR_CEREMONY_ABORTED' })).toBe(true);
        expect(isPasskeyCeremonyInterrupted(new Error('falha'))).toBe(false);
        expect(passkeyErrorMessage(error, 'fallback')).toContain('não foi concluída');
    });

    it('explica aparelho já cadastrado e domínio não autorizado em português', () => {
        expect(passkeyErrorMessage({ code: 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED' }, 'fallback'))
            .toBe('Este aparelho já tem uma chave de acesso na sua conta.');
        expect(passkeyErrorMessage({ code: 'ERROR_INVALID_RP_ID' }, 'fallback'))
            .toBe('A chave de acesso não está disponível neste endereço do sistema.');
        expect(passkeyErrorMessage({ message: 'internal server error' }, 'fallback')).toBe('fallback');
    });

    it('sugere nome do aparelho a partir do navegador', () => {
        expect(defaultPasskeyName('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe('iPhone');
        expect(defaultPasskeyName('Mozilla/5.0 (Linux; Android 15; Pixel 9)')).toBe('Celular Android');
        expect(defaultPasskeyName('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('Computador Windows');
    });

    it('cadastra a digital e aplica o nome do aparelho', async () => {
        authMocks.registerPasskey.mockResolvedValue({
            data: { id: 'pk-1', created_at: '2026-11-18T12:00:00Z' },
            error: null,
        });
        authMocks.update.mockResolvedValue({
            data: { id: 'pk-1', friendly_name: 'iPhone', created_at: '2026-11-18T12:00:00Z' },
            error: null,
        });

        await expect(passkeyService.register('iPhone')).resolves.toMatchObject({ friendly_name: 'iPhone' });
        expect(authMocks.update).toHaveBeenCalledWith({ passkeyId: 'pk-1', friendlyName: 'iPhone' });
    });

    it('mantém o cadastro mesmo se a renomeação falhar', async () => {
        authMocks.registerPasskey.mockResolvedValue({
            data: { id: 'pk-1', created_at: '2026-11-18T12:00:00Z' },
            error: null,
        });
        authMocks.update.mockResolvedValue({ data: null, error: new Error('falha') });

        await expect(passkeyService.register('iPhone')).resolves.toMatchObject({ id: 'pk-1' });
    });

    it('propaga erro do cadastro', async () => {
        const error = { code: 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED' };
        authMocks.registerPasskey.mockResolvedValue({ data: null, error });

        await expect(passkeyService.register('iPhone')).rejects.toBe(error);
        expect(authMocks.update).not.toHaveBeenCalled();
    });

    it('controla convite pendente e estado do aparelho por usuário', () => {
        markPasskeyOfferPending();
        expect(consumePasskeyOfferPending()).toBe(true);
        expect(consumePasskeyOfferPending()).toBe(false);

        expect(getPasskeyDeviceState('user-1')).toBeNull();
        setPasskeyDeviceState('user-1', 'dismissed');
        expect(getPasskeyDeviceState('user-1')).toBe('dismissed');
        expect(getPasskeyDeviceState('user-2')).toBeNull();
    });
});
