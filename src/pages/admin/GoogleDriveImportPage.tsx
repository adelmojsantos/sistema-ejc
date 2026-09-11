import { ArrowLeft, CheckCircle2, Clipboard, Cloud, FolderSearch, Loader, ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  bibliotecaService,
  type GoogleDriveCopyProgress,
  type GoogleDriveFolderPreview,
  type GoogleDriveImportStatus,
} from '../../services/bibliotecaService';
import './GoogleDriveImportPage.css';

export function GoogleDriveImportPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<GoogleDriveImportStatus | null>(null);
  const [preview, setPreview] = useState<GoogleDriveFolderPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [copyProgress, setCopyProgress] = useState<GoogleDriveCopyProgress | null>(null);
  const [folderUrl, setFolderUrl] = useState('');

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await bibliotecaService.obterStatusImportacaoOutroDrive());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível consultar a importação.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const inspectSharedFolder = async () => {
    if (!folderUrl.trim()) {
      toast.error('Cole o link da pasta compartilhada.');
      return;
    }
    setActionLoading(true);
    try {
      let result = await bibliotecaService.inspecionarPastaCompartilhadaOutroDrive(folderUrl);
      setPreview(result);
      while (!result.done) {
        const progress = await bibliotecaService.processarInventarioOutroDrive();
        result = { ...result, ...progress, folder: result.folder };
        setPreview(result);
      }
      await loadStatus();
      toast.success('Inventário completo. Revise o resumo antes de confirmar.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível acessar a pasta compartilhada.');
    } finally {
      setActionLoading(false);
    }
  };

  const resumeInventory = async () => {
    if (!status?.selectedFolderId || !status.selectedFolderName) return;
    setActionLoading(true);
    try {
      let progress = await bibliotecaService.processarInventarioOutroDrive();
      let result: GoogleDriveFolderPreview = {
        folder: { id: status.selectedFolderId, name: status.selectedFolderName },
        ...progress,
      };
      setPreview(result);
      while (!result.done) {
        progress = await bibliotecaService.processarInventarioOutroDrive();
        result = { ...result, ...progress };
        setPreview(result);
      }
      await loadStatus();
      toast.success('Inventário completo. Revise o resumo antes de confirmar.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível continuar o inventário.');
    } finally {
      setActionLoading(false);
    }
  };

  const runCopy = async (start: boolean) => {
    setActionLoading(true);
    try {
      let result = start
        ? await bibliotecaService.iniciarCopiaOutroDrive()
        : await bibliotecaService.processarCopiaOutroDrive();
      setCopyProgress(result.progress);
      while (!result.done) {
        result = await bibliotecaService.processarCopiaOutroDrive();
        setCopyProgress(result.progress);
      }
      await loadStatus();
      if (result.status === 'completed_with_errors') {
        toast.error('A importação terminou com itens que precisam de revisão.');
      } else {
        toast.success('Acervo copiado para a raiz da Biblioteca.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível continuar a cópia.');
    } finally {
      setActionLoading(false);
    }
  };

  const retryCopyErrors = async () => {
    setActionLoading(true);
    try {
      const result = await bibliotecaService.repetirErrosCopiaOutroDrive();
      setCopyProgress(result.progress);
      setActionLoading(false);
      await runCopy(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível repetir os itens com erro.');
      setActionLoading(false);
    }
  };

  const copyServiceAccountEmail = async () => {
    if (!status?.serviceAccountEmail) return;
    try {
      await navigator.clipboard.writeText(status.serviceAccountEmail);
      toast.success('E-mail copiado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível copiar o e-mail.');
    }
  };

  const revokeSource = async () => {
    setActionLoading(true);
    try {
      await bibliotecaService.revogarImportacaoOutroDrive();
      setPreview(null);
      await loadStatus();
      toast.success('Importação cancelada. Se desejar, remova também o compartilhamento no Google Drive.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível remover a conexão.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <main className="drive-import-page page-fade-in">
      <button type="button" className="drive-import-back" onClick={() => navigate('/biblioteca')}>
        <ArrowLeft size={17} /> Voltar para a Biblioteca
      </button>

      <header className="drive-import-header">
        <span>Ferramenta administrativa avançada</span>
        <h1>Importar pasta compartilhada</h1>
        <p>Compartilhe uma pasta como leitor, cole o link abaixo e revise o conteúdo antes de copiar. Nenhuma conta Google precisa ser conectada.</p>
      </header>

      <section className="drive-import-warning">
        <ShieldAlert size={22} aria-hidden="true" />
        <div><strong>A pasta de origem não será alterada</strong><p>O sistema terá somente leitura da pasta compartilhada. Ao terminar, você pode remover o compartilhamento diretamente no Google Drive.</p></div>
      </section>

      <section className="drive-import-card">
        <div className="drive-import-step"><span>1</span><div><strong>Compartilhe a pasta</strong><small>No Google Drive, abra “Compartilhar” e adicione este e-mail como Leitor.</small></div></div>
        {loading ? (
          <div className="drive-import-loading"><Loader size={18} className="animate-spin" /> Carregando instruções…</div>
        ) : (
          <div className="drive-import-share-email">
            <code>{status?.serviceAccountEmail || 'E-mail de importação indisponível'}</code>
            <button type="button" className="btn-secondary" onClick={() => void copyServiceAccountEmail()} disabled={!status?.serviceAccountEmail}>
              <Clipboard size={16} /> Copiar e-mail
            </button>
          </div>
        )}
      </section>

      <section className="drive-import-card">
        <div className="drive-import-step"><span>2</span><div><strong>Cole o link da pasta</strong><small>Use o link exibido pelo Google Drive ao abrir ou compartilhar a pasta.</small></div></div>
        <div className="drive-import-link-row">
          <input
            type="url"
            value={folderUrl}
            onChange={(event) => setFolderUrl(event.target.value)}
            placeholder="https://drive.google.com/drive/folders/..."
            aria-label="Link da pasta compartilhada"
            disabled={actionLoading}
          />
          <button type="button" className="btn-primary" onClick={() => void inspectSharedFolder()} disabled={actionLoading || !folderUrl.trim()}>
            {actionLoading ? <Loader size={17} className="animate-spin" /> : <FolderSearch size={17} />}
            Verificar pasta
          </button>
        </div>
        {!preview && status?.selectedFolderId && ['inventory_scanning', 'inventory_ready', 'inventory_confirmed'].includes(status.status ?? '') && (
          <button type="button" className="btn-secondary drive-import-primary-action" onClick={resumeInventory} disabled={actionLoading}>
            {actionLoading ? <Loader size={17} className="animate-spin" /> : <FolderSearch size={17} />}
            Retomar inventário de {status.selectedFolderName}
          </button>
        )}
      </section>

      {preview && (
        <section className="drive-import-card drive-import-result">
          <div className="drive-import-step"><span>3</span><div><strong>Validação concluída</strong><small>{preview.folder.name}</small></div></div>
          <div className="drive-import-metrics">
            <div><strong>{preview.inventory.folders}</strong><span>pastas</span></div>
            <div><strong>{preview.inventory.files}</strong><span>arquivos</span></div>
            <div><strong>{preview.inventory.items}</strong><span>itens analisados</span></div>
          </div>
          {!preview.done && <p className="drive-import-note">Analisando a estrutura… {preview.inventory.pendingFolders} pasta(s) aguardando leitura.</p>}
          <p className="drive-import-note">Tamanho conhecido: {(preview.inventory.sizeBytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} MB.</p>
          <div className="drive-import-sample">
            {preview.inventory.sample.slice(0, 10).map((item) => <span key={item.id}>{item.relativePath}</span>)}
          </div>
          {preview.done && <p className="drive-import-success"><CheckCircle2 size={18} /> Inventário recursivo concluído. Nenhum arquivo foi copiado.</p>}
          {preview.done && ['inventory_ready', 'inventory_confirmed'].includes(status?.status ?? '') && (
            <button type="button" className="btn-primary drive-import-primary-action" onClick={() => void runCopy(true)} disabled={actionLoading}>
              {actionLoading ? <Loader size={17} className="animate-spin" /> : <Cloud size={17} />}
              Copiar {preview.inventory.items} {preview.inventory.items === 1 ? 'item' : 'itens'} para a Biblioteca
            </button>
          )}
        </section>
      )}

      {(copyProgress || ['copying', 'completed', 'completed_with_errors'].includes(status?.status ?? '')) && (
        <section className="drive-import-card drive-import-result">
          <div className="drive-import-step"><span>4</span><div><strong>Cópia para a Biblioteca</strong><small>Os itens são adicionados à página inicial, preservando a estrutura da pasta compartilhada.</small></div></div>
          {copyProgress && (
            <div className="drive-import-metrics">
              <div><strong>{copyProgress.copied}</strong><span>copiados</span></div>
              <div><strong>{copyProgress.pending + copyProgress.processing}</strong><span>pendentes</span></div>
              <div><strong>{copyProgress.errors}</strong><span>erros</span></div>
            </div>
          )}
          {status?.status === 'copying' && !actionLoading && (
            <button type="button" className="btn-primary drive-import-primary-action" onClick={() => void runCopy(false)}>
              <Cloud size={17} /> Retomar cópia
            </button>
          )}
          {status?.status === 'completed' && <p className="drive-import-success"><CheckCircle2 size={18} /> Importação concluída. Agora você pode remover o compartilhamento no Google Drive.</p>}
          {status?.status === 'completed_with_errors' && (
            <>
              <p className="drive-import-note">A importação terminou com itens incompatíveis ou que falharam.</p>
              <button type="button" className="btn-secondary drive-import-primary-action" onClick={retryCopyErrors} disabled={actionLoading}>
                {actionLoading ? <Loader size={17} className="animate-spin" /> : <Cloud size={17} />}
                Tentar novamente
              </button>
            </>
          )}
          {status?.connected && (
            <button type="button" className="btn-secondary drive-import-primary-action" onClick={revokeSource} disabled={actionLoading}>
              Encerrar esta importação
            </button>
          )}
        </section>
      )}
    </main>
  );
}
