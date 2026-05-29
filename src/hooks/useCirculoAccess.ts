import { useState } from 'react';
import { externalAccessService, type CirculoAccessParams } from '../services/externalAccessService';
import { useCirculoSession } from '../contexts/CirculoSessionContext';
import { toast } from 'react-hot-toast';

export function useCirculoAccess() {
  const { login, logout, token, meta, isAuthenticated, isLoading } = useCirculoSession();
  const [isValidating, setIsValidating] = useState(false);

  const validateAndAccess = async (
    params: CirculoAccessParams,
    nome_encontrista: string
  ) => {
    setIsValidating(true);
    try {
      const newToken = await externalAccessService.validateCirculoAccess(params);

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      login(newToken, {
        circulo_id: params.circulo_id,
        encontro_id: params.encontro_id,
        participacao_id: params.participacao_id,
        nome_encontrista,
        expires_at: expiresAt.toISOString(),
      });

      toast.success('Identificação realizada com sucesso!');
      return true;
    } catch (error: any) {
      console.error(error);
      // Mensagem genérica para não revelar qual campo está errado
      toast.error('Não foi possível validar seus dados. Verifique e tente novamente.');
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  return {
    validateAndAccess,
    isValidating,
    isLoading,
    token,
    meta,
    isAuthenticated,
    logout,
  };
}
