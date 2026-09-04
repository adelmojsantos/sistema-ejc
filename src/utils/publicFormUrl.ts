export function buildPublicFormUrl(encontroId: string, origin = window.location.origin): string {
  const url = new URL('/formulario', origin);
  url.searchParams.set('encontro', encontroId);
  return url.toString();
}

export function buildOnlineRegistrationUrl(origin = window.location.origin): string {
  return new URL('/inscricao-online', origin).toString();
}
