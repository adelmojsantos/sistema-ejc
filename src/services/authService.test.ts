import { beforeEach, describe, expect, it, vi } from 'vitest';

const resetPasswordForEmail = vi.hoisted(() => vi.fn());

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail,
    },
  },
}));

import { authService } from './authService';

describe('authService.resetPassword', () => {
  beforeEach(() => {
    resetPasswordForEmail.mockReset();
    resetPasswordForEmail.mockResolvedValue({ error: null });
  });

  it('normaliza o e-mail e usa a rota segura de redefinição', async () => {
    await authService.resetPassword('  Pessoa@Example.com ');

    expect(resetPasswordForEmail).toHaveBeenCalledWith(
      'pessoa@example.com',
      {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      }
    );
  });

  it('propaga falhas de envio sem redefinir a senha localmente', async () => {
    const error = new Error('rate limit');
    resetPasswordForEmail.mockResolvedValue({ error });

    await expect(authService.resetPassword('pessoa@example.com')).rejects.toBe(error);
  });
});
