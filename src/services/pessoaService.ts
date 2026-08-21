import { supabase } from '../lib/supabase';
import type { Pessoa, PessoaFormData } from '../types/pessoa';
import { geolocationService } from './geolocationService';
import { hasRegionalAddress, hasRegionalReference } from '../types/geolocation';

const TABLE = 'pessoas';

export interface PessoaHistoricoParticipacao {
    id: string;
    participante: boolean | null;
    coordenador: boolean | null;
    equipes: { nome: string | null } | null;
    encontros: {
        nome: string | null;
        ativo: boolean | null;
        tema: string | null;
    } | null;
}

type RelacaoPostgrest<T> = T | T[] | null | undefined;

interface PessoaHistoricoParticipacaoRow {
    id: string;
    participante: boolean | null;
    coordenador: boolean | null;
    equipes: RelacaoPostgrest<{ nome: string | null }>;
    encontros: RelacaoPostgrest<{
        nome: string | null;
        ativo: boolean | null;
        tema: string | null;
    }>;
}

function primeiraRelacao<T>(value: RelacaoPostgrest<T>): T | null {
    return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

/**
 * Normaliza relações do PostgREST, que podem chegar como objeto em relações
 * muitos-para-um ou como array conforme os metadados disponíveis no cliente.
 */
export function normalizarHistoricoParticipacao(
    row: PessoaHistoricoParticipacaoRow,
): PessoaHistoricoParticipacao {
    const equipe = primeiraRelacao(row.equipes);
    const encontro = primeiraRelacao(row.encontros);

    return {
        id: row.id,
        participante: row.participante,
        coordenador: row.coordenador,
        equipes: equipe ? { nome: equipe.nome } : null,
        encontros: encontro
            ? { nome: encontro.nome, ativo: encontro.ativo, tema: encontro.tema }
            : null,
    };
}

/** Campos pessoais aceitos pela edição. Vínculos de encontro pertencem a participacoes. */
export type PessoaUpdateData = Partial<PessoaFormData>;

export interface PessoaPersistenceOptions {
    automaticApproximateLocation?: boolean;
}

export interface ExclusaoPessoaImpacto {
    pessoa_id: string;
    nome_completo: string;
    usuario_vinculado: boolean;
    participacoes: number;
    cancelamentos: number;
    visitas: number;
    circulos: number;
    recepcao: number;
    recreacao: number;
    dirigencia: number;
}

export type PessoaSearchField = 'todos' | 'nome' | 'email' | 'telefone' | 'endereco';

interface PessoaSearchRpcResult {
    data: Pessoa[];
    count: number;
}

function parsePessoaSearchResult(value: unknown): PessoaSearchRpcResult {
    if (!value || typeof value !== 'object') {
        throw new Error('A busca de pessoas retornou uma resposta inválida.');
    }

    const result = value as { data?: unknown; count?: unknown };
    if (!Array.isArray(result.data) || typeof result.count !== 'number') {
        throw new Error('A busca de pessoas retornou uma resposta incompleta.');
    }

    return { data: result.data as Pessoa[], count: result.count };
}

/**
 * Normaliza somente dados da pessoa, preservando campos omitidos em atualizações parciais.
 * Isso impede que telas de módulos diferentes enviem acidentalmente dados de participação.
 */
export function normalizarPessoaUpdate(data: PessoaUpdateData): PessoaUpdateData {
    const normalized = { ...data } as PessoaUpdateData & Record<string, unknown>;
    const mutable = normalized as Record<string, unknown>;
    const nullableTextFields: Array<keyof PessoaUpdateData> = [
        'cpf', 'email', 'comunidade', 'data_nascimento', 'nome_pai', 'nome_mae',
        'endereco', 'numero', 'complemento', 'cep', 'bairro', 'cidade', 'estado',
        'telefone_pai', 'telefone_mae', 'outros_contatos', 'qual_paroquia_ejc',
        'restricao_alimentar', 'medicamento_continuo', 'alergia', 'observacoes_saude',
    ];

    for (const field of nullableTextFields) {
        const value = normalized[field];
        if (typeof value === 'string') {
            const trimmed = value.trim();
            mutable[field] = trimmed === '' ? null : trimmed;
        }
    }

    if (typeof normalized.nome_completo === 'string') {
        normalized.nome_completo = normalized.nome_completo.trim();
    }
    if (typeof normalized.telefone === 'string') {
        normalized.telefone = normalized.telefone.replace(/\D/g, '');
    }
    if (typeof normalized.cpf === 'string') {
        normalized.cpf = normalized.cpf.replace(/\D/g, '') || null;
    }
    if (typeof normalized.cep === 'string') {
        normalized.cep = normalized.cep.replace(/\D/g, '') || null;
    }

    return normalized as PessoaUpdateData;
}

async function withAutomaticApproximateLocation<T extends PessoaUpdateData>(data: T): Promise<T> {
    if (!hasRegionalAddress(data) || hasRegionalReference(data)) return data;

    try {
        const { update } = await geolocationService.resolveRegionalReferenceForPersistence(data);
        return { ...data, ...update };
    } catch {
        // A indisponibilidade de um provedor nunca pode impedir o cadastro.
        return data;
    }
}

export const pessoaService = {
    async listar(): Promise<Pessoa[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*')
            .order('nome_completo', { ascending: true });

        if (error) throw error;
        return data as Pessoa[];
    },

    async buscarComPaginacao(busca: string = '', pagina: number = 1, limite: number = 20, encontroId?: string): Promise<{ data: Pessoa[], count: number }> {
        let query;

        if (encontroId) {
            query = supabase
                .from(TABLE)
                .select('*, participacoes!inner(encontro_id)', { count: 'exact' })
                .eq('participacoes.encontro_id', encontroId);
        } else {
            query = supabase
                .from(TABLE)
                .select('*', { count: 'exact' });
        }

        query = query.order('nome_completo', { ascending: true });

        if (busca.trim() !== '') {
            query = query.or(`nome_completo.ilike.%${busca}%,cpf.ilike.%${busca}%,email.ilike.%${busca}%,telefone.ilike.%${busca}%,comunidade.ilike.%${busca}%`);
        }

        const from = (pagina - 1) * limite;
        const to = from + limite - 1;

        const { data, error, count } = await query.range(from, to);

        if (error) throw error;
        return { data: data as Pessoa[], count: count || 0 };
    },

    async buscarPorCampoComPaginacao(
        campo: PessoaSearchField,
        busca: string = '',
        pagina: number = 1,
        limite: number = 20,
        encontroId?: string,
    ): Promise<PessoaSearchRpcResult> {
        const { data, error } = await supabase.rpc('search_pessoas_by_field', {
            p_search_field: campo,
            p_search_term: busca.trim(),
            p_encontro_id: encontroId || null,
            p_page: pagina,
            p_page_size: limite,
        });

        if (error) throw error;
        return parsePessoaSearchResult(data);
    },

    async buscarPorId(id: string): Promise<Pessoa> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as Pessoa;
    },

    async buscarHistorico(pessoaId: string): Promise<PessoaHistoricoParticipacao[]> {
        const { data, error } = await supabase
            .from('participacoes')
            .select(`
                id,
                participante,
                coordenador,
                equipes ( nome ),
                encontros ( nome, ativo, tema )
            `)
            .eq('pessoa_id', pessoaId);

        if (error) throw error;
        return (data || []).map(normalizarHistoricoParticipacao);
    },

    async criar(formData: PessoaFormData, options: PessoaPersistenceOptions = {}): Promise<Pessoa> {
        const payload = options.automaticApproximateLocation === false
            ? formData
            : await withAutomaticApproximateLocation(formData);
        const { data, error } = await supabase
            .from(TABLE)
            .insert([payload])
            .select()
            .single();

        if (error) throw error;
        return data as Pessoa;
    },

    async atualizar(id: string, formData: PessoaUpdateData, options: PessoaPersistenceOptions = {}): Promise<Pessoa> {
        const normalized = normalizarPessoaUpdate(formData);
        const payload = options.automaticApproximateLocation === false
            ? normalized
            : await withAutomaticApproximateLocation(normalized);
        const { data, error } = await supabase
            .from(TABLE)
            .update(payload)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as Pessoa;
    },

    async atualizarLocalizacaoAproximada(id: string): Promise<Pessoa> {
        const pessoa = await this.buscarPorId(id);
        if (!hasRegionalAddress(pessoa)) return pessoa;

        const { update } = await geolocationService.resolveRegionalReferenceForPersistence(pessoa);
        const { data, error } = await supabase
            .from(TABLE)
            .update(update)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as Pessoa;
    },

    async obterImpactoExclusao(id: string): Promise<ExclusaoPessoaImpacto> {
        const { data, error } = await supabase.rpc('get_exclusao_pessoa_impacto', {
            p_pessoa_id: id,
        });

        if (error) throw error;
        return data as ExclusaoPessoaImpacto;
    },

    async excluirDefinitivamente(id: string, nomeConfirmacao: string): Promise<void> {
        const { error } = await supabase.rpc('excluir_pessoa_definitivamente', {
            p_pessoa_id: id,
            p_nome_confirmacao: nomeConfirmacao,
        });

        if (error) throw error;
    },

    async buscarPorSemelhanca(nome: string, cpf?: string | null): Promise<Pessoa[]> {
        let query = supabase
            .from(TABLE)
            .select(`
                *,
                participacoes (
                    participante,
                    coordenador,
                    equipes (
                        nome
                    ),
                    encontros (
                        nome
                    )
                )
            `);

        if (cpf) {
            query = query.or(`nome_completo.ilike.%${nome}%,cpf.eq.${cpf},email.ilike.%${nome}%,telefone.ilike.%${nome}%`);
        } else {
            query = query.or(`nome_completo.ilike.%${nome}%,email.ilike.%${nome}%,telefone.ilike.%${nome}%`);
        }

        const { data, error } = await query.limit(5);
        if (error) throw error;
        return data as Pessoa[];
    },

    async buscarNomesPorEmails(emails: string[]): Promise<{ email: string, nome_completo: string }[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('email, nome_completo')
            .in('email', emails);

        if (error) throw error;
        return data || [];
    },
};
