import type {
  PesquisaEncontristaDetalhe,
  PesquisaEncontristaEquipeResumo,
} from '../types/pesquisaEncontrista';

export function resumirEscolhasEquipes(
  encontristas: PesquisaEncontristaDetalhe[],
): PesquisaEncontristaEquipeResumo[] {
  const resumoMap = new Map<string, PesquisaEncontristaEquipeResumo>();

  encontristas.forEach((encontrista) => {
    encontrista.preferencias.forEach((preferencia) => {
      const current = resumoMap.get(preferencia.equipeId) ?? {
        equipeId: preferencia.equipeId,
        equipeNome: preferencia.equipeNome,
        total: 0,
        primeiraOpcao: 0,
        segundaOpcao: 0,
        terceiraOpcao: 0,
        escolhas: [],
      };

      current.total += 1;
      if (preferencia.ordemPreferencia === 1) current.primeiraOpcao += 1;
      if (preferencia.ordemPreferencia === 2) current.segundaOpcao += 1;
      if (preferencia.ordemPreferencia === 3) current.terceiraOpcao += 1;
      current.escolhas.push({
        participacaoId: encontrista.participacaoId,
        nome: encontrista.nome,
        ordemPreferencia: preferencia.ordemPreferencia,
        tocaInstrumento: encontrista.tocaInstrumento,
        instrumentos: encontrista.instrumentos,
        temCarro: encontrista.temCarro,
        temMoto: encontrista.temMoto,
        observacoes: encontrista.observacoes,
        preferencias: encontrista.preferencias.map((item) => ({
          equipeId: item.equipeId,
          equipeNome: item.equipeNome,
          ordemPreferencia: item.ordemPreferencia,
        })),
      });
      current.escolhas.sort((a, b) => a.ordemPreferencia - b.ordemPreferencia || a.nome.localeCompare(b.nome, 'pt-BR'));
      resumoMap.set(preferencia.equipeId, current);
    });
  });

  return Array.from(resumoMap.values())
    .sort((a, b) => b.total - a.total || a.equipeNome.localeCompare(b.equipeNome, 'pt-BR'));
}
