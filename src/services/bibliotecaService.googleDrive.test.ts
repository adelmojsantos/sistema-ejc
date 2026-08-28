import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.hoisted(() => vi.fn());
const rpc = vi.hoisted(() => vi.fn());
const getUser = vi.hoisted(() => vi.fn());
const storageUpload = vi.hoisted(() => vi.fn());
const storageRemove = vi.hoisted(() => vi.fn());
const storageFrom = vi.hoisted(() => vi.fn(() => ({
  upload: storageUpload,
  remove: storageRemove,
})));

vi.mock('../lib/supabase', () => ({
  supabase: {
    functions: { invoke },
    rpc,
    auth: { getUser },
    storage: { from: storageFrom },
  },
}));

import {
  bibliotecaService,
  isGoogleEditableFileName,
  type BibliotecaArquivo,
} from './bibliotecaService';

const managedGoogleFile: BibliotecaArquivo = {
  id: 'arquivo-1',
  nome_exibicao: 'Documento de teste',
  pasta_id: null,
  storage_path: null,
  tamanho_bytes: 0,
  tipo_mime: 'application/vnd.google-apps.document',
  origem: 'google_drive',
  google_file_id: 'arquivo-1',
  google_tipo: 'document',
  url_externa: 'https://docs.google.com/document/d/arquivo-1/edit',
  google_managed: true,
  google_sync_status: 'synced',
  google_sync_error: null,
  google_synced_at: null,
  created_at: '2026-08-28T00:00:00.000Z',
};

describe('bibliotecaService Google Drive', () => {
  beforeEach(() => {
    invoke.mockReset();
    rpc.mockReset();
    getUser.mockReset();
    storageUpload.mockReset();
    storageRemove.mockReset();
    storageFrom.mockClear();
    vi.stubGlobal('open', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('cria um documento na pasta atual pela Edge Function', async () => {
    invoke.mockResolvedValue({
      data: { file: { id: 'arquivo-1' }, syncErrors: [] },
      error: null,
    });

    const result = await bibliotecaService.criarArquivoGoogle({
      name: 'Ata da reunião',
      fileType: 'document',
      pastaId: 'pasta-1',
    });

    expect(invoke).toHaveBeenCalledWith('google-drive', {
      body: {
        action: 'create-file',
        name: 'Ata da reunião',
        fileType: 'document',
        pastaId: 'pasta-1',
      },
    });
    expect(result.syncErrors).toEqual([]);
  });

  it('renomeia o arquivo gerenciado nos dois sistemas pela Edge Function', async () => {
    invoke.mockResolvedValue({ data: { file: { id: 'arquivo-1' } }, error: null });

    await bibliotecaService.renomearArquivoGoogle('arquivo-1', 'Novo nome');

    expect(invoke).toHaveBeenCalledWith('google-drive', {
      body: { action: 'rename-file', arquivoId: 'arquivo-1', name: 'Novo nome' },
    });
  });

  it('envia exclusão gerenciada para a lixeira do Drive', async () => {
    invoke.mockResolvedValue({ data: { trashed: true }, error: null });

    await bibliotecaService.moverArquivoGoogleParaLixeira('arquivo-1');

    expect(invoke).toHaveBeenCalledWith('google-drive', {
      body: { action: 'trash-file', arquivoId: 'arquivo-1' },
    });
  });

  it('sincroniza somente o item alterado no compartilhamento', async () => {
    invoke.mockResolvedValue({
      data: { accountEmail: 'central@example.test', results: [] },
      error: null,
    });

    await bibliotecaService.sincronizarItemGoogle({ pastaId: 'pasta-1' });

    expect(invoke).toHaveBeenCalledWith('google-drive', {
      body: { action: 'sync-item', pastaId: 'pasta-1', arquivoId: null },
    });
  });

  it('move um arquivo editável existente para o Google Drive', async () => {
    invoke.mockResolvedValue({ data: { file: managedGoogleFile, syncErrors: [] }, error: null });

    await bibliotecaService.moverArquivoEditavelParaGoogle('arquivo-1');

    expect(invoke).toHaveBeenCalledWith('google-drive', {
      body: { action: 'import-file', arquivoId: 'arquivo-1' },
    });
  });

  it('envia um novo DOCX temporariamente e solicita a conversão no Google', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'usuario-1' } }, error: null });
    storageUpload.mockResolvedValue({ error: null });
    invoke.mockResolvedValue({ data: { file: managedGoogleFile, syncErrors: [] }, error: null });
    const file = new File(['documento'], 'Ata da reunião.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    const result = await bibliotecaService.uploadArquivoEditavelGoogle(file, 'pasta-1');

    expect(result.file).toEqual(managedGoogleFile);
    expect(storageFrom).toHaveBeenCalledWith('biblioteca');
    expect(storageUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^google-imports\/usuario-1\/.+_Ata_da_reuni_o\.docx$/),
      file,
      { cacheControl: '3600', upsert: false },
    );
    expect(invoke).toHaveBeenCalledWith('google-drive', {
      body: expect.objectContaining({
        action: 'import-file',
        fileName: 'Ata da reunião.docx',
        pastaId: 'pasta-1',
      }),
    });
  });

  it('roteia somente formatos editáveis para conversão no Google', () => {
    for (const name of ['arquivo.doc', 'arquivo.docx', 'arquivo.txt', 'arquivo.csv', 'arquivo.xlsx']) {
      expect(isGoogleEditableFileName(name)).toBe(true);
    }
    for (const name of ['arquivo.pdf', 'imagem.jpg', 'imagem.png']) {
      expect(isGoogleEditableFileName(name)).toBe(false);
    }
  });

  it('propaga falhas retornadas pela função sem ocultar a pendência', async () => {
    invoke.mockResolvedValue({ data: { error: 'Conta Google desconectada.' }, error: null });

    await expect(bibliotecaService.sincronizarGoogleDrive()).rejects.toThrow(
      'Conta Google desconectada.',
    );
  });

  it('explica por que o usuário sem Conta Google não pode abrir o arquivo', async () => {
    rpc.mockResolvedValue({
      data: [{ access_status: 'google_account_required', google_email: 'usuario@example.test' }],
      error: null,
    });

    await expect(bibliotecaService.abrirArquivo(managedGoogleFile)).rejects.toThrow(
      'não está associado a uma Conta Google',
    );

    expect(window.open).not.toHaveBeenCalled();
  });

  it('abre silenciosamente o arquivo quando a permissão foi concedida', async () => {
    rpc.mockResolvedValue({
      data: [{ access_status: 'granted', google_email: 'usuario@gmail.com' }],
      error: null,
    });

    await bibliotecaService.abrirArquivo(managedGoogleFile);

    expect(window.open).toHaveBeenCalledWith(
      'https://docs.google.com/document/d/arquivo-1/edit',
      '_blank',
      'noopener,noreferrer',
    );
  });
});
