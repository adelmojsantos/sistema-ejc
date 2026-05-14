/**
 * EncontroContext
 *
 * Cache global da lista de encontros para eliminar queries redundantes em cada tela.
 * O `reload()` deve ser chamado após criar/editar/excluir um encontro.
 *
 * Uso:
 *   const { encontros, encontroAtivo, isLoading, reload } = useEncontros();
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { encontroService } from '../services/encontroService';
import type { Encontro } from '../types/encontro';

interface EncontroContextType {
  encontros: Encontro[];
  encontroAtivo: Encontro | null;
  isLoading: boolean;
  reload: () => Promise<void>;
}

const EncontroContext = createContext<EncontroContextType | null>(null);

export function EncontroProvider({ children }: { children: React.ReactNode }) {
  const [encontros, setEncontros] = useState<Encontro[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await encontroService.listar();
      setEncontros(data);
    } catch (err) {
      console.error('[EncontroContext] Erro ao carregar encontros:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const encontroAtivo = encontros.find(e => e.ativo) ?? null;

  return (
    <EncontroContext.Provider value={{ encontros, encontroAtivo, isLoading, reload }}>
      {children}
    </EncontroContext.Provider>
  );
}

export function useEncontros() {
  const ctx = useContext(EncontroContext);
  if (!ctx) throw new Error('useEncontros deve ser usado dentro de <EncontroProvider>');
  return ctx;
}
