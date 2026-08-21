import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PessoaForm } from './PessoaForm';

describe('PessoaForm draft', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(cleanup);

  it('restaura os dados digitados após remontar a inscrição', async () => {
    const storageKey = 'inscricao-draft:user-1:encontro-1';
    const props = {
      onSubmit: vi.fn().mockResolvedValue(undefined),
      onCancel: vi.fn(),
      draftStorageKey: storageKey,
    };
    const firstRender = render(<PessoaForm {...props} />);

    fireEvent.change(screen.getByRole('textbox', { name: /Nome Completo/ }), {
      target: { value: 'Pessoa de Teste' },
    });
    fireEvent(window, new Event('pagehide'));

    expect(sessionStorage.getItem(storageKey)).toContain('Pessoa de Teste');

    firstRender.unmount();
    render(<PessoaForm {...props} />);

    expect(screen.getByRole('textbox', { name: /Nome Completo/ })).toHaveValue('Pessoa de Teste');
  });

  it('não persiste rascunho quando a tela não fornece uma chave', async () => {
    render(
      <PessoaForm
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: /Nome Completo/ }), {
      target: { value: 'Pessoa de Teste' },
    });

    await new Promise((resolve) => window.setTimeout(resolve, 300));
    expect(sessionStorage.length).toBe(0);
  });
});
