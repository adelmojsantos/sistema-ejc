import { supabase } from '../lib/supabase';

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
    storage_path: string;
    tamanho_bytes: number;
    tipo_mime: string;
    created_at: string;
}

export const bibliotecaService = {
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
            const result: any = await supabase
                .from('biblioteca_pastas')
                .select('*')
                .eq('id', currentId)
                .single();

            if (result.error || !result.data) break;
            breadcrumbs.unshift(result.data as BibliotecaPasta);
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
                tipo_mime: file.type || 'application/octet-stream'
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
    }
};
