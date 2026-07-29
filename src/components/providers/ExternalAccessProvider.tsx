import type { ReactNode } from 'react';
import { ExternalSessionProvider } from '../../contexts/ExternalSessionContext';

export default function ExternalAccessProvider({ children }: { children: ReactNode }) {
  return <ExternalSessionProvider>{children}</ExternalSessionProvider>;
}
