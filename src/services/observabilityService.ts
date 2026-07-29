import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'ejc:diagnostics';
const MAX_LOCAL_EVENTS = 30;
const REMOTE_LOGGING_ENABLED = import.meta.env.VITE_ENABLE_REMOTE_ERROR_LOGS === 'true';

export interface AppDiagnosticEvent {
  id: string;
  createdAt: string;
  source: string;
  route: string;
  message: string;
  stack?: string;
}

export interface RemoteAppDiagnostic {
  id: string;
  created_at: string;
  user_id: string;
  source: string;
  route: string;
  message: string;
  stack: string | null;
}

interface CaptureContext {
  source: string;
  userId?: string | null;
  details?: string;
}

function redact(value: string, maxLength: number) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g, '[token]')
    .replace(/(password|senha|authorization)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .slice(0, maxLength);
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: redact(error.message || error.name, 1800),
      stack: error.stack ? redact(error.stack, 6000) : undefined,
    };
  }

  if (typeof error === 'string') {
    return { message: redact(error, 1800), stack: undefined };
  }

  try {
    return { message: redact(JSON.stringify(error), 1800), stack: undefined };
  } catch {
    return { message: 'Erro não serializável', stack: undefined };
  }
}

export function getLocalDiagnostics(): AppDiagnosticEvent[] {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) as AppDiagnosticEvent[] : [];
  } catch {
    return [];
  }
}

export function clearLocalDiagnostics() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function captureAppError(error: unknown, context: CaptureContext) {
  const normalized = normalizeError(error);
  const stack = [normalized.stack, context.details ? redact(context.details, 3000) : '']
    .filter(Boolean)
    .join('\n');
  const event: AppDiagnosticEvent = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    source: redact(context.source, 80),
    route: redact(window.location.pathname, 300),
    message: normalized.message,
    stack: stack || undefined,
  };

  try {
    const events = [event, ...getLocalDiagnostics()].slice(0, MAX_LOCAL_EVENTS);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    // Diagnostics must never prevent the application from recovering.
  }

  if (import.meta.env.DEV) {
    console.error(`[diagnostics:${event.source}]`, error);
  }

  if (!REMOTE_LOGGING_ENABLED || !context.userId) return;

  void supabase
    .from('app_error_logs')
    .insert({
      id: event.id,
      user_id: context.userId,
      source: event.source,
      route: event.route,
      message: event.message,
      stack: event.stack ?? null,
    })
    .then(({ error: insertError }) => {
      if (insertError && import.meta.env.DEV) {
        console.warn('[diagnostics] Falha ao registrar evento remoto:', insertError.message);
      }
    });
}

export async function listRemoteDiagnostics(limit = 100): Promise<RemoteAppDiagnostic[]> {
  const { data, error } = await supabase
    .from('app_error_logs')
    .select('id, created_at, user_id, source, route, message, stack')
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));

  if (error) throw error;
  return (data ?? []) as RemoteAppDiagnostic[];
}

export const remoteDiagnosticsEnabled = REMOTE_LOGGING_ENABLED;
