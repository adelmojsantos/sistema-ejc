import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { comprasService, type TaxaReport } from '../services/comprasService';
import { equipeService } from '../services/equipeService';
import { inscricaoService } from '../services/inscricaoService';
import { taxaService } from '../services/taxaService';
import type { Equipe } from '../types/equipe';
import type { InscricaoEnriched } from '../types/inscricao';
import { useDebounce } from './useDebounce';

export type TaxaTab = 'encontristas' | 'equipes';

interface UseTaxasProps {
  encontroId: string;
  valorTaxa: number;
}

export function useTaxas({ encontroId, valorTaxa }: UseTaxasProps) {
  // Estados de Dados
  const [participantes, setParticipantes] = useState<InscricaoEnriched[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [relatorioTaxas, setRelatorioTaxas] = useState<TaxaReport[]>([]);
  
  // Estados de UI/Filtros
  const [activeTab, setActiveTab] = useState<TaxaTab>('encontristas');
  const [selectedEquipeId, setSelectedEquipeId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 400);

  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Carregamento de Dados
  const loadData = useCallback(async () => {
    if (!encontroId) return;
    setLoading(true);
    try {
      const [partsData, eqData, relData] = await Promise.all([
        inscricaoService.listarResumoPorEncontro(encontroId),
        equipeService.listar(),
        comprasService.listarRelatorioTaxas(encontroId)
      ]);
      setParticipantes(partsData);
      setEquipes(eqData);
      setRelatorioTaxas(relData);
    } catch (error) {
      console.error('Erro ao carregar dados de taxas:', error);
      toast.error('Erro ao carregar dados de taxas.');
    } finally {
      setLoading(false);
    }
  }, [encontroId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Cálculos de Domínio (Delegados ao Service)
  const stats = useMemo(() => 
    taxaService.calcularStatsGeral(participantes, valorTaxa),
    [participantes, valorTaxa]
  );

  const filteredParticipantes = useMemo(() => 
    taxaService.filtrarParticipantes(participantes, {
      tab: activeTab,
      equipeId: selectedEquipeId,
      search: debouncedSearch
    }),
    [participantes, activeTab, selectedEquipeId, debouncedSearch]
  );

  // Ações/Mutações
  const togglePagamento = async (id: string, currentStatus: boolean) => {
    setUpdatingId(id);
    const novoStatus = !currentStatus;
    try {
      await inscricaoService.alterarStatusPagamento(id, novoStatus);
      
      // Atualização Local Sincronizada (Otimista)
      setParticipantes(prev => prev.map(p => p.id === id ? { ...p, pago_taxa: novoStatus } : p));
      setRelatorioTaxas(prev => taxaService.atualizarRelatorioOtimista(prev, id, participantes, novoStatus));

      toast.success('Status de pagamento atualizado!');
    } catch (error) {
      console.error('Erro ao atualizar pagamento:', error);
      toast.error('Erro ao atualizar pagamento.');
    } finally {
      setUpdatingId(null);
    }
  };

  return {
    // Dados
    participantes: filteredParticipantes,
    equipes,
    relatorioTaxas,
    stats,
    loading,
    updatingId,
    
    // UI State
    activeTab,
    selectedEquipeId,
    searchTerm,
    
    // Actions
    actions: {
      setActiveTab,
      setSelectedEquipeId,
      setSearchTerm,
      togglePagamento,
      refresh: loadData
    }
  };
}
