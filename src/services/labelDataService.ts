import { supabase } from '../lib/supabase';
import type { LabelDataItem, LabelTeamColor } from '../types/label';

interface LabelParticipationRow {
  id: string;
  equipe_id: string | null;
  participante: boolean | null;
  coordenador: boolean | null;
  dados_confirmados: boolean | null;
  foto_url: string | null;
  pessoas: {
    nome_completo: string | null;
    telefone: string | null;
    qr_code_token: string | null;
    observacoes_saude: string | null;
  } | null;
  equipes: { nome: string | null; acesso_plenario: LabelTeamColor | null } | null;
  visita_participacao: {
    visitante: boolean | null;
    grupo_id: string | null;
    visita_grupos: { nome: string | null } | null;
  }[] | null;
  circulo_participacao: { circulos: { nome: string | null } | null }[] | null;
}

export const labelDataService = {
  async listarPorEncontro(encontroId: string): Promise<LabelDataItem[]> {
    const { data, error } = await supabase
      .from('participacoes')
      .select('id, equipe_id, participante, coordenador, dados_confirmados, foto_url, pessoas(nome_completo, telefone, qr_code_token, observacoes_saude), equipes(nome, acesso_plenario), visita_participacao(visitante, grupo_id, visita_grupos(nome)), circulo_participacao(circulos(nome))')
      .eq('encontro_id', encontroId);

    if (error) throw error;

    return ((data || []) as unknown as LabelParticipationRow[]).map<LabelDataItem>((row) => {
      const visita = row.visita_participacao?.find((item) => !item.visitante) || row.visita_participacao?.[0] || null;

      return {
        id: row.id,
        nome: row.pessoas?.nome_completo || 'Nome não informado',
        equipe: row.equipes?.nome || 'Sem equipe',
        equipeId: row.equipe_id,
        equipeCor: row.equipes?.acesso_plenario || null,
        visitaGrupoId: visita?.grupo_id || null,
        visitaGrupo: visita?.visita_grupos?.nome || 'Sem dupla',
        circulo: row.circulo_participacao?.[0]?.circulos?.nome || 'Sem círculo',
        funcao: row.coordenador ? 'Coordenador(a)' : row.participante ? 'Participante' : 'Encontreiro(a)',
        telefone: row.pessoas?.telefone || '',
        observacao: row.pessoas?.observacoes_saude || '',
        codigo: row.id.slice(0, 8).toUpperCase(),
        qrCode: row.pessoas?.qr_code_token || row.id,
        imagem: row.foto_url || '',
        tipo: row.participante ? 'participante' : 'encontreiro',
        status: row.dados_confirmados ? 'confirmado' : 'pendente',
      };
    }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  },
};
