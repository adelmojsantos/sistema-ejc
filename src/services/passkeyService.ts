import { supabase } from '../lib/supabase';
import { userFacingError } from '../utils/userFacingError';

/**
 * Entrada com chave de acesso (passkeys do Supabase Auth, em beta), confirmada
 * pela digital, rosto ou PIN do aparelho.
 *
 * A funcionalidade só aparece quando `VITE_ENABLE_PASSKEY_LOGIN=true`, permitindo
 * publicar o frontend antes de habilitar passkeys no painel do Supabase.
 */
export const PASSKEY_LOGIN_ENABLED = import.meta.env.VITE_ENABLE_PASSKEY_LOGIN === 'true';

const OFFER_PENDING_KEY = 'ejc-passkey-offer-pending';
const getDeviceStateKey = (userId: string) => `ejc-passkey-device:v1:${userId}`;

export type PasskeyDeviceState = 'enrolled' | 'dismissed';

export interface PasskeyItem {
    id: string;
    friendly_name?: string;
    created_at: string;
    last_used_at?: string;
}

export function browserSupportsPasskeys(): boolean {
    return typeof window !== 'undefined'
        && typeof window.PublicKeyCredential === 'function'
        && typeof navigator !== 'undefined'
        && !!navigator.credentials;
}

export function isPasskeyLoginAvailable(): boolean {
    return PASSKEY_LOGIN_ENABLED && browserSupportsPasskeys();
}

/** Indica se o aparelho possui biometria ou bloqueio de tela utilizável. */
export async function hasPlatformAuthenticator(): Promise<boolean> {
    if (!browserSupportsPasskeys()) return false;

    try {
        return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
        return false;
    }
}

interface ErrorWithCause {
    name?: unknown;
    code?: unknown;
    cause?: unknown;
}

function errorName(value: unknown): string {
    return value && typeof value === 'object' && typeof (value as ErrorWithCause).name === 'string'
        ? (value as ErrorWithCause).name as string
        : '';
}

function errorCode(value: unknown): string {
    return value && typeof value === 'object' && typeof (value as ErrorWithCause).code === 'string'
        ? (value as ErrorWithCause).code as string
        : '';
}

/**
 * O navegador usa NotAllowedError tanto para cancelamento quanto para ausência
 * de chave cadastrada no aparelho; ambos são tratados como interrupção neutra.
 */
export function isPasskeyCeremonyInterrupted(error: unknown): boolean {
    const cause = error && typeof error === 'object' ? (error as ErrorWithCause).cause : undefined;
    const names = [errorName(error), errorName(cause)];
    return names.includes('NotAllowedError')
        || names.includes('AbortError')
        || errorCode(error) === 'ERROR_CEREMONY_ABORTED';
}

export function passkeyErrorMessage(error: unknown, fallback: string): string {
    if (isPasskeyCeremonyInterrupted(error)) {
        return 'A confirmação não foi concluída. Se ainda não criou uma chave de acesso neste aparelho, entre com e-mail e senha.';
    }

    const code = errorCode(error);
    if (code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED') {
        return 'Este aparelho já tem uma chave de acesso na sua conta.';
    }

    if (code === 'ERROR_INVALID_DOMAIN' || code === 'ERROR_INVALID_RP_ID') {
        return 'A chave de acesso não está disponível neste endereço do sistema.';
    }

    return userFacingError(error, fallback);
}

export function defaultPasskeyName(userAgent: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): string {
    if (/iPhone/i.test(userAgent)) return 'iPhone';
    if (/iPad/i.test(userAgent)) return 'iPad';
    if (/Android/i.test(userAgent)) return 'Celular Android';
    if (/Macintosh|Mac OS X/i.test(userAgent)) return 'Mac';
    if (/Windows/i.test(userAgent)) return 'Computador Windows';
    if (/Linux/i.test(userAgent)) return 'Computador Linux';
    return 'Aparelho';
}

export function markPasskeyOfferPending() {
    try {
        sessionStorage.setItem(OFFER_PENDING_KEY, 'true');
    } catch {
        // Convite é opcional; falha de armazenamento apenas impede a sugestão.
    }
}

export function consumePasskeyOfferPending(): boolean {
    try {
        const pending = sessionStorage.getItem(OFFER_PENDING_KEY) === 'true';
        sessionStorage.removeItem(OFFER_PENDING_KEY);
        return pending;
    } catch {
        return false;
    }
}

export function getPasskeyDeviceState(userId: string): PasskeyDeviceState | null {
    try {
        const value = localStorage.getItem(getDeviceStateKey(userId));
        return value === 'enrolled' || value === 'dismissed' ? value : null;
    } catch {
        return null;
    }
}

export function setPasskeyDeviceState(userId: string, state: PasskeyDeviceState) {
    try {
        localStorage.setItem(getDeviceStateKey(userId), state);
    } catch {
        // Ignora erros de armazenamento.
    }
}

export const passkeyService = {
    async signIn(): Promise<void> {
        const { error } = await supabase.auth.signInWithPasskey();
        if (error) throw error;
    },

    async register(friendlyName: string = defaultPasskeyName()): Promise<PasskeyItem> {
        const { data, error } = await supabase.auth.registerPasskey();
        if (error) throw error;
        if (!data) throw new Error('Não foi possível criar a chave de acesso.');

        const { data: renamed, error: renameError } = await supabase.auth.passkey.update({
            passkeyId: data.id,
            friendlyName,
        });

        // O nome é apenas informativo; a chave já está cadastrada mesmo se a renomeação falhar.
        if (renameError || !renamed) return data;
        return renamed;
    },

    async list(): Promise<PasskeyItem[]> {
        const { data, error } = await supabase.auth.passkey.list();
        if (error) throw error;
        return data ?? [];
    },

    async rename(passkeyId: string, friendlyName: string): Promise<PasskeyItem> {
        const { data, error } = await supabase.auth.passkey.update({
            passkeyId,
            friendlyName: friendlyName.trim().slice(0, 120),
        });
        if (error) throw error;
        if (!data) throw new Error('Não foi possível renomear a chave de acesso.');
        return data;
    },

    async remove(passkeyId: string): Promise<void> {
        const { error } = await supabase.auth.passkey.delete({ passkeyId });
        if (error) throw error;
    },
};
