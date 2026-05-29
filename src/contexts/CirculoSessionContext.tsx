import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { externalAccessService } from '../services/externalAccessService';

// Chave usada no sessionStorage (não localStorage — expira ao fechar a aba)
const SESSION_KEY = 'circulo_session_token';
const SESSION_META_KEY = 'circulo_session_meta';

export interface CirculoSessionMeta {
  circulo_id: number;
  encontro_id: string;
  participacao_id: string;
  nome_encontrista: string;
  expires_at: string;
}

interface CirculoSessionContextValue {
  token: string | null;
  meta: CirculoSessionMeta | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, meta: CirculoSessionMeta) => void;
  logout: () => void;
}

const CirculoSessionContext = createContext<CirculoSessionContextValue>({
  token: null,
  meta: null,
  isAuthenticated: false,
  isLoading: true,
  login: () => {},
  logout: () => {},
});

export function CirculoSessionProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [meta, setMeta] = useState<CirculoSessionMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restaura sessão do sessionStorage na montagem
  useEffect(() => {
    async function restore() {
      const storedToken = sessionStorage.getItem(SESSION_KEY);
      const storedMeta = sessionStorage.getItem(SESSION_META_KEY);

      if (!storedToken || !storedMeta) {
        setIsLoading(false);
        return;
      }

      try {
        const parsedMeta: CirculoSessionMeta = JSON.parse(storedMeta);

        // Verifica se o token ainda não expirou localmente
        if (new Date(parsedMeta.expires_at) < new Date()) {
          sessionStorage.removeItem(SESSION_KEY);
          sessionStorage.removeItem(SESSION_META_KEY);
          setIsLoading(false);
          return;
        }

        // Valida o token no servidor (reutiliza getSession do externalAccessService)
        await externalAccessService.getSession(storedToken);

        setToken(storedToken);
        setMeta(parsedMeta);
      } catch {
        // Token inválido ou expirado no servidor — limpa
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(SESSION_META_KEY);
      } finally {
        setIsLoading(false);
      }
    }

    restore();
  }, []);

  const login = useCallback((newToken: string, newMeta: CirculoSessionMeta) => {
    sessionStorage.setItem(SESSION_KEY, newToken);
    sessionStorage.setItem(SESSION_META_KEY, JSON.stringify(newMeta));
    setToken(newToken);
    setMeta(newMeta);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_META_KEY);
    setToken(null);
    setMeta(null);
  }, []);

  return (
    <CirculoSessionContext.Provider
      value={{
        token,
        meta,
        isAuthenticated: !!token && !!meta,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </CirculoSessionContext.Provider>
  );
}

export function useCirculoSession() {
  return useContext(CirculoSessionContext);
}
