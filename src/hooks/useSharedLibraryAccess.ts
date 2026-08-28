import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { bibliotecaService } from '../services/bibliotecaService';

interface SharedLibraryAccessCacheState {
  accessKey: string;
  hasSharedItems: boolean;
  error: Error | null;
}

interface SharedLibraryAccessState {
  hasSharedItems: boolean;
  isLoading: boolean;
  error: Error | null;
}

export function useSharedLibraryAccess(): SharedLibraryAccessState {
  const { loading, profile, profileLoading, user, userParticipacao } = useAuth();
  const [state, setState] = useState<SharedLibraryAccessCacheState>({
    accessKey: '',
    hasSharedItems: false,
    error: null,
  });

  const grupoIds = profile?.grupoIds;
  const equipeId = userParticipacao?.equipe_id ?? null;
  const accessKey = user && profile
    ? `${user.id}:${grupoIds?.join(',') ?? ''}:${equipeId ?? ''}`
    : null;

  useEffect(() => {
    if (!accessKey || !profile) return;

    let cancelled = false;

    void bibliotecaService.listarItensCompartilhados({
      grupoIds: grupoIds ?? [],
      equipeId: equipeId ?? undefined,
      isAdmin: profile.permissions.includes('modulo_admin'),
    }).then((items) => {
      if (cancelled) return;
      setState({
        accessKey,
        hasSharedItems: items.pastas.length > 0 || items.arquivos.length > 0,
        error: null,
      });
    }).catch((error: unknown) => {
      if (cancelled) return;
      setState({
        accessKey,
        hasSharedItems: false,
        error: error instanceof Error ? error : new Error('Não foi possível consultar a Biblioteca.'),
      });
    });

    return () => {
      cancelled = true;
    };
  }, [accessKey, equipeId, grupoIds, profile]);

  const isCurrentResult = state.accessKey === accessKey;

  return {
    hasSharedItems: isCurrentResult && state.hasSharedItems,
    isLoading: loading || profileLoading || Boolean(accessKey && !isCurrentResult),
    error: isCurrentResult ? state.error : null,
  };
}
