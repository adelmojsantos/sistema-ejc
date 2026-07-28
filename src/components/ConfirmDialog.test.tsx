import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('expõe semântica de diálogo e posiciona o foco na ação principal', async () => {
    render(
      <ConfirmDialog
        isOpen
        title="Excluir registro"
        message="Esta ação não pode ser desfeita."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isDestructive
      />
    );

    const dialog = screen.getByText('Excluir registro').closest('[role="dialog"]');
    const confirmButton = screen.getByText('Confirmar').closest('button');

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Excluir registro');
    await waitFor(() => expect(confirmButton).toHaveFocus());
  });

  it('permite cancelar com Escape', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        isOpen
        title="Excluir registro"
        message="Confirme a exclusão."
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    await user.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
