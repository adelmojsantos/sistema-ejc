import type { ReactNode } from 'react';
import { EncontroProvider } from '../../contexts/EncontroContext';
import { EquipeProvider } from '../../contexts/EquipeContext';

export default function AuthenticatedDataProviders({ children }: { children: ReactNode }) {
  return (
    <EncontroProvider>
      <EquipeProvider>{children}</EquipeProvider>
    </EncontroProvider>
  );
}
