/**
 * Política de expiração de sessão aplicada pelo cliente.
 *
 * O plano atual do Supabase não permite configurar tempo de inatividade nem
 * tempo máximo de sessão no servidor. Esta política encerra a sessão local
 * (revogando o refresh token no Supabase) quando um dos limites é excedido.
 *
 * Limitação conhecida: só é aplicada enquanto o sistema roda no navegador.
 */

export const SESSION_IDLE_TIMEOUT_MS = 12 * 60 * 60 * 1000;
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_ACTIVITY_WRITE_INTERVAL_MS = 15 * 1000;

const POLICY_STORAGE_KEY = 'ejc-session-policy:v1';
const EXPIRED_REASON_STORAGE_KEY = 'ejc-session-expired-reason';

export type SessionExpiryReason = 'idle' | 'max_age';

export interface SessionPolicyRecord {
    sessionKey: string;
    signedInAt: number;
    lastActivityAt: number;
}

export interface SessionPolicyLimits {
    idleTimeoutMs: number;
    maxAgeMs: number;
}

const DEFAULT_LIMITS: SessionPolicyLimits = {
    idleTimeoutMs: SESSION_IDLE_TIMEOUT_MS,
    maxAgeMs: SESSION_MAX_AGE_MS,
};

interface SessionLike {
    access_token?: string;
    user?: { id: string } | null;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
    const payload = token.split('.')[1];
    if (!payload) return null;

    try {
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
        const parsed: unknown = JSON.parse(atob(padded));
        return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
    } catch {
        return null;
    }
}

/**
 * Identifica a sessão do Supabase. O `session_id` do JWT permanece o mesmo
 * durante as renovações de token e muda a cada novo login.
 */
export function getSessionKey(session: SessionLike | null | undefined): string | null {
    if (!session?.user?.id) return null;

    const sessionId = session.access_token
        ? decodeJwtPayload(session.access_token)?.session_id
        : null;

    if (typeof sessionId === 'string' && sessionId) return `session:${sessionId}`;
    return `user:${session.user.id}`;
}

function isPolicyRecord(value: unknown): value is SessionPolicyRecord {
    if (!value || typeof value !== 'object') return false;
    const record = value as Record<string, unknown>;
    return typeof record.sessionKey === 'string'
        && typeof record.signedInAt === 'number'
        && typeof record.lastActivityAt === 'number';
}

export function readSessionPolicyRecord(): SessionPolicyRecord | null {
    try {
        const raw = localStorage.getItem(POLICY_STORAGE_KEY);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        return isPolicyRecord(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function writeSessionPolicyRecord(record: SessionPolicyRecord) {
    try {
        localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(record));
    } catch {
        // Sem armazenamento disponível a política passa a valer apenas para esta aba.
    }
}

export function clearSessionPolicyRecord() {
    try {
        localStorage.removeItem(POLICY_STORAGE_KEY);
    } catch {
        // Ignora erros de armazenamento.
    }
}

/**
 * Retorna o registro da sessão atual, criando um novo quando a sessão ainda não
 * é conhecida (novo login ou sessões anteriores à adoção desta política).
 */
export function ensureSessionPolicyRecord(sessionKey: string, now: number): SessionPolicyRecord {
    const current = readSessionPolicyRecord();
    if (current?.sessionKey === sessionKey) return current;

    const record: SessionPolicyRecord = { sessionKey, signedInAt: now, lastActivityAt: now };
    writeSessionPolicyRecord(record);
    return record;
}

export function evaluateSessionPolicy(
    record: SessionPolicyRecord,
    now: number,
    limits: SessionPolicyLimits = DEFAULT_LIMITS
): SessionExpiryReason | null {
    if (now - record.signedInAt > limits.maxAgeMs) return 'max_age';
    if (now - record.lastActivityAt > limits.idleTimeoutMs) return 'idle';
    return null;
}

/**
 * Registra atividade do usuário. Retorna o motivo da expiração quando o limite
 * já havia sido excedido antes da interação, sem renovar o registro.
 */
export function registerSessionActivity(
    sessionKey: string,
    now: number,
    limits: SessionPolicyLimits = DEFAULT_LIMITS
): SessionExpiryReason | null {
    const record = ensureSessionPolicyRecord(sessionKey, now);
    const expiredReason = evaluateSessionPolicy(record, now, limits);
    if (expiredReason) return expiredReason;

    if (now - record.lastActivityAt >= SESSION_ACTIVITY_WRITE_INTERVAL_MS) {
        writeSessionPolicyRecord({ ...record, lastActivityAt: now });
    }

    return null;
}

export function checkSessionPolicy(
    sessionKey: string,
    now: number,
    limits: SessionPolicyLimits = DEFAULT_LIMITS
): SessionExpiryReason | null {
    return evaluateSessionPolicy(ensureSessionPolicyRecord(sessionKey, now), now, limits);
}

export function storeSessionExpiredReason(reason: SessionExpiryReason) {
    try {
        sessionStorage.setItem(EXPIRED_REASON_STORAGE_KEY, reason);
    } catch {
        // Ignora erros de armazenamento.
    }
}

export function readSessionExpiredReason(): SessionExpiryReason | null {
    try {
        const value = sessionStorage.getItem(EXPIRED_REASON_STORAGE_KEY);
        return value === 'idle' || value === 'max_age' ? value : null;
    } catch {
        return null;
    }
}

export function clearSessionExpiredReason() {
    try {
        sessionStorage.removeItem(EXPIRED_REASON_STORAGE_KEY);
    } catch {
        // Ignora erros de armazenamento.
    }
}

export function sessionExpiredMessage(reason: SessionExpiryReason): string {
    return reason === 'idle'
        ? 'Sua sessão foi encerrada após um período sem uso. Entre novamente para continuar.'
        : 'Por segurança, sua sessão expirou. Entre novamente para continuar.';
}
