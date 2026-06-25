import { ArrowLeft, ArrowRight, CopyPlus, Download, Loader, Printer, Save, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import londrina100Url from '@fontsource/londrina-solid/files/londrina-solid-latin-100-normal.woff2?url';
import londrina300Url from '@fontsource/londrina-solid/files/londrina-solid-latin-300-normal.woff2?url';
import londrina400Url from '@fontsource/londrina-solid/files/londrina-solid-latin-400-normal.woff2?url';
import londrina900Url from '@fontsource/londrina-solid/files/londrina-solid-latin-900-normal.woff2?url';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { LabelDataSelector } from '../../components/labels/LabelDataSelector';
import { LabelManualSelector } from '../../components/labels/LabelManualSelector';
import { LabelPreview } from '../../components/labels/LabelPreview';
import { LabelPrintArea } from '../../components/labels/LabelPrintArea';
import { LabelTemplateEditor } from '../../components/labels/LabelTemplateEditor';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { PageHeader } from '../../components/ui/PageHeader';
import { useEncontros } from '../../contexts/EncontroContext';
import { useEquipes } from '../../hooks/useEquipes';
import { useLabelPagination } from '../../hooks/useLabelPagination';
import { circuloService } from '../../services/circuloService';
import { labelDataService } from '../../services/labelDataService';
import { labelTemplateService } from '../../services/labelTemplateService';
import { labelPdfService } from '../../services/labelPdfService';
import type { Encontro } from '../../types/encontro';
import type { LabelDataFilters, LabelDataItem, LabelGrouping, LabelPrintItem, LabelTemplate } from '../../types/label';
import { cloneDefaultLabelTemplate, getLabelsPerPage, getOrientedSheetDimensions, matchesLabelFilters, sortLabelItems, validateLabelLayout } from '../../utils/labelLayout';
import './LabelGeneratorPage.css';

type GeneratorTab = 'modelo' | 'dados' | 'avulsas' | 'preview';

const initialFilters: LabelDataFilters = { search: '', equipeId: '', equipeCor: '', equipeIds: [], visitaGrupoId: '', circulo: '', status: '', tipo: '' };

const labelPrintFontFaces = `
  @font-face {
    font-family: 'Londrina Solid';
    font-style: normal;
    font-display: swap;
    font-weight: 100;
    src: url('${londrina100Url}') format('woff2');
  }
  @font-face {
    font-family: 'Londrina Solid';
    font-style: normal;
    font-display: swap;
    font-weight: 300;
    src: url('${londrina300Url}') format('woff2');
  }
  @font-face {
    font-family: 'Londrina Solid';
    font-style: normal;
    font-display: swap;
    font-weight: 400;
    src: url('${londrina400Url}') format('woff2');
  }
  @font-face {
    font-family: 'Londrina Solid';
    font-style: normal;
    font-display: swap;
    font-weight: 900;
    src: url('${londrina900Url}') format('woff2');
  }
`;

interface StepperInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

function StepperInput({ label, value, min, max, onChange }: StepperInputProps) {
  const clamp = (nextValue: number) => Math.max(min, Math.min(max, nextValue));

  return (
    <label className="standard-label-group label-stepper-field">
      <span className="form-label standard-label">{label}</span>
      <div className="label-stepper-control">
        <button type="button" onClick={() => onChange(clamp(value - 1))} disabled={value <= min} aria-label={`Diminuir ${label}`}>-</button>
        <input
          className="form-input"
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => {
            const nextValue = Number(event.target.value);
            onChange(Number.isFinite(nextValue) ? clamp(nextValue) : min);
          }}
        />
        <button type="button" onClick={() => onChange(clamp(value + 1))} disabled={value >= max} aria-label={`Aumentar ${label}`}>+</button>
      </div>
    </label>
  );
}

