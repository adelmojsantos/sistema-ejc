import { supabase } from '../lib/supabase';

export interface QuadranteData {
    id: string;
    foto_url: string | null;
    foto_posicao_y?: number | null;
    participante: boolean; // Novo campo para separar encontristas de encontreiros
    pessoas: {
        nome_completo: string;
    };
    equipes?: {
        nome: string;
        foto_url: string | null;
        foto_posicao_y?: number;
    };
    circulo_participacao?: {
        circulos: {
            id: number;
            nome: string;
            imagem_url: string | null;
        };
    }[];
    circulo_mediadores_foto?: {
        foto_url: string | null;
        foto_posicao_y: number | null;
    } | null;
}

export interface QuadrantePublicInfo {
    nome: string;
    quadrante_ativo: boolean;
    tem_pin: boolean;
}

type QuadranteRawData = Omit<QuadranteData, 'equipes' | 'circulo_mediadores_foto'> & {
    equipe_id: string | number | null;
    equipes?: QuadranteData['equipes'] | QuadranteData['equipes'][];
    circulo_mediadores_foto?: QuadranteData['circulo_mediadores_foto'];
};

export const quadranteService = {
    /**
     * Obtém metadados seguros para decidir o fluxo de acesso sem expor o PIN.
     */
    async obterInfoPublica(token: string): Promise<QuadrantePublicInfo | null> {
        const { data, error } = await supabase.rpc('get_quadrante_public_info', {
            p_token: token
        });

        if (error) {
            console.error('Erro ao buscar informações públicas do quadrante:', error);
            return null;
        }

        const row = Array.isArray(data) ? data[0] : data;
        return (row as QuadrantePublicInfo | undefined) || null;
    },

    /**
     * Valida o acesso ao quadrante usando o token e PIN
     */
    async validarAcesso(token: string, pin: string): Promise<boolean> {
        const { data, error } = await supabase.rpc('validate_quadrante_access', {
            p_token: token,
            p_pin: pin || null
        });

        if (error) {
            console.error('Erro ao validar acesso ao quadrante:', error);
            return false;
        }

        return !!data;
    },

    /**
     * Obtém os dados resumidos para exibição no Quadrante público.
     * @param ignorarAtivo - Se true, retorna dados mesmo que o quadrante não esteja publicado
     *                       (usar apenas para usuários logados — admin/secretaria)
     */
    async obterDados(token: string, ignorarAtivo = false): Promise<QuadranteData[]> {
        // Primeiro pegamos o encontro_id pelo token
        let query = supabase
            .from('encontros')
            .select('id')
            .eq('quadrante_token', token);

        // Apenas o público geral precisa do filtro de ativo
        if (!ignorarAtivo) {
            query = query.eq('quadrante_ativo', true);
        }

        const { data: encontro, error: eError } = await query.single();

        if (eError || !encontro) return [];

        // Buscamos todas as participações do encontro com nomes e equipes
        // E fotos (da tabela participacoes para indivíduos e equipes para coletivo)
        const { data, error } = await supabase
            .from('participacoes')
            .select(`
                id,
                foto_url,
                foto_posicao_y,
                participante,
                equipe_id,
                pessoas (nome_completo),
                equipes (nome, foto_url),
                circulo_participacao (
                    circulos (id, nome, imagem_url)
                )
            `)
            .eq('encontro_id', encontro.id)
            .order('foto_url', { ascending: false });

        if (error) {
            console.error('Erro ao buscar dados do quadrante:', error);
            return [];
        }

        // --- BUSCAR FOTOS DAS EQUIPES (BANNER) ---
        // Buscamos as fotos específicas por encontro da tabela equipe_confirmacoes
        const { data: fotosEquipe } = await supabase
            .from('equipe_confirmacoes')
            .select('equipe_id, foto_url, foto_posicao_y')
            .eq('encontro_id', encontro.id);

        const mapaFotos = new Map(
            (fotosEquipe || []).map(f => [f.equipe_id, { url: f.foto_url, pos: f.foto_posicao_y }])
        );

        const { data: fotosMediadores } = await supabase
            .from('circulo_mediadores_fotos')
            .select('circulo_id, foto_url, foto_posicao_y')
            .eq('encontro_id', encontro.id);

        const mapaFotosMediadores = new Map(
            (fotosMediadores || []).map(f => [f.circulo_id, { url: f.foto_url, pos: f.foto_posicao_y }])
        );

        // Mesclar as fotos específicas nas participações
        const dataComFotos = ((data || []) as unknown as QuadranteRawData[]).map(item => {
            if (!item.participante && item.equipes) {
                const equipeId = item.equipe_id;
                const fotoBannerData = mapaFotos.get(equipeId);
                if (fotoBannerData?.url) {
                    if (Array.isArray(item.equipes)) {
                        if (item.equipes[0]) {
                            item.equipes[0].foto_url = fotoBannerData.url;
                            item.equipes[0].foto_posicao_y = fotoBannerData.pos ?? undefined;
                        }
                    } else {
                        item.equipes.foto_url = fotoBannerData.url;
                        item.equipes.foto_posicao_y = fotoBannerData.pos ?? undefined;
                    }
                }
            }

            const circuloRel = item.circulo_participacao?.[0];
            const circuloId = circuloRel?.circulos?.id;
            const fotoMediadores = circuloId ? mapaFotosMediadores.get(circuloId) : null;
            if (fotoMediadores) {
                item.circulo_mediadores_foto = {
                    foto_url: fotoMediadores.url,
                    foto_posicao_y: fotoMediadores.pos
                };
            }

            return item;
        });

        return dataComFotos as unknown as QuadranteData[];
    },

    async atualizarFotoConfirmacao(confirmacaoId: string, fotoUrl: string): Promise<void> {
        const { error } = await supabase
            .from('equipe_confirmacoes')
            .update({ foto_url: fotoUrl })
            .eq('id', confirmacaoId);

        if (error) throw error;
    }
};
