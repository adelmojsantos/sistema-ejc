import { ArrowLeft, CheckCircle2, Cloud, FolderSearch, Loader, LogOut, ShieldAlert } from 'lucide-react';
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

interface PickerDocument {
  id?: string;
  name?: string;
  mimeType?: string;
}

interface PickerCallbackData {
  action?: string;
  docs?: PickerDocument[];
}

interface PickerView {
  setIncludeFolders(value: boolean): PickerView;
  setSelectFolderEnabled(value: boolean): PickerView;
}

interface PickerInstance {
  setVisible(value: boolean): void;
}

interface PickerBuilder {
  addView(view: PickerView): PickerBuilder;
  enableFeature(feature: string): PickerBuilder;
  setOAuthToken(token: string): PickerBuilder;
  setDeveloperKey(key: string): PickerBuilder;
  setAppId(appId: string): PickerBuilder;
  setCallback(callback: (data: PickerCallbackData) => void): PickerBuilder;
  build(): PickerInstance;
}

interface GooglePickerApi {
  Action: { PICKED: string };
  Feature: { MULTISELECT_ENABLED: string };
  ViewId: { DOCS: string };
  DocsView: new (viewId: string) => PickerView;
  PickerBuilder: new () => PickerBuilder;
}

declare global {
  interface Window {
    gapi?: { load: (name: string, callback: () => void) => void };
    google?: { picker: GooglePickerApi };
  }
}

let pickerScriptPromise: Promise<void> | null = null;

