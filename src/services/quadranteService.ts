import { supabase } from '../lib/supabase';

export interface QuadranteData {
    id: string;
    foto_url: string | null;
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
            nome: string;
        };
    }[];
}

export const quadranteService = {
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
     * Obtém os dados resumidos para exibição no Quadrante público
     */
    async obterDados(token: string): Promise<QuadranteData[]> {
        // Primeiro pegamos o encontro_id pelo token
        const { data: encontro, error: eError } = await supabase
            .from('encontros')
            .select('id')
            .eq('quadrante_token', token)
            .eq('quadrante_ativo', true)
            .single();

        if (eError || !encontro) return [];

        // Buscamos todas as participações do encontro com nomes e equipes
        // E fotos (da tabela participacoes para indivíduos e equipes para coletivo)
        const { data, error } = await supabase
            .from('participacoes')
            .select(`
                id,
                foto_url,
                participante,
                equipe_id,
                pessoas (nome_completo),
                equipes (nome, foto_url),
                circulo_participacao (
                    circulos (nome)
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

        // Mesclar as fotos específicas nas participações
        const dataComFotos = (data || []).map(item => {
            if (!item.participante && item.equipes) {
                const equipeId = (item as any).equipe_id;
                const fotoBannerData = mapaFotos.get(equipeId);
                if (fotoBannerData?.url) {
                    const equipesData = item.equipes as any;
                    if (Array.isArray(equipesData)) {
                        if (equipesData[0]) {
                            equipesData[0].foto_url = fotoBannerData.url;
                            equipesData[0].foto_posicao_y = fotoBannerData.pos;
                        }
                    } else {
                        equipesData.foto_url = fotoBannerData.url;
                        equipesData.foto_posicao_y = fotoBannerData.pos;
                    }
                }
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
