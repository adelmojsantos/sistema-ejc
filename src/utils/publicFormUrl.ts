export function buildPublicFormUrl(encontroId: string, origin = window.location.origin): string {
  const url = new URL('/formulario', origin);
  url.searchParams.set('encontro', encontroId);
  return url.toString();
}
