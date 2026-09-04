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

  it('adota um link existente usando os metadados do Google quando o nome não é informado', async () => {
    invoke.mockResolvedValue({ data: { file: managedGoogleFile }, error: null });

    await bibliotecaService.cadastrarReferenciaGoogle({
      url: 'https://drive.google.com/file/d/arquivo-google-123/view',
      pastaId: 'pasta-1',
    });

    expect(invoke).toHaveBeenCalledWith('google-drive', {
      body: {
        action: 'adopt-existing-file',
        fileId: 'arquivo-google-123',
        pastaId: 'pasta-1',
        displayName: null,
      },
    });
  });

  it('busca inclusive itens ignorados quando solicitado', async () => {
    invoke.mockResolvedValue({ data: { items: [] }, error: null });

    await bibliotecaService.buscarDiferencasPastaGoogle('pasta-1', true);

    expect(invoke).toHaveBeenCalledWith('google-drive', {
      body: { action: 'scan-folder-differences', pastaId: 'pasta-1', showIgnored: true },
    });
  });

  it('preserva o destino e o caminho de novidades encontradas em subpastas', async () => {
    invoke.mockResolvedValue({
      data: {
        items: [{
          id: 'arquivo-google-subpasta',
          name: 'novo.pdf',
          mimeType: 'application/pdf',
          itemType: 'file',
          sizeBytes: 1024,
          ignored: false,
          targetFolderId: 'subpasta-1',
          path: 'Teste EJC/Subpasta EJC',
        }],
        missingItems: [],
      },
      error: null,
    });

    const result = await bibliotecaService.buscarDiferencasPastaGoogle('pasta-raiz');

    expect(result.items[0]).toMatchObject({
      id: 'arquivo-google-subpasta',
      targetFolderId: 'subpasta-1',
      path: 'Teste EJC/Subpasta EJC',
    });
  });

  it('envia separadamente itens selecionados e ignorados na conciliação da pasta', async () => {
    invoke.mockResolvedValue({
      data: { addedFiles: 1, addedFolders: 0, skipped: 0 },
      error: null,
    });

    await bibliotecaService.importarItensPastaGoogle('pasta-1', ['arquivo-google-123'], ['arquivo-google-456']);

    expect(invoke).toHaveBeenCalledWith('google-drive', {
      body: {
        action: 'import-folder-items',
        pastaId: 'pasta-1',
        itemIds: ['arquivo-google-123'],
        ignoredIds: ['arquivo-google-456'],
      },
    });
  });

  it('remove registros ausentes somente da Biblioteca pela Edge Function', async () => {
    invoke.mockResolvedValue({
      data: { deletedFiles: 1, deletedFolders: 0, errors: [] },
      error: null,
    });

    await bibliotecaService.removerItensAusentesDaBiblioteca({
      folderIds: [],
      fileIds: ['arquivo-1'],
      confirmation: 'REMOVER',
    });

    expect(invoke).toHaveBeenCalledWith('google-drive', {
      body: {
        action: 'remove-missing-library-items',
        folderIds: [],
        fileIds: ['arquivo-1'],
        confirmation: 'REMOVER',
      },
    });
  });

  it('limita a sincronização forçada aos arquivos informados', async () => {
    invoke.mockResolvedValueOnce({
      data: { accountEmail: 'drive@example.com', results: [] },
      error: null,
    });
    const arquivoIds = Array.from({ length: 30 }, (_, index) => `arquivo-${index + 1}`);

    await bibliotecaService.sincronizarItemGoogle({ arquivoIds });

    expect(invoke).toHaveBeenCalledWith('google-drive', {
      body: {
        action: 'sync-item',
        pastaId: null,
        arquivoId: null,
        arquivoIds: arquivoIds.slice(0, 25),
      },
    });
  });

  it('envia a confirmação padronizada para exclusão recursiva', async () => {
    invoke.mockResolvedValueOnce({
      data: { deletedFiles: 2, deletedFolders: 1, errors: [] },
      error: null,
    });

    await bibliotecaService.excluirItensRecursivamente({
      folderIds: ['pasta-1'],
      fileIds: ['arquivo-1'],
      confirmation: 'EXCLUIR',
    });

    expect(invoke).toHaveBeenCalledWith('google-drive', {
      body: {
        action: 'delete-items-recursively',
        folderIds: ['pasta-1'],
        fileIds: ['arquivo-1'],
        confirmation: 'EXCLUIR',
      },
    });
  });

  it('inicia uma conexão temporária com outro Drive', async () => {
    invoke.mockResolvedValue({
      data: { authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=teste' },
      error: null,
    });

    const authorizationUrl = await bibliotecaService.iniciarImportacaoOutroDrive();

    expect(authorizationUrl).toContain('accounts.google.com');
    expect(invoke).toHaveBeenCalledWith('google-drive', {
      body: { action: 'start-import-oauth' },
    });
  });

  it('envia os identificadores das pastas e arquivos selecionados para inspeção', async () => {
    invoke.mockResolvedValue({
      data: {
        folder: { id: 'pasta-origem', name: 'Acervo antigo' },
        preview: { totalReturned: 0, folders: 0, files: 0, hasMore: false, items: [] },
      },
      error: null,
    });

    await bibliotecaService.inspecionarItensOutroDrive(['pasta-origem', 'arquivo-origem']);

    expect(invoke).toHaveBeenCalledWith('google-drive', {
      body: { action: 'inspect-import-items', itemIds: ['pasta-origem', 'arquivo-origem'] },
    });
  });

  it('continua e confirma o inventário sem iniciar uma cópia', async () => {
    invoke
      .mockResolvedValueOnce({
        data: {
          done: true,
          inventory: { folders: 1, files: 2, items: 3, sizeBytes: 1024, pendingFolders: 0, sample: [] },
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: { confirmed: true }, error: null });

    await bibliotecaService.processarInventarioOutroDrive();
    await bibliotecaService.confirmarInventarioOutroDrive();

    expect(invoke).toHaveBeenNthCalledWith(1, 'google-drive', {
      body: { action: 'process-import-inventory' },
    });
    expect(invoke).toHaveBeenNthCalledWith(2, 'google-drive', {
      body: { action: 'confirm-import-inventory' },
    });
  });

  it('inicia e continua a cópia somente pelas ações administrativas dedicadas', async () => {
    invoke
      .mockResolvedValueOnce({
        data: { started: true, progress: { pending: 2, processing: 0, copied: 0, errors: 0, skipped: 0 } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { done: true, status: 'completed', progress: { pending: 0, processing: 0, copied: 2, errors: 0, skipped: 0 } },
        error: null,
      });

    await bibliotecaService.iniciarCopiaOutroDrive();
    await bibliotecaService.processarCopiaOutroDrive();

    expect(invoke).toHaveBeenNthCalledWith(1, 'google-drive', {
      body: { action: 'start-import-copy' },
    });
    expect(invoke).toHaveBeenNthCalledWith(2, 'google-drive', {
      body: { action: 'process-import-copy' },
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
