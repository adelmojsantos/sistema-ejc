import { supabase } from '../lib/supabase';
import {
    googleDriveMimeType,
    parseGoogleDriveLink,
    type GoogleDriveFileType
} from '../utils/googleDriveLink';

export interface BibliotecaPasta {
    id: string;
    nome: string;
    parent_id: string | null;
    created_at: string;
}

export interface BibliotecaArquivo {
    id: string;
    nome_exibicao: string;
    pasta_id: string | null;
    storage_path: string | null;
    tamanho_bytes: number;
    tipo_mime: string;
    origem: 'supabase' | 'google_drive';
    google_file_id: string | null;
    google_tipo: GoogleDriveFileType | null;
    url_externa: string | null;
    google_managed: boolean;
    google_sync_status: 'manual' | 'pending' | 'syncing' | 'synced' | 'error';
    google_sync_error: string | null;
    google_synced_at: string | null;
    created_at: string;
}

export interface BibliotecaCompartilhamento {
    id: string;
    pasta_id: string | null;
    arquivo_id: string | null;
    equipe_id: string | null;
    grupo_id: string | null;
    google_role: 'reader' | 'writer';
    criado_em: string;
}

export interface GoogleDriveIntegrationStatus {
    connected: boolean;
    accountEmail: string | null;
    connectedAt: string | null;
    lastError: string | null;
    pendingCount: number;
    errorCount: number;
}

interface GoogleDriveSyncResult {
    accountEmail: string | null;
    results: Array<{ arquivoId: string; errors: string[] }>;
}

export interface GoogleDriveUserAccess {
    accessStatus: 'granted' | 'google_account_required' | 'pending' | 'sync_error' | 'not_managed';
    googleEmail: string | null;
}

const GOOGLE_EDITABLE_EXTENSIONS = new Set(['doc', 'docx', 'txt', 'csv', 'xlsx']);

export function isGoogleEditableFileName(fileName: string): boolean {
    const extension = fileName.trim().toLowerCase().match(/\.([^.]+)$/)?.[1];
    return Boolean(extension && GOOGLE_EDITABLE_EXTENSIONS.has(extension));
}

async function invokeGoogleDrive<T>(body: Record<string, unknown>): Promise<T> {
    const { data, error } = await supabase.functions.invoke('google-drive', { body });
    if (error) throw error;
    if (!data || typeof data !== 'object') {
        throw new Error('A integração Google Drive retornou uma resposta inválida.');
    }
    if ('error' in data && typeof data.error === 'string') {
        throw new Error(data.error);
    }
    return data as T;
}

