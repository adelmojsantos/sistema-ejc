import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  encounter: {
    id: 'historico',
    nome: 'Encontro histórico',
    ativo: false,
  },
  garantirPerguntasPadrao: vi.fn(),
  obterConfig: vi.fn(),
  listarPerguntas: vi.fn(),
  listarPainel: vi.fn(),
  listarResumosIA: vi.fn(),
  listarCoordenadoresEquipe: vi.fn(),
  atualizarPublicacao: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('../../contexts/EncontroContext', () => ({
  useEncontros: () => ({
    encontroSelecionadoId: mocks.encounter.id,
    encontroSelecionado: mocks.encounter,
  }),
}));

vi.mock('../../services/pesquisaSatisfacaoService', () => ({
  pesquisaSatisfacaoService: {
    garantirPerguntasPadrao: mocks.garantirPerguntasPadrao,
    obterConfig: mocks.obterConfig,
    listarPerguntas: mocks.listarPerguntas,
    listarPainel: mocks.listarPainel,
    listarResumosIA: mocks.listarResumosIA,
    listarCoordenadoresEquipe: mocks.listarCoordenadoresEquipe,
    atualizarPublicacao: mocks.atualizarPublicacao,
  },
}));

import { AvaliacaoEncontroPage } from './AvaliacaoEncontroPage';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function painel(encontroId: string) {
  const active = encontroId === 'ativo';
  return {
    perguntas: [],
    respondentes: [{
      participacaoId: `participacao-${encontroId}`,
      equipeId: `equipe-${encontroId}`,
      equipeNome: active ? 'Equipe ativa' : 'Equipe histórica',
      status: 'pendente' as const,
      respostas: {},
      enviadoEm: null,
    }],
    totalParticipantes: 1,
    totalEnviados: 0,
    totalRascunhos: 0,
    totalPendentes: 1,
    perguntaResumos: [],
  };
}

describe('AvaliacaoEncontroPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.encounter.id = 'historico';
    mocks.encounter.nome = 'Encontro histórico';
    mocks.encounter.ativo = false;
    mocks.garantirPerguntasPadrao.mockResolvedValue([]);
    mocks.listarPerguntas.mockResolvedValue([]);
    mocks.listarPainel.mockImplementation((encontroId: string) => Promise.resolve(painel(encontroId)));
    mocks.listarResumosIA.mockResolvedValue([]);
    mocks.listarCoordenadoresEquipe.mockResolvedValue([{
      participacaoId: 'coordenador-ativo',
      nome: 'Coordenadora Ativa',
      telefone: '33999990000',
    }]);
    mocks.atualizarPublicacao.mockImplementation((encontroId: string, publicada: boolean) => Promise.resolve({
      encontro_id: encontroId,
      publicada,
      publicada_em: publicada ? new Date().toISOString() : null,
    }));
  });

  it('não mistura publicação nem equipes quando uma resposta antiga termina após a troca de encontro', async () => {
    const configHistorico = deferred<{ encontro_id: string; publicada: boolean; publicada_em: string | null }>();
    const configAtivo = deferred<{ encontro_id: string; publicada: boolean; publicada_em: string | null }>();
    mocks.obterConfig.mockImplementation((encontroId: string) => (
      encontroId === 'historico' ? configHistorico.promise : configAtivo.promise
    ));

    const view = render(<AvaliacaoEncontroPage />);
    await waitFor(() => expect(mocks.obterConfig).toHaveBeenCalledWith('historico'));

    mocks.encounter.id = 'ativo';
    mocks.encounter.nome = 'Encontro ativo';
    mocks.encounter.ativo = true;
    view.rerender(<AvaliacaoEncontroPage />);

    await waitFor(() => expect(mocks.obterConfig).toHaveBeenCalledWith('ativo'));
    expect(screen.getByRole('button', { name: 'Ver links por equipe' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeDisabled();

    await act(async () => {
      configAtivo.resolve({ encontro_id: 'ativo', publicada: true, publicada_em: new Date().toISOString() });
    });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Despublicar' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Ver links por equipe' }));
    expect((await screen.findAllByText('Equipe ativa')).length).toBeGreaterThan(0);
    expect(screen.getByText(/equipe-ativo\?encontro=ativo/)).toBeInTheDocument();
    expect(screen.queryByText('Equipe histórica')).not.toBeInTheDocument();

    await act(async () => {
      configHistorico.resolve({ encontro_id: 'historico', publicada: false, publicada_em: null });
    });

    expect(screen.getByRole('button', { name: 'Despublicar' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Publicar' })).not.toBeInTheDocument();
    expect(screen.getByText(/equipe-ativo\?encontro=ativo/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar' }));
    await waitFor(() => {
      expect(mocks.listarCoordenadoresEquipe).toHaveBeenCalledWith('ativo', 'equipe-ativo');
    });
    expect(await screen.findByText('Coordenadora Ativa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Baixar QR Code' })).toBeInTheDocument();

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    fireEvent.click(screen.getByLabelText(/Coordenadora Ativa/));
    fireEvent.click(screen.getByRole('button', { name: 'Abrir WhatsApp' }));
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/wa\.me\/5533999990000\?text=/),
      '_blank',
      'noopener,noreferrer'
    );
    openSpy.mockRestore();
  });

  it('publica somente o encontro que concluiu o carregamento', async () => {
    mocks.obterConfig.mockResolvedValue({ encontro_id: 'historico', publicada: false, publicada_em: null });
    mocks.listarPerguntas.mockResolvedValue([{
      id: 'pergunta-1',
      sectionId: 'geral',
      sectionTitle: 'Geral',
      title: 'Como foi o encontro?',
      type: 'texto',
      required: true,
      active: true,
      ordem: 1,
    }]);

    render(<AvaliacaoEncontroPage />);
    const publishButton = await screen.findByRole('button', { name: 'Publicar' });
    await waitFor(() => expect(publishButton).toBeEnabled());
    expect(screen.getByRole('button', { name: 'Ver links por equipe' })).toBeDisabled();
    fireEvent.click(publishButton);

    await waitFor(() => {
      expect(mocks.atualizarPublicacao).toHaveBeenCalledWith('historico', true);
      expect(screen.getByRole('button', { name: 'Ver links por equipe' })).toBeEnabled();
    });
  });
});