function loadGooglePicker(): Promise<void> {
  if (window.google?.picker) return Promise.resolve();
  if (pickerScriptPromise) return pickerScriptPromise;
  pickerScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-picker]');
    const loadPickerModule = () => {
      if (!window.gapi) {
        reject(new Error('A biblioteca do Google não foi carregada.'));
        return;
      }
      window.gapi.load('picker', () => {
        if (window.google?.picker) resolve();
        else reject(new Error('O seletor do Google Drive não ficou disponível.'));
      });
    };
    if (existing) {
      existing.addEventListener('load', loadPickerModule, { once: true });
      existing.addEventListener('error', () => reject(new Error('Falha ao carregar o Google Picker.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.dataset.googlePicker = 'true';
    script.onload = loadPickerModule;
    script.onerror = () => reject(new Error('Falha ao carregar o Google Picker.'));
    document.head.appendChild(script);
  });
  return pickerScriptPromise;
}

export function GoogleDriveImportPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<GoogleDriveImportStatus | null>(null);
  const [preview, setPreview] = useState<GoogleDriveFolderPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [copyProgress, setCopyProgress] = useState<GoogleDriveCopyProgress | null>(null);

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
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_import') === 'connected') {
      toast.success('Conta de origem conectada temporariamente.');
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('google_import') === 'denied') {
      toast.error('A conexão temporária com o Google foi cancelada.');
      window.history.replaceState({}, '', window.location.pathname);
    }
    void loadStatus();
  }, [loadStatus]);

  const connectSource = async () => {
    setActionLoading(true);
    try {
      window.location.assign(await bibliotecaService.iniciarImportacaoOutroDrive());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível conectar outra conta.');
      setActionLoading(false);
    }
  };

  const inspectItems = async (itemIds: string[]) => {
    setActionLoading(true);
    try {
      let result = await bibliotecaService.inspecionarItensOutroDrive(itemIds);
      setPreview(result);
      while (!result.done) {
        const progress = await bibliotecaService.processarInventarioOutroDrive();
        result = { ...result, ...progress, folder: result.folder };
        setPreview(result);
      }
      await loadStatus();
      toast.success('Inventário completo. Revise o resumo antes de confirmar.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível acessar os itens selecionados.');
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

  const openPicker = async () => {
    setActionLoading(true);
    try {
      const config = await bibliotecaService.obterTokenGooglePicker();
      await loadGooglePicker();
      const pickerApi = window.google?.picker;
      if (!pickerApi) throw new Error('Google Picker indisponível.');
      const itemsView = new pickerApi.DocsView(pickerApi.ViewId.DOCS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true);
      const picker = new pickerApi.PickerBuilder()
        .addView(itemsView)
        .enableFeature(pickerApi.Feature.MULTISELECT_ENABLED)
        .setOAuthToken(config.accessToken)
        .setDeveloperKey(config.developerKey)
        .setAppId(config.appId)
        .setCallback((data) => {
          if (data.action !== pickerApi.Action.PICKED) return;
          const itemIds = (data.docs ?? [])
            .map((item) => item.id)
            .filter((id): id is string => Boolean(id));
          if (itemIds.length > 0) void inspectItems(itemIds);
        })
        .build();
      picker.setVisible(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível abrir o seletor do Google.');
    } finally {
      setActionLoading(false);
    }
  };

  const revokeSource = async () => {
    setActionLoading(true);
    try {
      await bibliotecaService.revogarImportacaoOutroDrive();
      setPreview(null);
      await loadStatus();
      toast.success('Conexão temporária removida.');
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
        <h1>Importar de outro Drive</h1>
        <p>Conecte temporariamente uma conta de origem e selecione as pastas e os arquivos que deseja importar. A conta institucional atual não será substituída.</p>
      </header>

      <section className="drive-import-warning">
        <ShieldAlert size={22} aria-hidden="true" />
        <div><strong>Operação excepcional</strong><p>A conexão concede leitura temporária do Drive para preservar a estrutura de pastas. Nenhum arquivo pode ser alterado e o acesso expira em 24 horas.</p></div>
      </section>

      <section className="drive-import-card">
        <div className="drive-import-step"><span>1</span><div><strong>Conta de origem</strong><small>Conta antiga que possui ou recebeu os arquivos.</small></div></div>
        {loading ? (
          <div className="drive-import-loading"><Loader size={18} className="animate-spin" /> Consultando conexão…</div>
        ) : status?.connected ? (
          <div className="drive-import-connected">
            <CheckCircle2 size={20} />
            <div><strong>{status.accountEmail}</strong><small>Conexão temporária ativa</small></div>
            <button type="button" className="btn-secondary" onClick={revokeSource} disabled={actionLoading}><LogOut size={16} /> Desconectar</button>
          </div>
        ) : (
          <button type="button" className="btn-primary drive-import-primary-action" onClick={connectSource} disabled={actionLoading}>
            {actionLoading ? <Loader size={17} className="animate-spin" /> : <Cloud size={17} />}
            Conectar outra conta
          </button>
        )}
      </section>

      <section className="drive-import-card">
        <div className="drive-import-step"><span>2</span><div><strong>Itens de origem</strong><small>Selecione uma ou mais pastas e arquivos para analisar nesta operação.</small></div></div>
        <button type="button" className="btn-primary drive-import-primary-action" onClick={openPicker} disabled={!status?.connected || actionLoading}>
          {actionLoading ? <Loader size={17} className="animate-spin" /> : <FolderSearch size={17} />}
          Selecionar pastas e arquivos
        </button>
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
          <div className="drive-import-step"><span>4</span><div><strong>Cópia para a Biblioteca</strong><small>Os itens foram adicionados à página inicial, preservando as pastas selecionadas.</small></div></div>
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
          {status?.status === 'completed' && <p className="drive-import-success"><CheckCircle2 size={18} /> Importação concluída e conexão temporária encerrada.</p>}
          {status?.status === 'completed_with_errors' && (
            <>
              <p className="drive-import-note">A importação terminou com itens incompatíveis ou que falharam.</p>
              <button type="button" className="btn-secondary drive-import-primary-action" onClick={retryCopyErrors} disabled={actionLoading}>
                {actionLoading ? <Loader size={17} className="animate-spin" /> : <Cloud size={17} />}
                Tentar novamente
              </button>
            </>
          )}
        </section>
      )}
    </main>
  );
}
