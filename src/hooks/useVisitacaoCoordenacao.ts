import { useState, useCallback, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { visitacaoService } from '../services/visitacaoService';
import { inscricaoService } from '../services/inscricaoService';
import { normalizeString } from '../utils/stringUtils';
import type { VisitaGrupo, VisitaParticipacaoEnriched } from '../types/visitacao';
import type { InscricaoEnriched } from '../types/inscricao';
import type { Equipe } from '../types/equipe';

interface UseVisitacaoCoordenacaoProps {
  encontroId: string;
  equipes: Equipe[];
}

export function useVisitacaoCoordenacao({ encontroId, equipes }: UseVisitacaoCoordenacaoProps) {
  // Data States
  const [grupos, setGrupos] = useState<VisitaGrupo[]>([]);
  const [participantes, setParticipantes] = useState<InscricaoEnriched[]>([]);
  const [equipeVisitacao, setEquipeVisitacao] = useState<InscricaoEnriched[]>([]);
  const [vinculos, setVinculos] = useState<VisitaParticipacaoEnriched[]>([]);
  const [selectedGrupoId, setSelectedGrupoId] = useState<string>('');

  // UI / Filter States
  const [isFetching, setIsFetching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [neighborhoodFilter, setNeighborhoodFilter] = useState('');
  
  const [filters, setFilters] = useState({
    hideLinkedToSelected: false,
    showOnlyUnmapped: false,
    showOnlyLinkedToSelected: false
  });

  const loadData = useCallback(async () => {
    if (!encontroId) return;
    setIsFetching(true);
    try {
      // 1. Carregar participantes e encontreiros
      const [allParticipantes, allEncontreiros] = await Promise.all([
        inscricaoService.listarParticipantesPorEncontro(encontroId),
        inscricaoService.listarEncontreirosPorEncontro(encontroId)
      ]);
      setParticipantes(allParticipantes);

      // 2. Identificar equipe de visitação
      const visitacaoTeam = equipes.find(e => 
        e.nome?.toLowerCase().includes('visitação') || e.nome?.toLowerCase().includes('visitacao')
      );
      
      if (visitacaoTeam) {
        setEquipeVisitacao(allEncontreiros.filter(i => i.equipe_id === visitacaoTeam.id));
      } else {
        setEquipeVisitacao(allEncontreiros);
      }

      // 3. Carregar Grupos e Vínculos
      const [gData, vData] = await Promise.all([
        visitacaoService.listarGrupos(encontroId),
        visitacaoService.listarParticipacaoPorEncontro(encontroId)
      ]);

      setGrupos(gData);
      setVinculos(vData || []);
    } catch (err: any) {
      toast.error('Erro ao carregar dados de coordenação: ' + err.message);
    } finally {
      setIsFetching(false);
    }
  }, [encontroId, equipes]);

  // Auto-seleção apenas quando necessário e sem resetar seleções manuais
  useEffect(() => {
    if (grupos.length > 0 && !selectedGrupoId) {
      setSelectedGrupoId(grupos[0].id);
    }
  }, [grupos, selectedGrupoId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Visitantes Disponíveis (para montagem de duplas)
  const visitantesDisponiveis = useMemo(() => {
    const vinculadosComoVisitantes = new Set(
      vinculos.filter(v => v.visitante).map(v => v.participacao_id)
    );
    return equipeVisitacao.filter(p => !p.coordenador && !vinculadosComoVisitantes.has(p.id));
  }, [equipeVisitacao, vinculos]);

  // Filtragem de Participantes (Memoizada para performance)
  const filteredParticipantes = useMemo(() => {
    const q = normalizeString(searchQuery);
    const n = normalizeString(neighborhoodFilter);

    return participantes.filter(p => {
      const nameMatch = normalizeString(p.pessoas?.nome_completo || '').includes(q);
      const neighborhoodMatch = normalizeString(p.pessoas?.bairro || '').includes(n);
      if (!nameMatch || !neighborhoodMatch) return false;

      const vinculo = vinculos.find(v => v.participacao_id === p.id && !v.visitante);
      const isLinkedToSelected = vinculo?.grupo_id === selectedGrupoId;
      const isUnmapped = !p.pessoas?.latitude || !p.pessoas?.longitude;

      if (filters.hideLinkedToSelected && isLinkedToSelected) return false;
      if (filters.showOnlyLinkedToSelected && !isLinkedToSelected) return false;
      if (filters.showOnlyUnmapped && !isUnmapped) return false;

      return true;
    }).sort((a, b) => (a.pessoas?.nome_completo || '').localeCompare(b.pessoas?.nome_completo || ''));
  }, [participantes, vinculos, searchQuery, neighborhoodFilter, filters, selectedGrupoId]);

  // Ações
  const handleCreateGroup = async (p1Id: string, p2Id: string) => {
    setIsLoading(true);
    try {
      const p1 = equipeVisitacao.find(p => p.id === p1Id);
      const p2 = equipeVisitacao.find(p => p.id === p2Id);
      const groupName = `${p1?.pessoas?.nome_completo?.split(' ')[0]} & ${p2?.pessoas?.nome_completo?.split(' ')[0]}`;

      const newGroup = await visitacaoService.criarGrupo({ encontro_id: encontroId, nome: groupName });
      await Promise.all([
        visitacaoService.vincular({ grupo_id: newGroup.id, participacao_id: p1Id, visitante: true }),
        visitacaoService.vincular({ grupo_id: newGroup.id, participacao_id: p2Id, visitante: true })
      ]);
      
      toast.success('Dupla criada com sucesso!');
      loadData();
      return newGroup;
    } catch (err: any) {
      toast.error('Erro ao criar dupla: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVincularParticipante = async (participacaoId: string) => {
    if (!selectedGrupoId) return;
    setIsLoading(true);
    try {
      await visitacaoService.vincular({
        grupo_id: selectedGrupoId,
        participacao_id: participacaoId,
        visitante: false,
        status: 'pendente'
      });
      toast.success('Encontrista vinculado!');
      loadData();
    } catch (err: any) {
      toast.error('Erro ao vincular: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDesvincular = async (id: string) => {
    setIsLoading(true);
    try {
      await visitacaoService.desvincular(id);
      toast.success('Vínculo removido.');
      loadData();
    } catch (err: any) {
      toast.error('Erro ao desvincular.');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    grupos,
    vinculos,
    participantes: filteredParticipantes,
    visitantesDisponiveis,
    selectedGrupoId,
    loading: isFetching,
    submitting: isLoading,
    searchQuery,
    neighborhoodFilter,
    filters,
    
    actions: {
      setSelectedGrupoId,
      setSearchQuery,
      setNeighborhoodFilter,
      setFilters,
      handleCreateGroup,
      handleVincularParticipante,
      handleDesvincular,
      refresh: loadData
    }
  };
}
