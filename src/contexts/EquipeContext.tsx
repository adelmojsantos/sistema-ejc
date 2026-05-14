/**
 * EquipeContext
 *
 * Cache global da lista de equipes para eliminar queries redundantes em cada tela.
 * O `reload()` deve ser chamado após criar/editar/excluir uma equipe.
 *
 * Uso:
 *   const { equipes, isLoading, reload } = useEquipes();
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { equipeService } from '../services/equipeService';
import type { Equipe } from '../types/equipe';

interface EquipeContextType {
  equipes: Equipe[];
  isLoading: boolean;
  reload: () => Promise<void>;
}

const EquipeContext = createContext<EquipeContextType | null>(null);

export function EquipeProvider({ children }: { children: React.ReactNode }) {
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await equipeService.listar();
      setEquipes(data);
    } catch (err) {
      console.error('[EquipeContext] Erro ao carregar equipes:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <EquipeContext.Provider value={{ equipes, isLoading, reload }}>
      {children}
    </EquipeContext.Provider>
  );
}

export function useEquipes() {
  const ctx = useContext(EquipeContext);
  if (!ctx) throw new Error('useEquipes deve ser usado dentro de <EquipeProvider>');
  return ctx;
}
