interface ErrorLike {
  code?: string | number;
  message?: string;
  status?: string | number;
}

const DEFAULT_ERROR_MESSAGE = 'Não foi possível concluir a operação. Tente novamente.';

function includesAny(message: string, fragments: string[]): boolean {
  return fragments.some((fragment) => message.includes(fragment));
}

function isSafePortugueseMessage(originalMessage: string, normalizedMessage: string): boolean {
  const hasPortugueseWording = /[áéíóúâêôãõç]|\b(não|já|você|sua|seu|informe|selecione|arquivo|pasta)\b/i
    .test(originalMessage);
  const hasTechnicalDetails = includesAny(normalizedMessage, [
    'constraint',
    'database',
    'edge function',
    'foreign key',
    'postgres',
    'pgrst',
    'relation ',
    'row-level',
    'schema',
    'sql',
    'stack',
    'supabase',
    'table ',
    'tabela ',
    'token',
  ]);

  return originalMessage.length <= 300 && hasPortugueseWording && !hasTechnicalDetails;
}

export function userFacingError(
  error: unknown,
  fallback = DEFAULT_ERROR_MESSAGE
): string {
  const value = error && typeof error === 'object' ? error as ErrorLike : {};
  const code = String(value.code ?? '').toLowerCase();
  const status = String(value.status ?? '');
  const message = String(value.message ?? '').toLowerCase();

  if (
    code === 'invalid_credentials'
    || code === 'invalid_grant'
    || message.includes('invalid login credentials')
  ) {
    return 'E-mail ou senha incorretos. Confira os dados e tente novamente.';
  }

  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return 'Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada para continuar.';
  }

  if (code === 'user_banned' || message.includes('user is banned')) {
    return 'Este acesso está temporariamente bloqueado. Procure um administrador.';
  }

  if (
    status === '429'
    || code === '429'
    || code === 'over_request_rate_limit'
    || code === 'over_email_send_rate_limit'
    || includesAny(message, ['rate limit', 'too many requests'])
  ) {
    return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.';
  }

  if (code === 'weak_password' || message.includes('password should be')) {
    return 'A senha informada não atende aos requisitos de segurança.';
  }

  if (code === 'same_password' || message.includes('same password')) {
    return 'A nova senha deve ser diferente da senha atual.';
  }

  if (
    status === '401'
    || code === '401'
    || code === 'pgrst301'
    || includesAny(message, ['jwt', 'session', 'sessão'])
  ) {
    return 'Sua sessão expirou. Identifique-se novamente para continuar.';
  }

  if (
    includesAny(message, ['failed to fetch', 'network', 'fetch failed', 'networkerror'])
  ) {
    return 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.';
  }

  if (
    status === '403'
    || code === '403'
    || code === '42501'
    || includesAny(message, ['permission denied', 'not authorized', 'unauthorized'])
  ) {
    return 'Você não tem permissão para realizar esta ação.';
  }

  const originalMessage = String(value.message ?? '').trim();
  if (originalMessage && isSafePortugueseMessage(originalMessage, message)) {
    return originalMessage;
  }

  return fallback;
}