export const bibliotecaService = {
    // Grupos de Acesso
    async listarGruposAcesso(): Promise<{ id: string, nome: string }[]> {
        const { data, error } = await supabase.from('grupos').select('id, nome').order('nome');
        if (error) throw error;
        return data || [];
    },

    // Pastas
    async listarPastas(parentId: string | null = null): Promise<BibliotecaPasta[]> {
        let query = supabase.from('biblioteca_pastas').select('*').order('nome');
        if (parentId) {
            query = query.eq('parent_id', parentId);
        } else {
            query = query.is('parent_id', null);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    async criarPasta(nome: string, parentId: string | null = null): Promise<BibliotecaPasta> {
        const { data, error } = await supabase
            .from('biblioteca_pastas')
            .insert([{ nome, parent_id: parentId }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async renomearPasta(id: string, novoNome: string): Promise<void> {
        const { error } = await supabase
            .from('biblioteca_pastas')
            .update({ nome: novoNome })
            .eq('id', id);

        if (error) throw error;
    },

    async moverPasta(id: string, novoParentId: string | null): Promise<void> {
        // Prevenir mover uma pasta para dentro de si mesma (ciclo)
        if (id === novoParentId) throw new Error('Não é possível mover uma pasta para dentro de si mesma.');
        
        // Opcional: Uma validação completa requeriria checar recursivamente se o novoParentId não é filho de id.
        // Para simplificar, assumimos que o UI ou o banco via trigger podem barrar ciclos.
        const { error } = await supabase
            .from('biblioteca_pastas')
            .update({ parent_id: novoParentId })
            .eq('id', id);

        if (error) throw error;
    },

    async excluirPasta(id: string): Promise<void> {
        // A foreign key constraint ON DELETE RESTRICT garante que não possamos deletar
        // se houver arquivos ou subpastas apontando para ela. O supabase vai jogar um erro.
        const { error } = await supabase
            .from('biblioteca_pastas')
            .delete()
            .eq('id', id);

        if (error) {
            if (error.code === '23503') { // Foreign Key Violation
                throw new Error('Não é possível excluir uma pasta que contém arquivos ou subpastas.');
            }
            throw error;
        }
    },

    async getPastaBreadcrumbs(pastaId: string): Promise<BibliotecaPasta[]> {
        const breadcrumbs: BibliotecaPasta[] = [];
        let currentId: string | null = pastaId;

        // Limite arbitrário de 10 níveis para evitar loops infinitos caso a base seja corrompida
        let depth = 0;
        while (currentId && depth < 10) {
            const result: { data: BibliotecaPasta | null; error: unknown } = await supabase
                .from('biblioteca_pastas')
                .select('*')
                .eq('id', currentId)
                .single();

            if (result.error || !result.data) break;
            breadcrumbs.unshift(result.data);
            currentId = result.data.parent_id;
            depth++;
        }

        return breadcrumbs;
    },

    // Arquivos
    async listarArquivos(pastaId: string | null = null): Promise<BibliotecaArquivo[]> {
        let query = supabase.from('biblioteca_arquivos').select('*').order('nome_exibicao');
        if (pastaId) {
            query = query.eq('pasta_id', pastaId);
        } else {
            query = query.is('pasta_id', null);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    async uploadArquivo(file: File, pastaId: string | null = null, onProgress?: (percent: number) => void): Promise<BibliotecaArquivo> {
        if (file.size > 25 * 1024 * 1024) {
            throw new Error('O arquivo deve ter no máximo 25 MB.');
        }
        // Gerar caminho seguro no storage
        const timestamp = new Date().getTime();
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storagePath = pastaId 
            ? `${pastaId}/${timestamp}_${safeName}`
            : `root/${timestamp}_${safeName}`;

        // Upload físico pro bucket
        // Nota: O método supabase-js v2 upload() não suporta callback de progresso nativo no browser sem hacks,
        // mas usaremos de forma assíncrona simples
        if (onProgress) onProgress(10);

        const { error: uploadError } = await supabase.storage
            .from('biblioteca')
            .upload(storagePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) throw uploadError;
        if (onProgress) onProgress(80);

        // Registro lógico no DB
        const { data, error: dbError } = await supabase
            .from('biblioteca_arquivos')
            .insert([{
                nome_exibicao: file.name,
                pasta_id: pastaId,
                storage_path: storagePath,
                tamanho_bytes: file.size,
                tipo_mime: file.type || 'application/octet-stream',
                origem: 'supabase'
            }])
            .select()
            .single();

        if (dbError) {
            // Rollback do arquivo físico (best effort)
            await supabase.storage.from('biblioteca').remove([storagePath]);
            throw dbError;
        }

        if (onProgress) onProgress(100);
        return data;
    },

    async uploadArquivoEditavelGoogle(
        file: File,
        pastaId: string | null = null
    ): Promise<{ file: BibliotecaArquivo; syncErrors: string[] }> {
        if (!isGoogleEditableFileName(file.name)) {
            throw new Error('Envie um arquivo DOC, DOCX, TXT, CSV ou XLSX.');
        }
        if (file.size <= 0 || file.size > 25 * 1024 * 1024) {
            throw new Error('O arquivo editável deve possuir entre 1 byte e 25 MB.');
        }
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) {
            throw new Error('Sessão expirada. Entre novamente para enviar ao Google Drive.');
        }
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storagePath = `google-imports/${userData.user.id}/${crypto.randomUUID()}_${safeName}`;
        const { error: uploadError } = await supabase.storage
            .from('biblioteca')
            .upload(storagePath, file, {
                cacheControl: '3600',
                upsert: false,
            });
        if (uploadError) throw uploadError;

        try {
            return await invokeGoogleDrive({
                action: 'import-file',
                storagePath,
                fileName: file.name,
                mimeType: file.type || 'application/octet-stream',
                size: file.size,
                pastaId,
            });
        } catch (error) {
            await supabase.storage.from('biblioteca').remove([storagePath]);
            throw error;
        }
    },

    async cadastrarReferenciaGoogle(params: {
        nome: string;
        url: string;
        pastaId?: string | null;
        tipo?: GoogleDriveFileType;
    }): Promise<BibliotecaArquivo> {
        const nome = params.nome.trim();
        if (!nome) throw new Error('Informe o nome do documento.');

        const link = parseGoogleDriveLink(params.url, params.tipo);
        const { data, error } = await supabase
            .from('biblioteca_arquivos')
            .insert([{
                nome_exibicao: nome,
                pasta_id: params.pastaId ?? null,
                storage_path: null,
                tamanho_bytes: 0,
                tipo_mime: googleDriveMimeType(link.fileType),
                origem: 'google_drive',
                google_file_id: link.fileId,
                google_tipo: link.fileType,
                url_externa: link.normalizedUrl
            }])
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                throw new Error('Este documento do Google já está cadastrado na Biblioteca.');
            }
            throw error;
        }

        return data;
    },

    async atualizarReferenciaGoogle(params: {
        id: string;
        nome: string;
        url: string;
        tipo?: GoogleDriveFileType;
    }): Promise<void> {
        const nome = params.nome.trim();
        if (!nome) throw new Error('Informe o nome do documento.');

        const link = parseGoogleDriveLink(params.url, params.tipo);
        const { error } = await supabase
            .from('biblioteca_arquivos')
            .update({
                nome_exibicao: nome,
                tipo_mime: googleDriveMimeType(link.fileType),
                google_file_id: link.fileId,
                google_tipo: link.fileType,
                url_externa: link.normalizedUrl
            })
            .eq('id', params.id)
            .eq('origem', 'google_drive');

        if (error) {
            if (error.code === '23505') {
                throw new Error('Este documento do Google já está cadastrado na Biblioteca.');
            }
            throw error;
        }
    },

    async renomearArquivo(id: string, novoNome: string): Promise<void> {
        const { error } = await supabase
            .from('biblioteca_arquivos')
            .update({ nome_exibicao: novoNome })
            .eq('id', id);

        if (error) throw error;
    },

    async moverArquivo(id: string, novaPastaId: string | null): Promise<void> {
        const { error } = await supabase
            .from('biblioteca_arquivos')
            .update({ pasta_id: novaPastaId })
            .eq('id', id);

        if (error) throw error;
    },

    async excluirArquivo(arquivo: BibliotecaArquivo): Promise<void> {
        // 1. Deletar no DB
        const { error: dbError } = await supabase
            .from('biblioteca_arquivos')
            .delete()
            .eq('id', arquivo.id);

        if (dbError) throw dbError;

        // 2. Deletar no Storage
        if (arquivo.origem === 'google_drive' || !arquivo.storage_path) return;

        const { error: storageError } = await supabase.storage
            .from('biblioteca')
            .remove([arquivo.storage_path]);

        if (storageError) {
            console.error('Erro ao deletar arquivo físico no storage:', storageError);
            // Non-blocking throw because DB is already cleaned, but good to log
        }
    },

    async gerarSignedUrl(storagePath: string): Promise<string> {
        // Expira em 1 hora (3600 seg)
        const { data, error } = await supabase.storage
            .from('biblioteca')
            .createSignedUrl(storagePath, 3600);

        if (error) throw error;
        return data.signedUrl;
    },

    async abrirArquivo(arquivo: BibliotecaArquivo): Promise<void> {
        if (arquivo.origem === 'google_drive') {
            if (!arquivo.url_externa) throw new Error('A referência do Google Drive está incompleta.');
            if (arquivo.google_managed) {
                const access = await this.obterMeuAcessoGoogleDrive(arquivo.id);
                if (access.accessStatus === 'google_account_required') {
                    const email = access.googleEmail ? ` (${access.googleEmail})` : '';
                    throw new Error(
                        `Você não possui acesso a este arquivo porque seu e-mail${email} não está associado a uma Conta Google. Solicite ao administrador o cadastro de um e-mail Google no sistema.`
                    );
                }
                if (access.accessStatus !== 'granted') {
                    throw new Error(
                        'Seu acesso a este arquivo no Google Drive ainda não foi concedido. Aguarde a sincronização ou procure o administrador.'
                    );
                }
            }
            window.open(arquivo.url_externa, '_blank', 'noopener,noreferrer');
            return;
        }

        if (!arquivo.storage_path) throw new Error('O arquivo não possui um caminho de armazenamento válido.');
        const url = await this.gerarSignedUrl(arquivo.storage_path);
        window.open(url, '_blank', 'noopener,noreferrer');
    },

    async baixarArquivo(arquivo: BibliotecaArquivo): Promise<void> {
        if (arquivo.origem === 'google_drive') {
            await this.abrirArquivo(arquivo);
            return;
        }

        if (!arquivo.storage_path) throw new Error('O arquivo não possui um caminho de armazenamento válido.');
        const url = await this.gerarSignedUrl(arquivo.storage_path);
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('Não foi possível baixar o arquivo.');
        }

        const blob = await response.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = objectUrl;
        link.download = arquivo.nome_exibicao || 'arquivo';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(objectUrl);
    },

    // Compartilhamento
    async compartilharItem(params: {
        pastaId?: string;
        arquivoId?: string;
        equipeId?: string;
        grupoId?: string;
        googleRole?: 'reader' | 'writer';
    }): Promise<void> {
        const { error } = await supabase
            .from('biblioteca_compartilhamento')
            .insert([{
                pasta_id: params.pastaId || null,
                arquivo_id: params.arquivoId || null,
                equipe_id: params.equipeId || null,
                grupo_id: params.grupoId || null,
                google_role: params.googleRole ?? 'reader'
            }]);

        if (error) throw error;
    },

    async removerCompartilhamento(id: string): Promise<void> {
        const { error } = await supabase
            .from('biblioteca_compartilhamento')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    async atualizarPapelGoogleCompartilhamento(
        id: string,
        googleRole: 'reader' | 'writer'
    ): Promise<void> {
        const { error } = await supabase
            .from('biblioteca_compartilhamento')
            .update({ google_role: googleRole })
            .eq('id', id);

        if (error) throw error;
    },

    async listarCompartilhamentos(itemId: string, type: 'pasta' | 'arquivo'): Promise<BibliotecaCompartilhamento[]> {
        const field = type === 'pasta' ? 'pasta_id' : 'arquivo_id';
        const { data, error } = await supabase
            .from('biblioteca_compartilhamento')
            .select('*')
            .eq(field, itemId);

        if (error) throw error;
        return data || [];
    },

    async obterStatusGoogleDrive(): Promise<GoogleDriveIntegrationStatus> {
        return invokeGoogleDrive<GoogleDriveIntegrationStatus>({ action: 'status' });
    },

    async iniciarConexaoGoogleDrive(): Promise<string> {
        const result = await invokeGoogleDrive<{ authorizationUrl: string }>({ action: 'start-oauth' });
        return result.authorizationUrl;
    },

    async criarArquivoGoogle(params: {
        name: string;
        fileType: 'document' | 'spreadsheet';
        pastaId?: string | null;
    }): Promise<{ file: BibliotecaArquivo; syncErrors: string[] }> {
        return invokeGoogleDrive({
            action: 'create-file',
            name: params.name,
            fileType: params.fileType,
            pastaId: params.pastaId ?? null,
        });
    },

    async renomearArquivoGoogle(arquivoId: string, name: string): Promise<BibliotecaArquivo> {
        const result = await invokeGoogleDrive<{ file: BibliotecaArquivo }>({
            action: 'rename-file',
            arquivoId,
            name,
        });
        return result.file;
    },

    async moverArquivoGoogleParaLixeira(arquivoId: string): Promise<void> {
        await invokeGoogleDrive<{ trashed: boolean }>({
            action: 'trash-file',
            arquivoId,
        });
    },

    async sincronizarGoogleDrive(limit = 10): Promise<GoogleDriveSyncResult> {
        return invokeGoogleDrive<GoogleDriveSyncResult>({ action: 'sync-pending', limit });
    },

    async sincronizarItemGoogle(params: {
        pastaId?: string;
        arquivoId?: string;
    }): Promise<GoogleDriveSyncResult> {
        return invokeGoogleDrive<GoogleDriveSyncResult>({
            action: 'sync-item',
            pastaId: params.pastaId ?? null,
            arquivoId: params.arquivoId ?? null,
        });
    },

    async moverArquivoEditavelParaGoogle(
        arquivoId: string
    ): Promise<{ file: BibliotecaArquivo; syncErrors: string[] }> {
        return invokeGoogleDrive({ action: 'import-file', arquivoId });
    },

    async obterMeuAcessoGoogleDrive(arquivoId: string): Promise<GoogleDriveUserAccess> {
        const { data, error } = await supabase.rpc('obter_meu_acesso_google_biblioteca', {
            p_arquivo_id: arquivoId,
        });
        if (error) throw error;

        const row = Array.isArray(data) ? data[0] : data;
        if (!row || typeof row.access_status !== 'string') {
            return { accessStatus: 'pending', googleEmail: null };
        }
        return {
            accessStatus: row.access_status as GoogleDriveUserAccess['accessStatus'],
            googleEmail: typeof row.google_email === 'string' ? row.google_email : null,
        };
    },

    async listarItensCompartilhados(params: {
        grupoIds?: string[];
        equipeId?: string;
        isAdmin?: boolean;
    }): Promise<{ pastas: BibliotecaPasta[], arquivos: BibliotecaArquivo[] }> {
        const { data, error } = await supabase.rpc('listar_itens_biblioteca_compartilhados', {
            p_grupo_ids: params.grupoIds || [],
            p_equipe_id: params.equipeId || null,
            p_is_admin: params.isAdmin || false
        });

        if (error) throw error;

        const pastas: BibliotecaPasta[] = [];
        const arquivos: BibliotecaArquivo[] = [];

        type SharedLibraryRow = {
            res_tipo: 'pasta' | 'arquivo';
            res_id: string;
            res_nome: string;
            res_pasta_id: string | null;
            res_storage_path: string | null;
            res_tamanho_bytes: number;
            res_tipo_mime: string;
            res_origem: 'supabase' | 'google_drive' | null;
            res_google_file_id: string | null;
            res_google_tipo: GoogleDriveFileType | null;
            res_url_externa: string | null;
            res_google_managed?: boolean | null;
            res_google_sync_status?: BibliotecaArquivo['google_sync_status'] | null;
            res_google_sync_error?: string | null;
            res_google_synced_at?: string | null;
            res_criado_em: string;
        };

        (data as SharedLibraryRow[]).forEach((item) => {
            if (item.res_tipo === 'pasta') {
                pastas.push({
                    id: item.res_id,
                    nome: item.res_nome,
                    parent_id: item.res_pasta_id,
                    created_at: item.res_criado_em
                });
            } else {
                arquivos.push({
                    id: item.res_id,
                    nome_exibicao: item.res_nome,
                    pasta_id: item.res_pasta_id,
                    storage_path: item.res_storage_path,
                    tamanho_bytes: item.res_tamanho_bytes,
                    tipo_mime: item.res_tipo_mime,
                    origem: item.res_origem || 'supabase',
                    google_file_id: item.res_google_file_id || null,
                    google_tipo: item.res_google_tipo || null,
                    url_externa: item.res_url_externa || null,
                    google_managed: item.res_google_managed ?? false,
                    google_sync_status: item.res_google_sync_status ?? 'manual',
                    google_sync_error: item.res_google_sync_error ?? null,
                    google_synced_at: item.res_google_synced_at ?? null,
                    created_at: item.res_criado_em
                });
            }
        });

        return { pastas, arquivos };
    }
};
