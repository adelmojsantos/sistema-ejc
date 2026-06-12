import { createContext } from 'react';
import type { Equipe } from '../types/equipe';

export interface EquipeContextType {
  equipes: Equipe[];
  isLoading: boolean;
  reload: () => Promise<void>;
}

export const EquipeContext = createContext<EquipeContextType | null>(null);
