import { Baby, Copy, Download, FileText, Loader, Plus, Search, TableProperties, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import logoEjc from '../../assets/logo-ejc.svg';
import { PageHeader } from '../../components/ui/PageHeader';
import { useEncontros } from '../../contexts/EncontroContext';
import { useAuth } from '../../hooks/useAuth';
import { relatorioCrachaService } from '../../services/relatorioCrachaService';
import { recreacaoService } from '../../services/recreacaoService';
import type { Encontro } from '../../types/encontro';
import type { RelatorioCrachaCor, RelatorioCrachaItem } from '../../types/relatorioCracha';
import type { RecreacaoDados } from '../../types/recreacao';
import './RelatoriosPage.css';

const cores: RelatorioCrachaCor[] = ['Branco', 'Verde', 'Amarelo', 'Vermelho'];
const descricaoCor: Record<RelatorioCrachaCor, string> = {
  Branco: 'Encontristas: Nome e Círculo',
  Verde: 'Equipes verdes: Nome e Equipe',
  Amarelo: 'Equipes amarelas: Nome e Equipe',
  Vermelho: 'Equipes vermelhas: Nome e Equipe',
};

type RelatorioTipo = 'relacao-crachas' | 'crachas-mesa';
type MesaEquipeCor = Exclude<RelatorioCrachaCor, 'Branco'>;
type MesaEquipeCorFilter = MesaEquipeCor | 'Todos';
type MesaPrintTipo = 'encontristas' | 'encontreiros' | 'recreacao' | 'avulsos';
type MesaAvulsoTipo = 'encontrista' | 'encontreiro' | 'crianca';
type MesaReportTab = 'gerais' | 'avulsos';

interface MesaBadgeItem {
  id: string;
  nome: string;
  grupo: string;
  detalhes?: string[];
  icone?: 'infantil';
}

const relatorioOptions: Array<{
  id: RelatorioTipo;
  title: string;
  description: string;
}> = [
  {
    id: 'relacao-crachas',
    title: 'Relação para crachás',
    description: 'Lista por cor com nomes, círculos e equipes para conferência.',
  },
  {
    id: 'crachas-mesa',
    title: 'Crachás de mesa',
    description: 'Base para impressão de identificações de mesa.',
  },
];

interface RelatoriosPageProps {
  mode?: RelatorioTipo;
}

const mesaEquipeCores: MesaEquipeCorFilter[] = ['Todos', 'Verde', 'Amarelo', 'Vermelho'];
const mesaAvulsoTipoLabels: Record<MesaAvulsoTipo, string> = {
  encontrista: 'Encontrista',
  encontreiro: 'Encontreiro',
  crianca: 'Criança',
};

const mesaEquipeCorPlural: Record<MesaEquipeCorFilter, string> = {
  Todos: 'todas as cores',
  Verde: 'verdes',
  Amarelo: 'amarelas',
  Vermelho: 'vermelhas',
};

const sanitizeFileName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

const rowsToExport = (items: RelatorioCrachaItem[]) =>
  items.map(item => ({
    Cor: item.cor,
    Nome: item.nome,
    Circulo: item.circulo,
    Equipe: item.equipe,
  }));

const rowsToTsv = (items: RelatorioCrachaItem[]) => {
  const header = ['Cor', 'Nome', 'Círculo', 'Equipe'];
  const body = items.map(item => [item.cor, item.nome, item.circulo, item.equipe]);
  return [header, ...body]
    .map(row => row.map(value => String(value ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ')).join('\t'))
    .join('\n');
};

const chunkItems = <T,>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size)
  );

const mesaBadgesPerPage = 8;

const sortMesaItems = (items: RelatorioCrachaItem[]) =>
  [...items].sort((a, b) => {
    const grupoA = a.cor === 'Branco' ? a.circulo : a.equipe;
    const grupoB = b.cor === 'Branco' ? b.circulo : b.equipe;
    const grupoDiff = grupoA.localeCompare(grupoB, 'pt-BR', { sensitivity: 'base' });
    if (grupoDiff !== 0) return grupoDiff;

    return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
  });

const sortMesaBadgeItems = (items: MesaBadgeItem[]) =>
  [...items].sort((a, b) => {
    const grupoDiff = a.grupo.localeCompare(b.grupo, 'pt-BR', { sensitivity: 'base' });
    if (grupoDiff !== 0) return grupoDiff;

    return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
  });

const responsavelNomeSeTiverEquipe = (
  responsavel?: { pessoas?: { nome_completo?: string | null }; equipes?: { nome?: string | null } } | null
) => {
  const equipe = responsavel?.equipes?.nome?.trim();
  if (!equipe) return '';

  return responsavel?.pessoas?.nome_completo?.trim() || 'Responsável';
};

export function RelatoriosPage({ mode }: RelatoriosPageProps) {
  const { hasPermission } = useAuth();
  const { encontros, encontroAtivo, isLoading: loadingEncontros } = useEncontros();
  const canChangeEncontro = hasPermission('modulo_admin');
  const [selectedEncontroId, setSelectedEncontroId] = useState('');
  const [items, setItems] = useState<RelatorioCrachaItem[]>([]);
  const [recreacaoItems, setRecreacaoItems] = useState<RecreacaoDados[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [activeReport, setActiveReport] = useState<RelatorioTipo>(mode ?? 'relacao-crachas');
  const [mesaReportTab, setMesaReportTab] = useState<MesaReportTab>('gerais');
  const [mesaEquipeCor, setMesaEquipeCor] = useState<MesaEquipeCorFilter>('Verde');
  const [selectedMesaEquipeIds, setSelectedMesaEquipeIds] = useState<string[]>([]);
  const [mesaAvulsoTipo, setMesaAvulsoTipo] = useState<MesaAvulsoTipo>('encontrista');
  const [mesaAvulsoSearch, setMesaAvulsoSearch] = useState('');
  const [mesaAvulsoEquipeCor, setMesaAvulsoEquipeCor] = useState<MesaEquipeCorFilter>('Verde');
  const [selectedMesaAvulsoEquipeIds, setSelectedMesaAvulsoEquipeIds] = useState<string[]>([]);
  const [mesaAvulsosSelecionados, setMesaAvulsosSelecionados] = useState<MesaBadgeItem[]>([]);

  useEffect(() => {
    if (mode) setActiveReport(mode);
  }, [mode]);

  useEffect(() => {
    if (!selectedEncontroId) {
      if (encontroAtivo) setSelectedEncontroId(encontroAtivo.id);
      else if (encontros.length > 0) setSelectedEncontroId(encontros[0].id);
    }
  }, [encontroAtivo, encontros, selectedEncontroId]);

  const selectedEncontro = useMemo<Encontro | undefined>(
    () => encontros.find(encontro => encontro.id === selectedEncontroId),
    [encontros, selectedEncontroId]
  );

  const loadRelatorio = useCallback(async () => {
    if (!selectedEncontroId) return;

    setIsLoading(true);
    try {
      const [relatorioData, recreacaoData] = await Promise.all([
        relatorioCrachaService.listarPorEncontro(selectedEncontroId),
        recreacaoService.listarTodosPorEncontro(selectedEncontroId),
      ]);
      setItems(relatorioData);
      setRecreacaoItems(recreacaoData);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar relatórios.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedEncontroId]);

  useEffect(() => {
    loadRelatorio();
  }, [loadRelatorio]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;

    return items.filter(item =>
      item.cor.toLowerCase().includes(term) ||
      item.nome.toLowerCase().includes(term) ||
      item.circulo.toLowerCase().includes(term) ||
      item.equipe.toLowerCase().includes(term)
    );
  }, [items, search]);

  const groupedItems = useMemo(() => {
    return cores.reduce<Record<RelatorioCrachaCor, RelatorioCrachaItem[]>>((acc, cor) => {
      acc[cor] = filteredItems.filter(item => item.cor === cor);
      return acc;
    }, {
      Branco: [],
      Verde: [],
      Amarelo: [],
      Vermelho: [],
    });
  }, [filteredItems]);

  const mesaEncontristas = useMemo(() => sortMesaItems(items.filter(item => item.cor === 'Branco')), [items]);
  const mesaEquipesDaCor = useMemo(() => {
    const teamMap = new Map<string, { nome: string; cor: RelatorioCrachaCor }>();

    items.forEach(item => {
      if (item.cor !== 'Branco' && (mesaEquipeCor === 'Todos' || item.cor === mesaEquipeCor) && item.equipeId) {
        teamMap.set(item.equipeId, {
          nome: item.equipe || 'Sem equipe',
          cor: item.cor,
        });
      }
    });

    return Array.from(teamMap, ([id, data]) => ({ id, ...data }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  }, [items, mesaEquipeCor]);

  const mesaAvulsoEquipesDaCor = useMemo(() => {
    const teamMap = new Map<string, { nome: string; cor: RelatorioCrachaCor }>();

    items.forEach(item => {
      if (item.cor !== 'Branco' && (mesaAvulsoEquipeCor === 'Todos' || item.cor === mesaAvulsoEquipeCor) && item.equipeId) {
        teamMap.set(item.equipeId, {
          nome: item.equipe || 'Sem equipe',
          cor: item.cor,
        });
      }
    });

    return Array.from(teamMap, ([id, data]) => ({ id, ...data }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  }, [items, mesaAvulsoEquipeCor]);

  useEffect(() => {
    setSelectedMesaEquipeIds(mesaEquipesDaCor.map(equipe => equipe.id));
  }, [mesaEquipesDaCor]);

  useEffect(() => {
    setSelectedMesaAvulsoEquipeIds(mesaAvulsoEquipesDaCor.map(equipe => equipe.id));
  }, [mesaAvulsoEquipesDaCor]);

  useEffect(() => {
    setMesaAvulsosSelecionados([]);
  }, [selectedEncontroId]);

  const mesaEncontreiros = useMemo(() => {
    const selectedIds = new Set(selectedMesaEquipeIds);
    return sortMesaItems(items.filter(item =>
      item.cor !== 'Branco' &&
      (mesaEquipeCor === 'Todos' || item.cor === mesaEquipeCor) &&
      item.equipeId &&
      selectedIds.has(item.equipeId)
    ));
  }, [items, mesaEquipeCor, selectedMesaEquipeIds]);
  const mesaRecreacao = useMemo(() => {
    const badges = recreacaoItems.map(item => {
      const responsaveis = [
        responsavelNomeSeTiverEquipe(item.participacoes),
        responsavelNomeSeTiverEquipe(item.outro_responsavel),
      ].filter(Boolean);

      return {
        id: item.id,
        nome: item.nome_crianca,
        grupo: 'Recreação Infantil',
        detalhes: responsaveis.length > 0 ? ['Responsáveis:', ...responsaveis] : [],
        icone: 'infantil' as const,
      };
    });

    return sortMesaBadgeItems(badges);
  }, [recreacaoItems]);
  const mesaEncontristasPages = useMemo(
    () => chunkItems(mesaEncontristas.map(item => ({
      id: item.id,
      nome: item.nome,
      grupo: item.circulo,
    })), mesaBadgesPerPage),
    [mesaEncontristas]
  );
  const mesaEncontreirosPages = useMemo(
    () => chunkItems(mesaEncontreiros.map(item => ({
      id: item.id,
      nome: item.nome,
      grupo: item.equipe,
    })), mesaBadgesPerPage),
    [mesaEncontreiros]
  );
  const mesaRecreacaoPages = useMemo(() => chunkItems(mesaRecreacao, mesaBadgesPerPage), [mesaRecreacao]);
  const mesaAvulsoCandidates = useMemo(() => {
    const selectedTeamIds = new Set(selectedMesaAvulsoEquipeIds);
    const term = mesaAvulsoSearch.trim().toLowerCase();

    const candidates: MesaBadgeItem[] =
      mesaAvulsoTipo === 'encontrista'
        ? mesaEncontristas.map(item => ({
          id: `encontrista-${item.id}`,
          nome: item.nome,
          grupo: item.circulo,
        }))
        : mesaAvulsoTipo === 'encontreiro'
          ? sortMesaItems(items.filter(item =>
            item.cor !== 'Branco' &&
            (mesaAvulsoEquipeCor === 'Todos' || item.cor === mesaAvulsoEquipeCor) &&
            item.equipeId &&
            selectedTeamIds.has(item.equipeId)
          )).map(item => ({
            id: `encontreiro-${item.id}`,
            nome: item.nome,
            grupo: item.equipe,
          }))
          : mesaRecreacao.map(item => ({
            ...item,
            id: `crianca-${item.id}`,
          }));

    if (!term) return candidates;

    return candidates.filter(item =>
      item.nome.toLowerCase().includes(term) ||
      item.grupo.toLowerCase().includes(term) ||
      item.detalhes?.some(detalhe => detalhe.toLowerCase().includes(term))
    );
  }, [
    items,
    mesaAvulsoEquipeCor,
    mesaAvulsoSearch,
    mesaAvulsoTipo,
    mesaEncontristas,
    mesaRecreacao,
    selectedMesaAvulsoEquipeIds,
  ]);
  const mesaAvulsosPages = useMemo(() => chunkItems(mesaAvulsosSelecionados, mesaBadgesPerPage), [mesaAvulsosSelecionados]);

  const handleCopy = async () => {
    if (filteredItems.length === 0) {
      toast.error('Não há dados para copiar.');
      return;
    }

    try {
      await navigator.clipboard.writeText(rowsToTsv(filteredItems));
      toast.success('Relação copiada. Agora é só colar no Excel.');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível copiar automaticamente.');
    }
  };

  const handleExportExcel = () => {
    if (filteredItems.length === 0) {
      toast.error('Não há dados para exportar.');
      return;
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rowsToExport(filteredItems)), 'Geral');

    cores.forEach(cor => {
      const sheetRows = rowsToExport(groupedItems[cor]);
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheetRows), cor);
    });

    const encontroName = sanitizeFileName(selectedEncontro?.nome || 'encontro');
    XLSX.writeFile(workbook, `relacao_para_crachas_${encontroName}.xlsx`);
  };

  const handlePrintMesa = (tipo: MesaPrintTipo) => {
    const source =
      tipo === 'encontristas'
        ? mesaEncontristas
        : tipo === 'encontreiros'
          ? mesaEncontreiros
          : tipo === 'recreacao'
            ? mesaRecreacao
            : mesaAvulsosSelecionados;

    if (source.length === 0) {
      toast.error('Não há registros para imprimir nesta lista.');
      return;
    }

    const previousTitle = document.title;
    const cleanupPrintMode = () => {
      document.body.classList.remove('relatorios-mesa-printing', `relatorios-mesa-printing--${tipo}`);
      document.title = previousTitle;
    };

    document.title = `Crachas de mesa - ${tipo} - ${selectedEncontro?.nome || 'Encontro'}`;
    document.body.classList.add('relatorios-mesa-printing', `relatorios-mesa-printing--${tipo}`);
    window.addEventListener('afterprint', cleanupPrintMode, { once: true });
    window.print();
  };

  const handleMesaEquipeToggle = (equipeId: string) => {
    setSelectedMesaEquipeIds(current =>
      current.includes(equipeId)
        ? current.filter(id => id !== equipeId)
        : [...current, equipeId]
    );
  };

  const handleSelectAllMesaEquipes = () => {
    setSelectedMesaEquipeIds(mesaEquipesDaCor.map(equipe => equipe.id));
  };

  const handleClearMesaEquipes = () => {
    setSelectedMesaEquipeIds([]);
  };

  const handleMesaAvulsoEquipeToggle = (equipeId: string) => {
    setSelectedMesaAvulsoEquipeIds(current =>
      current.includes(equipeId)
        ? current.filter(id => id !== equipeId)
        : [...current, equipeId]
    );
  };

  const handleSelectAllMesaAvulsoEquipes = () => {
    setSelectedMesaAvulsoEquipeIds(mesaAvulsoEquipesDaCor.map(equipe => equipe.id));
  };

  const handleClearMesaAvulsoEquipes = () => {
    setSelectedMesaAvulsoEquipeIds([]);
  };

  const handleAddMesaAvulso = (item: MesaBadgeItem) => {
    setMesaAvulsosSelecionados(current =>
      current.some(selected => selected.id === item.id) ? current : [...current, item]
    );
  };

  const handleRemoveMesaAvulso = (itemId: string) => {
    setMesaAvulsosSelecionados(current => current.filter(item => item.id !== itemId));
  };

  const handleClearMesaAvulsos = () => {
    setMesaAvulsosSelecionados([]);
  };

  return (
    <section className="relatorios-page fade-in">
      <PageHeader
        title={activeReport === 'relacao-crachas' ? 'Relação de crachás' : 'Crachás de mesa'}
        subtitle="Secretaria / Impressos"
        backPath="/secretaria/impressos"
      />

      {!mode && <div className="relatorios-options">
        {relatorioOptions.map(option => {
          const isActive = activeReport === option.id;
          const Icon = option.id === 'relacao-crachas' ? FileText : TableProperties;

          return (
            <button
              type="button"
              className={`relatorios-option ${isActive ? 'relatorios-option--active' : ''}`}
              key={option.id}
              onClick={() => setActiveReport(option.id)}
            >
              <span className="relatorios-option__icon">
                <Icon size={22} />
              </span>
              <span>
                <strong>{option.title}</strong>
                <small>{option.description}</small>
              </span>
            </button>
          );
        })}
      </div>}

      <div className={`card relatorios-filters ${activeReport === 'crachas-mesa' ? 'relatorios-filters--single' : ''}`}>
        <div className="form-group">
          <label className="form-label" htmlFor="relatorios-encontro">Encontro</label>
          <select
            id="relatorios-encontro"
            className="form-input"
            value={selectedEncontroId}
            onChange={event => setSelectedEncontroId(event.target.value)}
            disabled={!canChangeEncontro || loadingEncontros}
          >
            {encontros.map(encontro => (
              <option key={encontro.id} value={encontro.id}>
                {encontro.edicao ? `${encontro.edicao}º EJC` : encontro.nome}
                {encontro.tema ? ` - ${encontro.tema}` : ''}
                {encontro.ativo ? ' (Ativo)' : ''}
              </option>
            ))}
          </select>
        </div>

        {activeReport === 'relacao-crachas' && (
          <div className="form-group">
            <label className="form-label" htmlFor="relatorios-search">Buscar</label>
            <div className="form-input-wrapper">
              <div className="form-input-icon">
                <Search size={16} />
              </div>
              <input
                id="relatorios-search"
                className="form-input form-input--with-icon"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Nome, círculo, equipe ou cor..."
              />
            </div>
          </div>
        )}
      </div>

      {activeReport === 'relacao-crachas' && (
        <div className="relatorios-actions relatorios-actions--below-filters">
          <button type="button" className="btn-secondary flex items-center gap-2" onClick={handleCopy} disabled={isLoading || filteredItems.length === 0}>
            <Copy size={18} />
            Copiar para Excel
          </button>
          <button type="button" className="btn-primary flex items-center gap-2" onClick={handleExportExcel} disabled={isLoading || filteredItems.length === 0}>
            <Download size={18} />
            Exportar Excel
          </button>
        </div>
      )}

      {activeReport === 'crachas-mesa' ? (
        <section className="mesa-report">
          <style>{'@media print { @page { margin: 0; size: A4 portrait; } }'}</style>
          <div className="mesa-report__actions">
            <div>
              <h2>Crachás de mesa</h2>
              <p>
                Imprima as listas separadamente: encontristas em papel branco e encontreiros conforme as equipes selecionadas.
              </p>
            </div>
          </div>

          <div className="mesa-report-tabs" role="tablist" aria-label="Tipo de crachá de mesa">
            <button
              type="button"
              role="tab"
              aria-selected={mesaReportTab === 'gerais'}
              className={mesaReportTab === 'gerais' ? 'is-active' : ''}
              onClick={() => setMesaReportTab('gerais')}
            >
              Listas gerais
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mesaReportTab === 'avulsos'}
              className={mesaReportTab === 'avulsos' ? 'is-active' : ''}
              onClick={() => setMesaReportTab('avulsos')}
            >
              Avulsos
            </button>
          </div>

          {mesaReportTab === 'gerais' && <div className="mesa-report__team-filter card">
            <div className="form-group">
              <label className="form-label" htmlFor="mesa-equipe-cor">Cor das equipes de encontreiros</label>
              <select
                id="mesa-equipe-cor"
                className="form-input"
                value={mesaEquipeCor}
                onChange={event => setMesaEquipeCor(event.target.value as MesaEquipeCorFilter)}
              >
                {mesaEquipeCores.map(cor => (
                  <option key={cor} value={cor}>
                    {cor}
                  </option>
                ))}
              </select>
            </div>

            <div className="mesa-team-picker">
              <div className="mesa-team-picker__header">
                <div>
                  <strong>Equipes {mesaEquipeCorPlural[mesaEquipeCor]}</strong>
                  <span>
                    {selectedMesaEquipeIds.length} de {mesaEquipesDaCor.length} selecionada(s)
                  </span>
                </div>
                <div>
                  <button type="button" className="btn-secondary" onClick={handleSelectAllMesaEquipes} disabled={mesaEquipesDaCor.length === 0}>
                    Selecionar todas
                  </button>
                  <button type="button" className="btn-secondary" onClick={handleClearMesaEquipes} disabled={selectedMesaEquipeIds.length === 0}>
                    Limpar
                  </button>
                </div>
              </div>

              {mesaEquipesDaCor.length === 0 ? (
                <p className="mesa-team-picker__empty">Nenhuma equipe desta cor encontrada neste encontro.</p>
              ) : (
                <div className="mesa-team-picker__grid">
                  {mesaEquipesDaCor.map(equipe => (
                    <label className={`mesa-team-checkbox mesa-team-checkbox--${equipe.cor.toLowerCase()}`} key={equipe.id}>
                      <input
                        type="checkbox"
                        checked={selectedMesaEquipeIds.includes(equipe.id)}
                        onChange={() => handleMesaEquipeToggle(equipe.id)}
                      />
                      <span>{equipe.nome}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>}

          {mesaReportTab === 'avulsos' && <section className="mesa-avulsos card">
            <header className="mesa-avulsos__header">
              <div>
                <h3>Crachás de mesa avulsos</h3>
                <p>Escolha o tipo, busque as pessoas e monte uma impressão manual.</p>
              </div>
              <div className="mesa-avulsos__actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleClearMesaAvulsos}
                  disabled={mesaAvulsosSelecionados.length === 0}
                >
                  Limpar seleção
                </button>
                <button
                  type="button"
                  className="btn-primary flex items-center gap-2"
                  onClick={() => handlePrintMesa('avulsos')}
                  disabled={isLoading || mesaAvulsosSelecionados.length === 0}
                >
                  <TableProperties size={16} />
                  Imprimir avulsos ({mesaAvulsosSelecionados.length})
                </button>
              </div>
            </header>

            <div className="mesa-avulsos__filters">
              <div className="form-group">
                <label className="form-label" htmlFor="mesa-avulso-tipo">Tipo</label>
                <select
                  id="mesa-avulso-tipo"
                  className="form-input"
                  value={mesaAvulsoTipo}
                  onChange={event => setMesaAvulsoTipo(event.target.value as MesaAvulsoTipo)}
                >
                  {Object.entries(mesaAvulsoTipoLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="mesa-avulso-search">Buscar</label>
                <div className="form-input-wrapper">
                  <div className="form-input-icon">
                    <Search size={16} />
                  </div>
                  <input
                    id="mesa-avulso-search"
                    className="form-input form-input--with-icon"
                    value={mesaAvulsoSearch}
                    onChange={event => setMesaAvulsoSearch(event.target.value)}
                    placeholder="Nome, círculo, equipe ou responsável..."
                  />
                </div>
              </div>
            </div>

            {mesaAvulsoTipo === 'encontreiro' && (
              <div className="mesa-team-picker mesa-avulsos__team-filter">
                <div className="mesa-team-picker__header">
                  <div>
                    <strong>Equipes {mesaEquipeCorPlural[mesaAvulsoEquipeCor]}</strong>
                    <span>
                      {selectedMesaAvulsoEquipeIds.length} de {mesaAvulsoEquipesDaCor.length} selecionada(s)
                    </span>
                  </div>
                  <div>
                    <select
                      className="form-input mesa-avulsos__team-color"
                      value={mesaAvulsoEquipeCor}
                      onChange={event => setMesaAvulsoEquipeCor(event.target.value as MesaEquipeCorFilter)}
                      aria-label="Cor das equipes avulsas"
                    >
                      {mesaEquipeCores.map(cor => (
                        <option key={cor} value={cor}>
                          {cor}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="btn-secondary" onClick={handleSelectAllMesaAvulsoEquipes} disabled={mesaAvulsoEquipesDaCor.length === 0}>
                      Selecionar todas
                    </button>
                    <button type="button" className="btn-secondary" onClick={handleClearMesaAvulsoEquipes} disabled={selectedMesaAvulsoEquipeIds.length === 0}>
                      Limpar
                    </button>
                  </div>
                </div>

                {mesaAvulsoEquipesDaCor.length === 0 ? (
                  <p className="mesa-team-picker__empty">Nenhuma equipe desta cor encontrada neste encontro.</p>
                ) : (
                  <div className="mesa-team-picker__grid">
                    {mesaAvulsoEquipesDaCor.map(equipe => (
                      <label className={`mesa-team-checkbox mesa-team-checkbox--${equipe.cor.toLowerCase()}`} key={equipe.id}>
                        <input
                          type="checkbox"
                          checked={selectedMesaAvulsoEquipeIds.includes(equipe.id)}
                          onChange={() => handleMesaAvulsoEquipeToggle(equipe.id)}
                        />
                        <span>{equipe.nome}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mesa-avulsos__lists">
              <div className="mesa-avulsos__list">
                <h4>Disponíveis ({mesaAvulsoCandidates.length})</h4>
                <div className="mesa-avulsos__items">
                  {mesaAvulsoCandidates.length === 0 ? (
                    <p className="mesa-avulsos__empty">Nenhum registro encontrado.</p>
                  ) : mesaAvulsoCandidates.map(item => {
                    const alreadySelected = mesaAvulsosSelecionados.some(selected => selected.id === item.id);

                    return (
                      <button
                        type="button"
                        className="mesa-avulso-item"
                        key={item.id}
                        onClick={() => handleAddMesaAvulso(item)}
                        disabled={alreadySelected}
                      >
                        <span>
                          <strong>{item.nome}</strong>
                          <small>{item.grupo}</small>
                        </span>
                        <Plus size={16} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mesa-avulsos__list">
                <h4>Selecionados ({mesaAvulsosSelecionados.length})</h4>
                <div className="mesa-avulsos__items">
                  {mesaAvulsosSelecionados.length === 0 ? (
                    <p className="mesa-avulsos__empty">Adicione pessoas para imprimir.</p>
                  ) : mesaAvulsosSelecionados.map(item => (
                    <button
                      type="button"
                      className="mesa-avulso-item mesa-avulso-item--selected"
                      key={item.id}
                      onClick={() => handleRemoveMesaAvulso(item.id)}
                    >
                      <span>
                        <strong>{item.nome}</strong>
                        <small>{item.grupo}</small>
                      </span>
                      <Trash2 size={16} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>}

          <div className="mesa-report__previews">
            {mesaReportTab === 'gerais' && <>
              <MesaPrintArea
                className="mesa-print-area--encontristas"
                encontro={selectedEncontro}
                items={mesaEncontristasPages}
                logoEjc={logoEjc}
                onPrint={() => handlePrintMesa('encontristas')}
                printDisabled={isLoading || mesaEncontristas.length === 0}
                printLabel={`Imprimir (${mesaEncontristas.length})`}
                title="Encontristas"
              />
              <MesaPrintArea
                className="mesa-print-area--encontreiros"
                encontro={selectedEncontro}
                items={mesaEncontreirosPages}
                logoEjc={logoEjc}
                onPrint={() => handlePrintMesa('encontreiros')}
                printDisabled={isLoading || mesaEncontreiros.length === 0}
                printLabel={`Imprimir (${mesaEncontreiros.length})`}
                title="Encontreiros"
              />
              <MesaPrintArea
                className="mesa-print-area--recreacao"
                encontro={selectedEncontro}
                items={mesaRecreacaoPages}
                logoEjc={logoEjc}
                onPrint={() => handlePrintMesa('recreacao')}
                printDisabled={isLoading || mesaRecreacao.length === 0}
                printLabel={`Imprimir (${mesaRecreacao.length})`}
                title="Recreação Infantil"
              />
            </>}
            {mesaReportTab === 'avulsos' && (
              <MesaPrintArea
                className="mesa-print-area--avulsos"
                encontro={selectedEncontro}
                items={mesaAvulsosPages}
                logoEjc={logoEjc}
                onPrint={() => handlePrintMesa('avulsos')}
                printDisabled={isLoading || mesaAvulsosSelecionados.length === 0}
                printLabel={`Imprimir (${mesaAvulsosSelecionados.length})`}
                title="Avulsos"
              />
            )}
          </div>
        </section>
      ) : isLoading ? (
        <div className="relatorios-loading">
          <Loader size={40} className="animate-spin" />
          <p>Carregando relação...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="card relatorios-empty">
          <FileText size={48} />
          <h3>Nenhum registro encontrado</h3>
          <p>Ajuste o encontro ou a busca para gerar a relação.</p>
        </div>
      ) : (
        <div className="relatorios-groups">
          {cores.map(cor => (
            <article className={`relatorio-group relatorio-group--${cor.toLowerCase()}`} key={cor}>
              <header>
                <div>
                  <span>{cor}</span>
                  <strong>{groupedItems[cor].length}</strong>
                </div>
                <small>{descricaoCor[cor]}</small>
              </header>

              <div className="relatorio-table-wrap">
                <table className="relatorio-table">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>{cor === 'Branco' ? 'Círculo' : 'Equipe'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedItems[cor].map(item => (
                      <tr key={item.id}>
                        <td>{item.nome}</td>
                        <td>{cor === 'Branco' ? item.circulo : item.equipe}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

interface MesaPrintAreaProps {
  className: string;
  encontro?: Encontro;
  items: MesaBadgeItem[][];
  logoEjc: string;
  onPrint: () => void;
  printDisabled: boolean;
  printLabel: string;
  title: string;
}

function MesaPrintArea({ className, encontro, items, logoEjc, onPrint, printDisabled, printLabel, title }: MesaPrintAreaProps) {
  return (
    <section className={`mesa-print-area ${className}`}>
      <header className="mesa-print-area__header">
        <h3>{title}</h3>
        <button type="button" className="btn-primary flex items-center gap-2" onClick={onPrint} disabled={printDisabled}>
          <TableProperties size={16} />
          {printLabel}
        </button>
      </header>
      {items.length === 0 ? (
        <div className="card relatorios-empty mesa-print-area__empty">
          <TableProperties size={40} />
          <p>Nenhum registro para esta lista.</p>
        </div>
      ) : (
        items.map((page, pageIndex) => (
          <div className="mesa-sheet" key={`${className}-${pageIndex}`}>
            {page.map(item => (
              <article className="mesa-badge" key={item.id}>
                <header className="mesa-badge__top">
                  <div className="mesa-badge__logo-box">
                    <img src={logoEjc} alt="Logo EJC" />
                  </div>

                  <div className="mesa-badge__event">
                    <strong>{encontro?.edicao ? `${encontro.edicao}º EJC` : encontro?.nome || 'EJC'}</strong>
                    <span>{encontro?.tema ? `"${encontro.tema}"` : ''}</span>
                  </div>

                  <div className="mesa-badge__logo-box">
                    {encontro?.logo_url ? (
                      <img src={encontro.logo_url} alt={`Logo ${encontro.nome}`} />
                    ) : (
                      <span>Logo encontro</span>
                    )}
                  </div>
                </header>

                <div className="mesa-badge__person">
                  {item.icone === 'infantil' && (
                    <Baby className="mesa-badge__child-icon" aria-hidden="true" />
                  )}
                  <strong>{item.nome}</strong>
                  <span>{item.grupo}</span>
                </div>

                <div className="mesa-badge__base">
                  {item.detalhes?.map(detalhe => (
                    <small key={detalhe}>{detalhe}</small>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ))
      )}
    </section>
  );
}
