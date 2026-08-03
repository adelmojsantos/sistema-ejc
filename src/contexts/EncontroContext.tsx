/**
 * EncontroContext
 *
 * Cache global da lista de encontros para eliminar queries redundantes em cada tela.
 * O `reload()` deve ser chamado após criar/editar/excluir um encontro.
 *
 * Uso:
 *   const { encontros, encontroAtivo, isLoading, reload } = useEncontros();
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { encontroService } from '../services/encontroService';
import type { Encontro } from '../types/encontro';
import { useAuth } from '../hooks/useAuth';

interface EncontroContextType {
  encontros: Encontro[];
  encontroAtivo: Encontro | null;
  encontroSelecionado: Encontro | null;
  encontroSelecionadoId: string;
  selecionarEncontro: (encontroId: string) => void;
  selecaoBloqueada: boolean;
  isLoading: boolean;
  reload: () => Promise<void>;
}

const EncontroContext = createContext<EncontroContextType | null>(null);

function readSelectedEncounter(userId?: string) {
  if (!userId) return null;
  try {
    return localStorage.getItem(`encontro-selecionado:${userId}`);
  } catch {
    return null;
  }
}

function persistSelectedEncounter(userId: string | undefined, encounterId: string) {
  if (!userId) return;
  try {
    localStorage.setItem(`encontro-selecionado:${userId}`, encounterId);
  } catch {
    // A persistência é opcional; a seleção em memória continua funcionando.
  }
}

export function EncontroProvider({ children }: { children: React.ReactNode }) {
  const { session, loading: authLoading, hasPermission, userParticipacao } = useAuth();
  const [encontros, setEncontros] = useState<Encontro[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [encontroSelecionadoId, setEncontroSelecionadoId] = useState('');

  const selecaoBloqueada = Boolean(
    userParticipacao?.coordenador
      && hasPermission('modulo_coordenador')
      && !hasPermission('modulo_admin')
      && userParticipacao.encontro_id
  );

  const reload = useCallback(async () => {
    if (!session) {
      setEncontros([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const data = await encontroService.listar();
      setEncontros(data);
    } catch (err) {
      console.error('[EncontroContext] Erro ao carregar encontros:', err);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (authLoading) return;
    reload();
  }, [authLoading, reload]);

  useEffect(() => {
    if (selecaoBloqueada && userParticipacao?.encontro_id) {
      setEncontroSelecionadoId(userParticipacao.encontro_id);
      return;
    }

    if (!encontros.length) return;
    const storageKey = session?.user?.id ? `encontro-selecionado:${session.user.id}` : null;
    const storedId = storageKey ? readSelectedEncounter(session?.user?.id) : null;
    const storedExists = storedId && encontros.some((encontro) => encontro.id === storedId);
    const nextId = storedExists
      ? storedId
      : (encontros.find((encontro) => encontro.ativo)?.id ?? encontros[0].id);
    setEncontroSelecionadoId(nextId);
  }, [encontros, session?.user?.id, selecaoBloqueada, userParticipacao?.encontro_id]);

  const selecionarEncontro = useCallback((encontroId: string) => {
    if (selecaoBloqueada) return;
    if (!encontros.some((encontro) => encontro.id === encontroId)) return;
    setEncontroSelecionadoId(encontroId);
    if (session?.user?.id) {
      persistSelectedEncounter(session.user.id, encontroId);
    }
  }, [encontros, selecaoBloqueada, session?.user?.id]);

  const encontroAtivo = encontros.find(e => e.ativo) ?? null;
  const encontroSelecionado = useMemo(
    () => encontros.find((encontro) => encontro.id === encontroSelecionadoId) ?? null,
    [encontros, encontroSelecionadoId]
  );

  return (
    <EncontroContext.Provider value={{
      encontros,
      encontroAtivo,
      encontroSelecionado,
      encontroSelecionadoId,
      selecionarEncontro,
      selecaoBloqueada,
      isLoading,
      reload,
    }}>
      {children}
    </EncontroContext.Provider>
  );
}

export function useEncontros() {
  const ctx = useContext(EncontroContext);
  if (!ctx) throw new Error('useEncontros deve ser usado dentro de <EncontroProvider>');
  return ctx;
}
