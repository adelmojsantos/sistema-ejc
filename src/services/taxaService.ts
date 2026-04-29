import type { InscricaoEnriched } from '../types/inscricao';
import type { TaxaReport } from './comprasService';

export interface TaxasStats {
  total: number;
  pagos: number;
  financeiroGeral: { pago: number; total: number };
  totalEnc: number;
  pagosEnc: number;
  financeiroEnc: { pago: number; total: number };
  totalTrab: number;
  pagosTrab: number;
  financeiroTrab: { pago: number; total: number };
}

export const taxaService = {
  /**
   * Calcula as estatísticas consolidadas de taxas para um conjunto de participantes.
   * Função pura e desacoplada da UI.
   */
  calcularStatsGeral(participantes: InscricaoEnriched[], valorTaxa: number): TaxasStats {
    const total = participantes.length;
    const pagos = participantes.filter(p => p.pago_taxa).length;
    
    const encontristas = participantes.filter(p => p.participante);
    const totalEnc = encontristas.length;
    const pagosEnc = encontristas.filter(p => p.pago_taxa).length;

    const trabalhadores = participantes.filter(p => !p.participante);
    const totalTrab = trabalhadores.length;
    const pagosTrab = trabalhadores.filter(p => p.pago_taxa).length;

    return {
      total,
      pagos,
      financeiroGeral: { pago: pagos * valorTaxa, total: total * valorTaxa },
      totalEnc,
      pagosEnc,
      financeiroEnc: { pago: pagosEnc * valorTaxa, total: totalEnc * valorTaxa },
      totalTrab,
      pagosTrab,
      financeiroTrab: { pago: pagosTrab * valorTaxa, total: totalTrab * valorTaxa }
    };
  },

  /**
   * Filtra e ordena a lista de participantes com base nos critérios da UI.
   */
  filtrarParticipantes(
    participantes: InscricaoEnriched[],
    options: {
      tab: 'encontristas' | 'equipes';
      equipeId: string;
      search: string;
    }
  ): InscricaoEnriched[] {
    const { tab, equipeId, search } = options;
    const searchTerm = search.toLowerCase();

    return participantes
      .filter(p => {
        const matchTab = tab === 'encontristas' ? p.participante : !p.participante;
        if (!matchTab) return false;

        const matchEquipe = tab === 'encontristas' || equipeId === 'all' || p.equipe_id === equipeId;
        const matchSearch = (p.pessoas?.nome_completo || '').toLowerCase().includes(searchTerm);

        return matchEquipe && matchSearch;
      })
      .sort((a, b) => (a.pessoas?.nome_completo || '').localeCompare(b.pessoas?.nome_completo || ''));
  },

  /**
   * Atualiza o relatório de taxas de forma otimista.
   */
  atualizarRelatorioOtimista(
    relatorio: TaxaReport[],
    participanteId: string,
    participantes: InscricaoEnriched[],
    novoStatus: boolean
  ): TaxaReport[] {
    const participante = participantes.find(p => p.id === participanteId);
    if (!participante) return relatorio;

    return relatorio.map(r => {
      if (r.equipe_id === participante.equipe_id) {
        return {
          ...r,
          pagos: novoStatus ? r.pagos + 1 : r.pagos - 1,
          pendentes: novoStatus ? r.pendentes - 1 : r.pendentes + 1
        };
      }
      return r;
    });
  }
};
