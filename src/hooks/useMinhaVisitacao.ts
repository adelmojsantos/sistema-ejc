import { useState, useCallback, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { visitacaoService } from '../services/visitacaoService';
import type { VisitaParticipacaoEnriched, VisitaGrupo } from '../types/visitacao';

interface UseMinhaVisitacaoProps {
  userParticipacao: any;
  isCoordinator: boolean;
}

export function useMinhaVisitacao({ userParticipacao, isCoordinator }: UseMinhaVisitacaoProps) {
  const [participantes, setParticipantes] = useState<VisitaParticipacaoEnriched[]>([]);
  const [loading, setLoading] = useState(true);
  const [grupos, setGrupos] = useState<VisitaGrupo[]>([]);
  const [selectedGrupoId, setSelectedGrupoId] = useState<string>(() => {
    return sessionStorage.getItem('visita_selected_grupo_id') || '';
  });
  const [grupoNome, setGrupoNome] = useState('');

  // 1. Carregar Grupos (apenas se for coordenador)
  useEffect(() => {
    async function loadGroups() {
      if (isCoordinator && userParticipacao?.encontro_id) {
        try {
          const data = await visitacaoService.listarGrupos(userParticipacao.encontro_id);
          setGrupos(data);
        } catch (err) {
          console.error('Erro ao carregar grupos:', err);
        }
      }
    }
    loadGroups();
  }, [isCoordinator, userParticipacao?.encontro_id]);

  // 2. Carregar Participantes da Dupla
  const loadParticipants = useCallback(async () => {
    if (!userParticipacao) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let targetGrupoId = selectedGrupoId;
      let targetGrupoNome = '';

      // Se não for coordenador ou não tiver grupo selecionado, busca o próprio grupo
      if (!isCoordinator || !selectedGrupoId) {
        const { data: myVinculo } = await supabase
          .from('visita_participacao')
          .select('grupo_id, visita_grupos(nome)')
          .eq('participacao_id', userParticipacao.id)
          .eq('visitante', true)
          .maybeSingle();

        if (myVinculo) {
          const grupoData = Array.isArray(myVinculo.visita_grupos) ? myVinculo.visita_grupos[0] : myVinculo.visita_grupos;
          targetGrupoId = myVinculo.grupo_id;
          targetGrupoNome = (grupoData as any)?.nome || 'Minha Dupla';
          
          if (isCoordinator && !selectedGrupoId) {
            setSelectedGrupoId(targetGrupoId);
          }
        }
      }

      if (isCoordinator && selectedGrupoId) {
        const g = grupos.find(g => g.id === selectedGrupoId);
        if (g) targetGrupoNome = g.nome || '';
      }

      setGrupoNome(targetGrupoNome);

      if (targetGrupoId) {
        const { data, error } = await supabase
          .from('visita_participacao')
          .select(`
            *,
            participacoes:participacao_id (
              id,
              pessoas (*)
            )
          `)
          .eq('grupo_id', targetGrupoId)
          .eq('visitante', false);

        if (error) throw error;
        setParticipantes((data as unknown as VisitaParticipacaoEnriched[]) || []);
      } else {
        setParticipantes([]);
      }
    } catch (err: any) {
      toast.error('Erro ao carregar escala de visita: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [userParticipacao, isCoordinator, selectedGrupoId, grupos]);

  useEffect(() => {
    loadParticipants();
  }, [loadParticipants]);

  // Stats
  const stats = useMemo(() => {
    const total = participantes.length;
    const realizadas = participantes.filter(p => p.status === 'realizada').length;
    const pendentesPagamento = participantes.filter(p => !p.taxa_paga).length;
    return { total, realizadas, pendentesPagamento };
  }, [participantes]);

  // Ações
  const handleToggleTax = async (pId: string, currentStatus: boolean) => {
    try {
      await visitacaoService.atualizarVisita(pId, { taxa_paga: !currentStatus });
      setParticipantes(prev => prev.map(p => p.id === pId ? { ...p, taxa_paga: !currentStatus } : p));
      toast.success(currentStatus ? 'Pagamento removido' : 'Pagamento registrado!');
    } catch (err: any) {
      toast.error('Erro ao atualizar pagamento.');
    }
  };

  return {
    participantes,
    grupos,
    grupoNome,
    selectedGrupoId,
    loading,
    stats,
    actions: {
      setSelectedGrupoId,
      handleToggleTax,
      refresh: loadParticipants
    }
  };
}
