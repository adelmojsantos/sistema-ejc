import { supabase } from '../lib/supabase';
import type { ListaEsperaFormData, ListaEsperaEntry } from '../types/listaEspera';
import { encontroService } from './encontroService';
import { inscricaoService } from './inscricaoService';
import { pessoaService } from './pessoaService';

export const listaEsperaService = {
    async join(data: ListaEsperaFormData): Promise<void> {
        // Encontra o encontro ativo
        const encontros = await encontroService.listar();
        const encontroAtivo = encontros.find(e => e.ativo);

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
             throw new Error('Uma inscrição com este E-mail, CPF ou Telefone já existe na fila deste Encontro!');
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
        const { data, error } = await supabase
            .from('lista_espera')
            .select('*')
            .eq('encontro_id', encontroId)
            .eq('status', 'pendente')
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error listing registrations:', error);
            return [];
        }

        return (data || []) as ListaEsperaEntry[];
    },
    async listEfetivadosNoEncontro(encontroId: string): Promise<ListaEsperaEntry[]> {
        const { data, error } = await supabase
            .from('lista_espera')
            .select('*')
            .eq('encontro_id', encontroId)
            .eq('status', 'convertido')
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error listing registrations:', error);
            return [];
        }

        return (data || []) as ListaEsperaEntry[];
    },

    async updateStatus(id: string, status: 'pendente' | 'convertido'): Promise<void> {
        const { error } = await supabase
            .from('lista_espera')
            .update({ status })
            .eq('id', id);

        if (error) {
            console.error('Error updating status:', error);
            throw error;
        }
    },

    async efetivarListaEspera(preId: string, formData: Omit<ListaEsperaEntry, 'id' | 'created_at' | 'status'>): Promise<void> {
        try {
            // Cria a pessoa
            const novapessoaData = {
                ...formData,
                origem: 'online'
            };
            // Retira do data coisas que nao vao ter na pessoa (ex: encontro_id)
            const { encontro_id, criado_em, ...pessoaDataOnly } = novapessoaData as any;
            
            const novaPessoa = await pessoaService.criar(pessoaDataOnly);

            // Vincula inscrição no Encontro
            await inscricaoService.criar({
                pessoa_id: novaPessoa.id,
                encontro_id: encontro_id,
                participante: true,
                equipe_id: null,
                coordenador: false,
                dados_confirmados: true,
                confirmado_em: new Date().toISOString(),
                origem: 'online'
            });

            // Atualiza a flag na lista de espera
            await this.updateStatus(preId, 'convertido');
        } catch (error) {
            console.error('Erro ao efetivar', error);
            throw error;
        }
    },

    async vincularPessoaExistente(preId: string, pessoaOriginalId: string, formData: Omit<ListaEsperaEntry, 'id' | 'created_at' | 'status'>): Promise<void> {
        try {
            const { encontro_id, criado_em, ...dadosPessoa } = formData as any;
            
            // O usuário autorizou atualizar os dados originais no banco
            await pessoaService.atualizar(pessoaOriginalId, {
                nome_completo: dadosPessoa.nome_completo,
                cpf: dadosPessoa.cpf,
                data_nascimento: dadosPessoa.data_nascimento,
                email: dadosPessoa.email,
                telefone: dadosPessoa.telefone,
                comunidade: dadosPessoa.comunidade,
                endereco: dadosPessoa.endereco,
                numero: dadosPessoa.numero,
                bairro: dadosPessoa.bairro,
                cidade: dadosPessoa.cidade,
                cep: dadosPessoa.cep,
                telefone_pai: dadosPessoa.telefone_pai,
                telefone_mae: dadosPessoa.telefone_mae,
                nome_pai: dadosPessoa.nome_pai,
                nome_mae: dadosPessoa.nome_mae,
                fez_ejc_outra_paroquia: dadosPessoa.fez_ejc_outra_paroquia,
                qual_paroquia_ejc: dadosPessoa.qual_paroquia_ejc
            });

            // Vincula inscrição no Encontro
            await inscricaoService.criar({
                pessoa_id: pessoaOriginalId,
                encontro_id: encontro_id,
                participante: true,
                equipe_id: null,
                coordenador: false,
                dados_confirmados: true,
                confirmado_em: new Date().toISOString(),
                origem: 'online'
            });

            // Atualiza a flag na lista de espera
            await this.updateStatus(preId, 'convertido');
        } catch (error) {
            console.error('Erro ao vincular pessoa existente', error);
            throw error;
        }
    },

    async recusarListaEspera(id: string): Promise<void> {
        const { error } = await supabase
            .from('lista_espera')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error refusing waitlist:', error);
            throw error;
        }
    },

    async efetivarEmLote(entries: ListaEsperaEntry[]): Promise<{success: number, fails: number, suspicions: number}> {
        let success = 0;
        let fails = 0;
        let suspicions = 0;
        
        for(let entry of entries) {
            try {
                const duplicatas = await pessoaService.buscarPorSemelhanca(entry.nome_completo, entry.cpf);
                if (duplicatas && duplicatas.length > 0) {
                    suspicions++;
                    continue; // Pula este para não criar duplicado em lote
                }

                // Montar o objeto para não interferir na assinatura de Pessoa (vamos desmembrar os campos)
                const { id, created_at, status, ...formData } = entry;
                
                await this.efetivarListaEspera(id, formData);
                success++;
            } catch (err) {
                console.error(`Erro ao aprovar a entry ${entry.id}`, err);
                fails++;
            }
        }
        
        return { success, fails, suspicions };
    }
};
