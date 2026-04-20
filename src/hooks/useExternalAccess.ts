import { useState } from 'react';
import { externalAccessService, type ExternalAccessParams } from '../services/externalAccessService';
import { useExternalSession } from '../contexts/ExternalSessionContext';
import { toast } from 'react-hot-toast';

export function useExternalAccess() {
  const { login, logout, session, isAuthenticated, isLoading: isSessionLoading } = useExternalSession();
  const [isValidating, setIsValidating] = useState(false);

  const validateAndAccess = async (params: ExternalAccessParams) => {
    setIsValidating(true);
    try {
      const token = await externalAccessService.validateExternalAccess(params);
      await login(token);
      toast.success('Identificação realizada com sucesso!');
      return true;
    } catch (error: any) {
      console.error(error);
      // Erro genérico conforme requisito de segurança
      toast.error('Não foi possível validar seus dados. Verifique e tente novamente.');
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  return {
    validateAndAccess,
    isValidating,
    isSessionLoading,
    session,
    isAuthenticated,
    logout
  };
}
