/**
 * EquipeContext
 *
 * Cache global da lista de equipes para eliminar queries redundantes em cada tela.
 * O `reload()` deve ser chamado após criar/editar/excluir uma equipe.
 *
 * Uso:
 *   const { equipes, isLoading, reload } = useEquipes();
 */
import React, { useState, useEffect, useCallback } from 'react';
import { equipeService } from '../services/equipeService';
import type { Equipe } from '../types/equipe';
import { EquipeContext } from './EquipeContextDefinition';
import { useAuth } from '../hooks/useAuth';

export function EquipeProvider({ children }: { children: React.ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!session) {
      setEquipes([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const data = await equipeService.listar();
      setEquipes(data);
    } catch (err) {
      console.error('[EquipeContext] Erro ao carregar equipes:', err);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (authLoading) return;
    reload();
  }, [authLoading, reload]);

  return (
    <EquipeContext.Provider value={{ equipes, isLoading, reload }}>
      {children}
    </EquipeContext.Provider>
  );
}
