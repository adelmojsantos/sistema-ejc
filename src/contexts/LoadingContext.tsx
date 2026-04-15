import React, { createContext, useContext, useState, useCallback } from 'react';

interface LoadingContextType {
  setIsLoading: (loading: boolean) => void;
  isLoading: boolean;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoadingState] = useState(false);

  const setIsLoading = useCallback((loading: boolean) => {
    setIsLoadingState(loading);
  }, []);

  return (
    <LoadingContext.Provider value={{ isLoading, setIsLoading }}>
      {children}
    </LoadingContext.Provider>
  );
};

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};
