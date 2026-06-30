import { useEffect, useState, type AnchorHTMLAttributes, type ReactNode } from 'react';
import { isPrivateStorageReference, resolveStorageReference } from '../../services/privateStorageService';

interface StorageLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  reference: string;
  children: ReactNode;
}

export function StorageLink({ reference, children, onClick, ...props }: StorageLinkProps) {
  const [resolution, setResolution] = useState({ reference: '', url: '' });
  const privateReference = isPrivateStorageReference(reference);
  const resolvedUrl = privateReference
    ? resolution.reference === reference ? resolution.url : ''
    : reference;
  const isResolving = privateReference && resolution.reference !== reference;

  useEffect(() => {
    if (!isPrivateStorageReference(reference)) return;

    let active = true;

    resolveStorageReference(reference)
      .then((url) => {
        if (active) setResolution({ reference, url });
      })
      .catch((error) => {
        console.error('Erro ao gerar acesso temporário ao comprovante:', error);
        if (active) setResolution({ reference, url: '' });
      });

    return () => {
      active = false;
    };
  }, [reference]);

  return (
    <a
      {...props}
      href={resolvedUrl || undefined}
      aria-busy={isResolving}
      aria-disabled={!resolvedUrl}
      onClick={(event) => {
        if (!resolvedUrl) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {children}
    </a>
  );
}