export function LabelGeneratorPage() {
  const { encontros, encontroAtivo } = useEncontros();
  const { equipes } = useEquipes();
  const [selectedEncontroId, setSelectedEncontroId] = useState('');
  const [templates, setTemplates] = useState<LabelTemplate[]>([]);
  const [template, setTemplate] = useState<LabelTemplate>(cloneDefaultLabelTemplate);
  const [items, setItems] = useState<LabelDataItem[]>([]);
  const [circuloItems, setCirculoItems] = useState<LabelDataItem[]>([]);
  const [manualItems, setManualItems] = useState<LabelDataItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<LabelDataFilters>(initialFilters);
  const [grouping, setGrouping] = useState<LabelGrouping>('none');
  const [selectedFieldId, setSelectedFieldId] = useState('field-nome');
  const [activeTab, setActiveTab] = useState<GeneratorTab>('modelo');
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [labelQuantity, setLabelQuantity] = useState(1);
  const [skippedLabels, setSkippedLabels] = useState(0);
  const printRef = useRef<HTMLDivElement>(null);

  const equipeItems = useMemo<LabelDataItem[]>(() => equipes
    .filter((equipe) => !equipe.deleted_at)
    .map((equipe): LabelDataItem => {
      const nome = equipe.nome?.trim() || 'Equipe sem nome';
      return {
        id: `equipe-${equipe.id}`,
        nome,
        equipe: nome,
        equipeId: equipe.id,
        equipeCor: equipe.acesso_plenario || null,
        visitaGrupoId: null,
        visitaGrupo: '',
        circulo: '',
        funcao: 'Equipe',
        telefone: '',
        observacao: '',
        codigo: equipe.id.slice(0, 8).toUpperCase(),
        qrCode: equipe.id,
        imagem: equipe.foto_url || '',
        tipo: 'equipe',
        status: 'confirmado',
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })),
  [equipes]);

  const allItems = useMemo(() => [...items, ...equipeItems, ...circuloItems, ...manualItems], [circuloItems, equipeItems, items, manualItems]);

  const selectedItems = useMemo(
    () => sortLabelItems(allItems.filter((item) => selectedIds.has(item.id) && (item.tipo === 'manual' || matchesLabelFilters(item, filters))), grouping),
    [allItems, filters, grouping, selectedIds],
  );
  const repeatedItems = useMemo(
    () => selectedItems.flatMap((item) => Array.from({ length: labelQuantity }, () => item)),
    [labelQuantity, selectedItems],
  );
  const labelsPerPage = useMemo(() => getLabelsPerPage(template.printSettings), [template.printSettings]);
  const maxSkippedLabels = Math.max(0, labelsPerPage - 1);
  const printableItems = useMemo<LabelPrintItem[]>(
    () => skippedLabels > 0 ? [...Array<null>(skippedLabels).fill(null), ...repeatedItems] : repeatedItems,
    [repeatedItems, skippedLabels],
  );
  const pages = useLabelPagination(printableItems, template.printSettings);
  const sheet = getOrientedSheetDimensions(template.printSettings);
  const layoutErrors = useMemo(() => validateLabelLayout(template), [template]);

  useEffect(() => {
    if (!selectedEncontroId && (encontroAtivo || encontros[0])) setSelectedEncontroId((encontroAtivo || encontros[0]).id);
  }, [encontroAtivo, encontros, selectedEncontroId]);

  useEffect(() => {
    setSkippedLabels((current) => Math.min(current, maxSkippedLabels));
  }, [maxSkippedLabels]);

  useEffect(() => {
    labelTemplateService.listar().then((data) => {
      setTemplates(data);
      if (data[0]) setTemplate(data[0]);
    });
  }, []);

  useEffect(() => {
    circuloService.listar()
      .then((circulos) => {
        setCirculoItems(circulos.map((circulo): LabelDataItem => {
          const nome = circulo.nome?.trim() || 'Círculo sem nome';

          return {
            id: `circulo-${circulo.id}`,
            nome,
            equipe: '',
            equipeId: null,
            equipeCor: null,
            visitaGrupoId: null,
            visitaGrupo: '',
            circulo: nome,
            funcao: 'Círculo',
            telefone: '',
            observacao: '',
            codigo: String(circulo.id).padStart(4, '0'),
            qrCode: String(circulo.id),
            imagem: circulo.imagem_url || '',
            tipo: 'circulo',
            status: 'confirmado',
          };
        }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })));
      })
      .catch((error) => {
        console.error(error);
        toast.error('Erro ao carregar círculos para etiquetas.');
      });
  }, []);

  useEffect(() => {
    if (!selectedEncontroId) return;
    setIsLoadingData(true);
    setSelectedIds(new Set());
    labelDataService.listarPorEncontro(selectedEncontroId)
      .then(setItems)
      .catch((error) => {
        console.error(error);
        toast.error('Erro ao carregar os registros para etiquetas.');
      })
      .finally(() => setIsLoadingData(false));
  }, [selectedEncontroId]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Etiquetas - ${template.name}`,
    ignoreGlobalStyles: true,
    pageStyle: `
      ${labelPrintFontFaces}
      @page { size: ${sheet.width}mm ${sheet.height}mm; margin: 0; }
      html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
      * { box-sizing: border-box; }
      body * { visibility: visible !important; }
      .label-print-only, .label-print-only * { visibility: visible !important; }
      .label-print-only {
        clip: auto !important;
        clip-path: none !important;
        height: auto !important;
        overflow: visible !important;
        position: static !important;
        width: auto !important;
      }
      .label-print-area { display: block !important; width: ${sheet.width}mm !important; margin: 0 !important; padding: 0 !important; }
      .label-print-page {
        display: block !important;
        width: ${sheet.width}mm !important;
        height: ${sheet.height}mm !important;
        margin: 0 !important;
        box-shadow: none !important;
        overflow: hidden !important;
        break-after: page;
        page-break-after: always;
      }
      .label-print-page:last-child { break-after: auto; page-break-after: auto; }
      .label-print-grid { display: grid !important; align-content: start !important; justify-content: start !important; }
      .label-canvas {
        box-sizing: border-box !important;
        display: block !important;
        position: relative !important;
        overflow: hidden !important;
        flex: none !important;
        print-color-adjust: exact !important;
        -webkit-print-color-adjust: exact !important;
      }
      .label-editor-field { display: contents !important; }
      .label-field {
        box-sizing: border-box !important;
        display: flex !important;
        align-items: center !important;
        line-height: 1.15 !important;
      }
      .label-field--media img, .label-field--media svg { width: auto !important; height: 100% !important; max-width: 100% !important; object-fit: contain !important; }
    `,
    onBeforePrint: async () => {
      await document.fonts?.ready;
      const images = Array.from(printRef.current?.querySelectorAll('img') || []);
      await Promise.all(images.map((image) => image.complete ? Promise.resolve() : new Promise<void>((resolve) => {
        image.addEventListener('load', () => resolve(), { once: true });
        image.addEventListener('error', () => resolve(), { once: true });
      })));
    },
    onPrintError: (_location, error) => {
      console.error(error);
      toast.error('Não foi possível abrir a impressão.');
    },
  });

  const saveTemplate = async () => {
    setIsSaving(true);
    try {
      const saved = await labelTemplateService.salvar(template);
      setTemplate(saved);
      setTemplates(await labelTemplateService.listar());
      toast.success('Modelo de etiqueta salvo.');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar o modelo.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTemplate = async () => {
    await labelTemplateService.excluir(template.id);
    const next = await labelTemplateService.listar();
    setTemplates(next);
    setTemplate(next[0] || cloneDefaultLabelTemplate());
    setShowDeleteConfirm(false);
    toast.success('Modelo removido.');
  };

  const selectTemplate = (id: string) => {
    const selected = templates.find((item) => item.id === id);
    if (selected) setTemplate(JSON.parse(JSON.stringify(selected)) as LabelTemplate);
  };

  const duplicateTemplate = () => {
    setTemplate({ ...JSON.parse(JSON.stringify(template)) as LabelTemplate, id: '', name: 'Novo modelo', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    toast.success('Cópia criada. Ajuste o nome e salve o novo modelo.');
  };

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const addManualItem = useCallback((manualData: Omit<LabelDataItem, 'id' | 'tipo' | 'status' | 'equipeId' | 'equipeCor' | 'visitaGrupoId'>) => {
    const hasContent = [
      manualData.nome,
      manualData.equipe,
      manualData.visitaGrupo,
      manualData.circulo,
      manualData.funcao,
      manualData.telefone,
      manualData.observacao,
      manualData.codigo,
      manualData.qrCode,
      manualData.imagem,
    ].some((value) => value.trim());

    if (!hasContent) {
      toast.error('Informe o conteúdo da etiqueta avulsa.');
      return;
    }

    const id = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nextItem: LabelDataItem = {
      ...manualData,
      id,
      nome: manualData.nome.trim(),
      equipe: manualData.equipe.trim(),
      equipeId: null,
      equipeCor: null,
      visitaGrupoId: null,
      visitaGrupo: manualData.visitaGrupo.trim(),
      circulo: manualData.circulo.trim(),
      funcao: manualData.funcao.trim(),
      telefone: manualData.telefone.trim(),
      observacao: manualData.observacao.trim(),
      codigo: manualData.codigo.trim(),
      qrCode: manualData.qrCode.trim(),
      imagem: manualData.imagem.trim(),
      tipo: 'manual',
      status: 'confirmado',
    };

    setManualItems((current) => [...current, nextItem]);
    setSelectedIds((current) => new Set(current).add(id));
    toast.success('Dado manual adicionado às etiquetas.');
  }, []);

  const removeManualItem = useCallback((id: string) => {
    setManualItems((current) => current.filter((item) => item.id !== id));
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }, []);

  const print = () => {
    if (selectedItems.length === 0) return toast.error('Selecione ao menos um registro.');
    if (labelQuantity < 1) return toast.error('Informe ao menos 1 etiqueta por registro.');
    if (layoutErrors.length > 0) return toast.error('Corrija a grade da folha antes de imprimir.');
    handlePrint();
  };

  const exportPdf = async () => {
    if (selectedItems.length === 0) return toast.error('Selecione ao menos um registro.');
    if (labelQuantity < 1) return toast.error('Informe ao menos 1 etiqueta por registro.');
    if (layoutErrors.length > 0) return toast.error('Corrija a grade da folha antes de gerar o PDF.');
    if (!printRef.current) return toast.error('A área de etiquetas ainda não está pronta.');

    setIsGeneratingPdf(true);
    try {
      await labelPdfService.gerar(printRef.current, template, printableItems);
      toast.success('PDF gerado com sucesso.');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível gerar o PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <section className="label-generator-page fade-in">
      <PageHeader
        title="Gerador de Etiquetas"
        subtitle="Secretaria"
        backPath="/secretaria"
        actions={(
          <>
            <button type="button" className="btn-secondary" onClick={print}><Printer size={17} /> Imprimir</button>
            <button type="button" className="btn-primary" onClick={exportPdf} disabled={isGeneratingPdf}>
              {isGeneratingPdf ? <Loader className="animate-spin" size={17} /> : <Download size={17} />}
              {isGeneratingPdf ? 'Gerando PDF...' : 'Baixar PDF'}
            </button>
          </>
        )}
        tabs={(
          <div className="label-steps">
            <button type="button" className={activeTab === 'modelo' ? 'is-active' : ''} onClick={() => setActiveTab('modelo')}><b>1</b><span><strong>Monte a etiqueta</strong><small>Conteúdo e aparência</small></span></button>
            <button type="button" className={activeTab === 'dados' ? 'is-active' : ''} onClick={() => setActiveTab('dados')}><b>2</b><span><strong>Escolha os dados</strong><small>{repeatedItems.length} serão geradas</small></span></button>
            <button type="button" className={activeTab === 'avulsas' ? 'is-active' : ''} onClick={() => setActiveTab('avulsas')}><b>3</b><span><strong>Avulsas</strong><small>{manualItems.length} criada(s)</small></span></button>
            <button type="button" className={activeTab === 'preview' ? 'is-active' : ''} onClick={() => setActiveTab('preview')}><b>4</b><span><strong>Confira e gere</strong><small>{pages.length} página(s)</small></span></button>
          </div>
        )}
      />

      <div className="label-context-bar">
        <label className="standard-label-group">
          <span className="form-label standard-label">Encontro</span>
          <LiveSearchSelect<Encontro>
            value={selectedEncontroId}
            onChange={(value) => setSelectedEncontroId(value)}
            fetchData={async (search, page) => encontros.filter((item) => item.nome.toLowerCase().includes(search.toLowerCase())).slice(page * 5, page * 5 + 5)}
            getOptionLabel={(item) => item.nome}
            getOptionValue={(item) => item.id}
            initialOptions={encontros}
          />
        </label>
        <label className="standard-label-group">
          <span className="form-label standard-label">Modelo</span>
          <select className="form-input" value={template.id} onChange={(event) => selectTemplate(event.target.value)}>
            {!template.id && <option value="">Novo modelo</option>}
            {templates.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
        </label>
        <StepperInput label="Qtd. por registro" value={labelQuantity} min={1} max={999} onChange={setLabelQuantity} />
        <StepperInput label="Pular na 1ª folha" value={skippedLabels} min={0} max={maxSkippedLabels} onChange={setSkippedLabels} />
        <div className="label-model-actions">
          <button type="button" className="btn-secondary-sm" onClick={duplicateTemplate}><CopyPlus size={16} /> Criar cópia</button>
          <button type="button" className="btn-primary-sm" onClick={saveTemplate} disabled={isSaving}>{isSaving ? <Loader className="animate-spin" size={16} /> : <Save size={16} />} Salvar</button>
          <button type="button" className="btn-danger-outline" title="Excluir modelo" disabled={!template.id} onClick={() => setShowDeleteConfirm(true)}><Trash2 size={16} /></button>
        </div>
      </div>

      {layoutErrors.length > 0 && <div className="label-layout-warning"><strong>A grade não cabe na folha:</strong> {layoutErrors.join(' ')}</div>}

      {activeTab === 'modelo' && <LabelTemplateEditor template={template} selectedFieldId={selectedFieldId} onSelectedFieldChange={setSelectedFieldId} onChange={setTemplate} />}
      {activeTab === 'dados' && <LabelDataSelector items={allItems} manualItems={manualItems} selectedIds={selectedIds} filters={filters} equipes={equipes} grouping={grouping} isLoading={isLoadingData} onRemoveManualItem={removeManualItem} onFiltersChange={setFilters} onGroupingChange={setGrouping} onToggle={toggleSelection} onSelectAll={(ids) => setSelectedIds(new Set(ids))} onClear={() => setSelectedIds(new Set())} />}
      {activeTab === 'avulsas' && <LabelManualSelector manualItems={manualItems} selectedIds={selectedIds} onAddManualItem={addManualItem} onRemoveManualItem={removeManualItem} onToggle={toggleSelection} />}
      {activeTab === 'preview' && (
        <div className="label-preview-panel">
          <div className="label-print-guidance">
            <strong>{repeatedItems.length} etiquetas em {pages.length} página(s).</strong>
            <span>{selectedItems.length} registro(s) selecionado(s), {labelQuantity} etiqueta(s) por registro{skippedLabels > 0 ? `, pulando ${skippedLabels} na primeira folha` : ''}.</span>
          </div>
          <LabelPreview template={template} items={printableItems} />
        </div>
      )}

      <div className="label-step-footer">
        {activeTab !== 'modelo' ? <button type="button" className="btn-secondary" onClick={() => setActiveTab(activeTab === 'preview' ? 'avulsas' : activeTab === 'avulsas' ? 'dados' : 'modelo')}><ArrowLeft size={17} /> Voltar</button> : <span />}
        {activeTab === 'modelo' && <button type="button" className="btn-primary" onClick={() => setActiveTab('dados')}>Escolher dados <ArrowRight size={17} /></button>}
        {activeTab === 'dados' && <button type="button" className="btn-primary" onClick={() => setActiveTab('preview')} disabled={selectedItems.length === 0}>Conferir etiquetas <ArrowRight size={17} /></button>}
        {activeTab === 'avulsas' && <button type="button" className="btn-primary" onClick={() => setActiveTab('preview')} disabled={selectedItems.length === 0}>Conferir etiquetas <ArrowRight size={17} /></button>}
        {activeTab === 'preview' && (
          <div className="label-final-actions">
            <button type="button" className="btn-secondary" onClick={print}><Printer size={17} /> Imprimir</button>
            <button type="button" className="btn-primary" onClick={exportPdf} disabled={isGeneratingPdf}>
              {isGeneratingPdf ? <Loader className="animate-spin" size={17} /> : <Download size={17} />}
              {isGeneratingPdf ? 'Gerando PDF...' : 'Baixar PDF'}
            </button>
          </div>
        )}
      </div>

      <div className="label-print-only"><LabelPrintArea ref={printRef} template={template} pages={pages} /></div>

      <ConfirmDialog isOpen={showDeleteConfirm} title="Excluir modelo?" message={`O modelo “${template.name}” será removido do banco de dados.`} confirmText="Excluir" isDestructive onConfirm={deleteTemplate} onCancel={() => setShowDeleteConfirm(false)} />
    </section>
  );
}
