import type { Permissao } from '../services/adminAccessService';

const PERMISSION_TERM_LABELS: Record<string, string> = {
    admin: 'Administração',
    almoxarifado: 'Almoxarifado',
    arquivos: 'Arquivos',
    biblioteca: 'Biblioteca',
    cadastros: 'Cadastros',
    circulos: 'Círculos',
    compras: 'Compras',
    consultar: 'Consultar',
    coordenador: 'Coordenadores',
    coordenar: 'Coordenação',
    criar: 'Criar',
    cuidados: 'Cuidados',
    dashboard: 'Página inicial',
    diagnosticos: 'Diagnósticos técnicos',
    drive: 'Drive',
    duplas: 'Duplas',
    email: 'E-mail',
    financeiro: 'Financeiro',
    gerenciar: 'Gerenciar',
    google: 'Google',
    importar: 'Importar',
    inscricao: 'Inscrições',
    institucional: 'institucional',
    ligacao: 'Ligação',
    mediador: 'Mediadores',
    movimentar: 'Movimentar estoque',
    pedidos: 'Pedidos',
    recepcao: 'Recepção',
    recreacao: 'Recreação',
    responder: 'Responder',
    secretaria: 'Secretaria',
    visitacao: 'Visitação',
};

function humanizePermissionKey(key: string) {
    return key
        .replace(/^modulo_/, '')
        .split('_')
        .map(term => PERMISSION_TERM_LABELS[term] || `${term.charAt(0).toUpperCase()}${term.slice(1)}`)
        .join(' · ');
}

export function getPermissionName(permission: Pick<Permissao, 'chave' | 'nome'>) {
    const registeredName = permission.nome?.trim();
    if (!registeredName) return humanizePermissionKey(permission.chave);

    return registeredName.replace(/^Acesso\s+(?:à|às|ao|aos)\s+/i, '');
}
