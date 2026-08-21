import { supabase } from '../lib/supabase';
import type { ListaEsperaFormData, ListaEsperaEntry } from '../types/listaEspera';
import { encontroService } from './encontroService';
import { pessoaService } from './pessoaService';

interface AprovacaoListaEsperaResult {
    pessoa_id: string;
    participacao_id: string;
    lista_espera_id: string;
}

function parseAprovacaoResult(value: unknown): AprovacaoListaEsperaResult {
    if (!value || typeof value !== 'object') {
        throw new Error('A aprovação retornou uma resposta inválida.');
    }
    const result = value as Partial<AprovacaoListaEsperaResult>;
    if (!result.pessoa_id || !result.participacao_id) {
        throw new Error('A aprovação retornou uma resposta incompleta.');
    }
    return {
        pessoa_id: result.pessoa_id,
        participacao_id: result.participacao_id,
        lista_espera_id: result.lista_espera_id || '',
    };
}

async function updateApprovedPersonApproximateLocation(pessoaId: string): Promise<void> {
    try {
        await pessoaService.atualizarLocalizacaoAproximada(pessoaId);
    } catch {
        // A inscrição já foi aprovada. Geolocalização é complementar e pode ser repetida depois.
    }
}

export const listaEsperaService = {
    async join(data: ListaEsperaFormData): Promise<void> {
        // Encontra o encontro ativo
        const encontroAtivo = await encontroService.obterInscricaoPublicaAtiva();

        if (!encontroAtivo) {
            throw new Error('Não há encontro ativo no momento.');
        }

        // Verifica o limite
        if (encontroAtivo.limite_vagas_online <= 0) {
            throw new Error('As inscrições online estão indisponíveis.');
        }

        const vagasCount = await this.getOnlineRegistrationsCount(encontroAtivo.id);
        if (vagasCount >= encontroAtivo.limite_vagas_online) {
            throw new Error('As vagas online já esgotaram!');
        }

        // Verifica duplicidade (by-pass RLS usando RPC)
        const checkPayload = {
            p_encontro_id: encontroAtivo.id,
            p_email: data.email?.trim() || null,
            p_cpf: data.cpf || null,
            p_telefone: data.telefone || null,
        };

        const { data: existente } = await supabase.rpc('check_duplicate_registration', checkPayload);

        if (existente) {
             throw new Error('Já existe uma inscrição ou participação neste encontro com este e-mail, CPF ou telefone.');
        }

        const { error } = await supabase
            .from('lista_espera')
            .insert([
                {
                    ...data,
                    encontro_id: encontroAtivo.id,
                    origem: 'online',
                    status: 'pendente'
                }
            ]);

        if (error) {
            console.error('Error joining waitlist:', error);
            throw new Error('Não foi possível realizar sua inscrição no momento. Por favor, tente novamente mais tarde.');
        }
    },

    async getOnlineRegistrationsCount(encontroId: string): Promise<number> {
        const { data, error } = await supabase
            .rpc('get_public_waitlist_count', { p_encontro_id: encontroId });

        if (error) {
            console.error('Error fetching online capacity:', error);
            return 0;
        }

        return data || 0;
    },

    async listPendentesNoEncontro(encontroId: string): Promise<ListaEsperaEntry[]> {
        const COLS = 'id, nome_completo, cpf, email, telefone, data_nascimento, bairro, cidade, endereco, numero, complemento, estado, cep, comunidade, created_at, criado_em, fez_ejc_outra_paroquia, qual_paroquia_ejc, status, encontro_id, origem, nome_pai, nome_mae, telefone_pai, telefone_mae, outros_contatos';
        const { data, error } = await supabase
            .from('lista_espera')
            .select(COLS)
            .eq('encontro_id', encontroId)
            .eq('status', 'pendente')
            .order('nome_completo', { ascending: true });

        if (error) {
            console.error('Error listing registrations:', error);
            return [];
        }

        return (data || []) as ListaEsperaEntry[];
    },
    async listEfetivadosNoEncontro(encontroId: string): Promise<ListaEsperaEntry[]> {
        const COLS = 'id, nome_completo, cpf, email, telefone, data_nascimento, bairro, cidade, endereco, numero, complemento, estado, cep, comunidade, created_at, criado_em, fez_ejc_outra_paroquia, qual_paroquia_ejc, status, encontro_id, origem, nome_pai, nome_mae, telefone_pai, telefone_mae, outros_contatos';
        const { data, error } = await supabase
            .from('lista_espera')
            .select(COLS)
            .eq('encontro_id', encontroId)
            .eq('status', 'convertido')
            .order('nome_completo', { ascending: true });

        if (error) {
            console.error('Error listing registrations:', error);
            return [];
        }

        return (data || []) as ListaEsperaEntry[];
    },

    async listReprovadosNoEncontro(encontroId: string): Promise<ListaEsperaEntry[]> {
        const COLS = 'id, nome_completo, cpf, email, telefone, data_nascimento, bairro, cidade, endereco, numero, complemento, estado, cep, comunidade, created_at, criado_em, fez_ejc_outra_paroquia, qual_paroquia_ejc, status, encontro_id, origem, nome_pai, nome_mae, telefone_pai, telefone_mae, outros_contatos';
        const { data, error } = await supabase
            .from('lista_espera')
            .select(COLS)
            .eq('encontro_id', encontroId)
            .eq('status', 'reprovado')
            .order('nome_completo', { ascending: true });

        if (error) {
            console.error('Error listing registrations:', error);
            return [];
        }

        return (data || []) as ListaEsperaEntry[];
    },

    async updateStatus(id: string, status: 'pendente' | 'convertido' | 'reprovado'): Promise<void> {
        const { error } = await supabase
            .from('lista_espera')
            .update({ status })
            .eq('id', id);

        if (error) {
            console.error('Error updating status:', error);
            throw error;
        }
    },

    async efetivarListaEspera(preId: string, _formData: Omit<ListaEsperaEntry, 'id' | 'created_at' | 'status'>): Promise<void> {
        const { data, error } = await supabase.rpc('aprovar_lista_espera', {
            p_lista_espera_id: preId,
            p_pessoa_id: null,
        });
        if (error) throw error;
        const result = parseAprovacaoResult(data);
        await updateApprovedPersonApproximateLocation(result.pessoa_id);
    },

    async vincularPessoaExistente(preId: string, pessoaOriginalId: string, _formData: Omit<ListaEsperaEntry, 'id' | 'created_at' | 'status'>): Promise<void> {
        const { data, error } = await supabase.rpc('aprovar_lista_espera', {
            p_lista_espera_id: preId,
            p_pessoa_id: pessoaOriginalId,
        });
        if (error) throw error;
        const result = parseAprovacaoResult(data);
        await updateApprovedPersonApproximateLocation(result.pessoa_id);
    },

    async recusarListaEspera(id: string): Promise<void> {
        await this.updateStatus(id, 'reprovado');
    },

    async restaurarListaEspera(id: string): Promise<void> {
        await this.updateStatus(id, 'pendente');
    },

    async atualizar(id: string, data: Partial<ListaEsperaFormData>): Promise<void> {
        const { error } = await supabase
            .from('lista_espera')
            .update(data)
            .eq('id', id);

        if (error) {
            console.error('Error updating registration:', error);
            throw error;
        }
    },

    async efetivarEmLote(entries: ListaEsperaEntry[]): Promise<{success: number, fails: number, suspicions: number}> {
        let success = 0;
        let fails = 0;
        let suspicions = 0;
        
        for(const entry of entries) {
            try {
                const duplicatas = await pessoaService.buscarPorSemelhanca(entry.nome_completo, entry.cpf);
                if (duplicatas && duplicatas.length > 0) {
                    suspicions++;
                    continue; // Pula este para não criar duplicado em lote
                }

                // Montar o objeto para não interferir na assinatura de Pessoa (vamos desmembrar os campos)
                // Montar o objeto para não interferir na assinatura de Pessoa
                const { id: entryId, ...formData } = entry;
                
                await this.efetivarListaEspera(entryId, formData as unknown as Omit<ListaEsperaEntry, 'id' | 'created_at' | 'status'>);
                success++;
            } catch (err) {
                console.error(`Erro ao aprovar a entry ${entry.id}`, err);
                fails++;
            }
        }
        
        return { success, fails, suspicions };
    }
};
