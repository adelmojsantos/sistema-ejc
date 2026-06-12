import { useContext } from 'react';
import { EquipeContext } from '../contexts/EquipeContextDefinition';

export function useEquipes() {
  const context = useContext(EquipeContext);
  if (!context) throw new Error('useEquipes deve ser usado dentro de <EquipeProvider>');
  return context;
}
