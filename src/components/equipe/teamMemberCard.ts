// Utilitários visuais compartilhados pelos cards de integrantes
// (Secretaria › Visualizar equipe e Coordenador › Minha Equipe).

export function getInitials(name: string) {
  return name
    .split(' ')
    .filter(n => n.length > 2)
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
