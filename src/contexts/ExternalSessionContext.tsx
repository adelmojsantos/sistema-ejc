import React, { createContext, useState, useEffect, useContext } from 'react';
import { externalAccessService, type ExternalSession } from '../services/externalAccessService';

interface ExternalSessionContextType {
  token: string | null;
  session: ExternalSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
}

const ExternalSessionContext = createContext<ExternalSessionContextType | undefined>(undefined);

export function ExternalSessionProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('external_form_token'));
  const [session, setSession] = useState<ExternalSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function validateCurrentSession() {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const sessionData = await externalAccessService.getSession(token);
        setSession(sessionData);
      } catch (error) {
        console.error('Sessão externa inválida:', error);
        logout();
      } finally {
        setIsLoading(false);
      }
    }

    validateCurrentSession();
  }, [token]);

  const login = async (newToken: string) => {
    setIsLoading(true);
    try {
      const sessionData = await externalAccessService.getSession(newToken);
      setToken(newToken);
      setSession(sessionData);
      sessionStorage.setItem('external_form_token', newToken);
    } catch (error) {
      console.error('Erro ao efetuar login externo:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setSession(null);
    sessionStorage.removeItem('external_form_token');
  };

  return (
    <ExternalSessionContext.Provider 
      value={{ 
        token, 
        session, 
        isAuthenticated: !!session, 
        isLoading, 
        login, 
        logout 
      }}
    >
      {children}
    </ExternalSessionContext.Provider>
  );
}

export function useExternalSession() {
  const context = useContext(ExternalSessionContext);
  if (context === undefined) {
    throw new Error('useExternalSession deve ser usado dentro de um ExternalSessionProvider');
  }
  return context;
}
