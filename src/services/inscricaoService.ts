import { supabase } from '../lib/supabase';
import type { Inscricao, InscricaoFormData, InscricaoEnriched } from '../types/inscricao';

const TABLE = 'participacoes';

export const inscricaoService = {
    async listar(): Promise<InscricaoEnriched[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*, pessoas(id, nome_completo, cpf, latitude, longitude), encontros(nome), equipes(nome)')
            .order('data_inscricao', { ascending: false });

        if (error) throw error;
        return data;
    },

    async listarPorEncontro(encontroId: string): Promise<InscricaoEnriched[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*, pessoas(id, nome_completo, cpf, email, telefone, comunidade, data_nascimento, endereco, numero, bairro, cidade, estado, cep, origem, latitude, longitude), equipes(nome)')
            .eq('encontro_id', encontroId);

        if (error) throw error;
        return data;
    },

    /**
     * Busca apenas os encontreiros (participante=false) de um encontro.
     * Retorna somente as colunas necessárias para a listagem da SecretariaEncontreirosPage.
     * Evita baixar todos os dados de participantes desnecessariamente.
     */
    async listarEncontreirosPorEncontro(encontroId: string): Promise<InscricaoEnriched[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('id, equipe_id, coordenador, participante, pessoa_id, pessoas(nome_completo, telefone, email, cpf, comunidade, bairro), equipes(nome)')
            .eq('encontro_id', encontroId)
            .eq('participante', false);

        if (error) throw error;
        return data as unknown as InscricaoEnriched[];
    },

    /**
     * Busca apenas os participantes (participante=true) de um encontro.
     * Retorna os campos necessários para SecretariaParticipantesPage (inclui endereço e geo).
     */
    async listarParticipantesPorEncontro(encontroId: string): Promise<InscricaoEnriched[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('id, equipe_id, coordenador, participante, pessoa_id, origem, pessoas(id, nome_completo, cpf, email, telefone, comunidade, data_nascimento, endereco, numero, bairro, cidade, estado, cep, origem, latitude, longitude), equipes(nome)')
            .eq('encontro_id', encontroId)
            .eq('participante', true);

        if (error) throw error;
        return data as unknown as InscricaoEnriched[];
    },

    /**
     * Versão ultra-leve para MontagemPage.
     * Carrega apenas id, equipe_id, coordenador, participante e nome/cpf da pessoa.
     * Não inclui endereço, geo, email ou outros campos pesados — só o necessário para montagem e contagens.
     */
    async listarResumoPorEncontro(encontroId: string): Promise<InscricaoEnriched[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('id, equipe_id, coordenador, participante, pessoa_id, dados_confirmados, pago_taxa, pessoas(nome_completo, cpf), equipes(nome)')
            .eq('encontro_id', encontroId);

        if (error) throw error;
        return data as unknown as InscricaoEnriched[];
    },

    /**
     * Carrega dados completos apenas das participações de uma equipe específica.
     * Usar na página de detalhe de equipe para evitar carregar todos os participantes do encontro.
     */
    async listarPorEquipeEEncontro(equipeId: string, encontroId: string): Promise<InscricaoEnriched[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('*, pessoas(id, nome_completo, cpf, email, telefone, comunidade, data_nascimento, endereco, numero, bairro, cidade, estado, cep, origem, latitude, longitude), equipes(nome), recepcao_dados(*), recreacao_dados!recreacao_dados_participacao_id_fkey(*)')
            .eq('encontro_id', encontroId)
            .eq('equipe_id', equipeId);

        if (error) throw error;
        return data as unknown as InscricaoEnriched[];
    },

    async criar(formData: InscricaoFormData): Promise<Inscricao> {
        const { data, error } = await supabase
            .from(TABLE)
            .insert([formData])
            .select()
            .single();

        if (error) throw error;
        return data as Inscricao;
    },

    async criarMuitos(formDataArray: InscricaoFormData[]): Promise<Inscricao[]> {
        const { data, error } = await supabase
            .from(TABLE)
            .insert(formDataArray)
            .select();

        if (error) throw error;
        return data as Inscricao[];
    },

    async atualizar(id: string, formData: Partial<InscricaoFormData>): Promise<Inscricao> {
        const { data, error } = await supabase
            .from(TABLE)
            .update(formData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as Inscricao;
    },

    async excluir(id: string): Promise<void> {
        const { error } = await supabase
            .from(TABLE)
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    /** Remove o vínculo de uma pessoa com um encontro (apaga a participação). */
    async desvincularDoEncontro(participacaoId: string): Promise<void> {
        const { error } = await supabase
            .from(TABLE)
            .delete()
            .eq('id', participacaoId);

        if (error) throw error;
    },

    async confirmarDados(id: string): Promise<Inscricao> {
        const { data, error } = await supabase
            .from(TABLE)
            .update({
                dados_confirmados: true,
                confirmado_em: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as Inscricao;
    },

    async alterarStatusPagamento(id: string, pago: boolean): Promise<Inscricao> {
        const { data, error } = await supabase
            .from(TABLE)
            .update({ pago_taxa: pago })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as Inscricao;
    },

    async verificarSeJaFoiParticipante(pessoaId: string): Promise<boolean> {
        const { data, error } = await supabase
            .from(TABLE)
            .select('id')
            .eq('pessoa_id', pessoaId)
            .eq('participante', true)
            .limit(1);

        if (error) throw error;
        return data && data.length > 0;
    },

    /**
     * Busca paginada de encontreiros de uma equipe específica por nome.
     * Server-side em dois passos para evitar carregar todos de uma vez.
     * Usado na seleção de mediadores de círculo.
     */
    async buscarEncontreirosDaEquipePorNome(
        encontroId: string,
        equipeId: string,
        busca: string = '',
        pagina: number = 0,
        limite: number = 10
    ): Promise<InscricaoEnriched[]> {
        let pessoaIds: string[] | null = null;

        if (busca.trim()) {
            const { data: pessoas, error: pessoasError } = await supabase
                .from('pessoas')
                .select('id')
                .ilike('nome_completo', `%${busca}%`);

            if (pessoasError) throw pessoasError;
            pessoaIds = (pessoas || []).map((p: { id: string }) => p.id);
            if (pessoaIds.length === 0) return [];
        }

        let query = supabase
            .from(TABLE)
            .select('id, pessoa_id, equipe_id, pessoas(nome_completo)')
            .eq('encontro_id', encontroId)
            .eq('participante', false)
            .eq('equipe_id', equipeId);

        if (pessoaIds !== null) {
            query = query.in('pessoa_id', pessoaIds);
        }

        const from = pagina * limite;
        const to = from + limite - 1;
        const { data, error } = await query.range(from, to);

        if (error) throw error;
        return (data || []) as unknown as InscricaoEnriched[];
    },

    /**
     * Busca paginada de participantes (jovens, participante=true) por nome.
     * Server-side em dois passos. Usado na seleção de encontristas para o círculo.
     */
    async buscarParticipantesPorNome(
        encontroId: string,
        busca: string = '',
        pagina: number = 0,
        limite: number = 10
    ): Promise<InscricaoEnriched[]> {
        let pessoaIds: string[] | null = null;

        if (busca.trim()) {
            const { data: pessoas, error: pessoasError } = await supabase
                .from('pessoas')
                .select('id')
                .ilike('nome_completo', `%${busca}%`);

            if (pessoasError) throw pessoasError;
            pessoaIds = (pessoas || []).map((p: { id: string }) => p.id);
            if (pessoaIds.length === 0) return [];
        }

        let query = supabase
            .from(TABLE)
            .select('id, pessoa_id, pessoas(nome_completo)')
            .eq('encontro_id', encontroId)
            .eq('participante', true);

        if (pessoaIds !== null) {
            query = query.in('pessoa_id', pessoaIds);
        }

        const from = pagina * limite;
        const to = from + limite - 1;
        const { data, error } = await query.range(from, to);

        if (error) throw error;
        return (data || []) as unknown as InscricaoEnriched[];
    }
};

