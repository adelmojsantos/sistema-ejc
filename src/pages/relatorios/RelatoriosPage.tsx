import { Baby, Copy, Download, FileText, Loader, Search, TableProperties } from 'lucide-react';
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
type MesaPrintTipo = 'encontristas' | 'encontreiros' | 'recreacao';

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
  const [mesaEquipeCor, setMesaEquipeCor] = useState<MesaEquipeCorFilter>('Verde');
  const [selectedMesaEquipeIds, setSelectedMesaEquipeIds] = useState<string[]>([]);

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

  useEffect(() => {
    setSelectedMesaEquipeIds(mesaEquipesDaCor.map(equipe => equipe.id));
  }, [mesaEquipesDaCor]);

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
    })), 15),
    [mesaEncontristas]
  );
  const mesaEncontreirosPages = useMemo(
    () => chunkItems(mesaEncontreiros.map(item => ({
      id: item.id,
      nome: item.nome,
      grupo: item.equipe,
    })), 15),
    [mesaEncontreiros]
  );
  const mesaRecreacaoPages = useMemo(() => chunkItems(mesaRecreacao, 15), [mesaRecreacao]);

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
          : mesaRecreacao;

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

          <div className="mesa-report__team-filter card">
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
          </div>

          <div className="mesa-report__previews">
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
