interface ErrorLike {
  code?: string | number;
  message?: string;
  status?: string | number;
}

export function userFacingError(
  error: unknown,
  fallback = 'Não foi possível concluir a operação. Tente novamente.'
): string {
  const value = error && typeof error === 'object' ? error as ErrorLike : {};
  const code = String(value.code ?? value.status ?? '');
  const message = String(value.message ?? '').toLowerCase();

  if (
    code === '401'
    || code === 'PGRST301'
    || message.includes('jwt')
    || message.includes('session')
    || message.includes('sessão')
  ) {
    return 'Sua sessão expirou. Identifique-se novamente para continuar.';
  }

  if (
    message.includes('failed to fetch')
    || message.includes('network')
    || message.includes('fetch failed')
  ) {
    return 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.';
  }

  if (code === '403' || code === '42501' || message.includes('permission denied')) {
    return 'Você não tem permissão para realizar esta ação.';
  }

  return fallback;
}
