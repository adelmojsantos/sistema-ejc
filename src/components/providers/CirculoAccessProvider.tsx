import type { ReactNode } from 'react';
import { CirculoSessionProvider } from '../../contexts/CirculoSessionContext';

export default function CirculoAccessProvider({ children }: { children: ReactNode }) {
  return <CirculoSessionProvider>{children}</CirculoSessionProvider>;
}
