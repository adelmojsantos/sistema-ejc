import { useState, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  ChevronLeft,
  Upload,
  CheckCircle,
  AlertTriangle,
  Users,
  Shield,
  FileSpreadsheet,
  AlertCircle,
  Loader,
  History,
  CalendarPlus
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { pessoaService } from '../../services/pessoaService';
import { equipeService } from '../../services/equipeService';
import { inscricaoService } from '../../services/inscricaoService';
import { encontroService } from '../../services/encontroService';
import { findSimilarPeoples } from '../../utils/similarity';
import { encontroFormDataVazio, type Encontro } from '../../types/encontro';
import type { Equipe } from '../../types/equipe';
import type { Pessoa, PessoaFormData } from '../../types/pessoa';
import type { InscricaoFormData } from '../../types/inscricao';

interface RawRow {
  [key: string]: unknown;
}

type ImportMode = 'encontro-atual' | 'historico';
type RowStatus = 'new' | 'match' | 'ignore' | 'multiple-matches' | 'already-linked' | 'missing-encontro';

interface ProcessedRow {
  id: string;
  nome: string;
  endereco: string;
  numero: string;
  bairro: string;
  telefone: string;
  equipeOriginal: string;
  funcaoOriginal: string;
  isCoordenador: boolean;
  matchedPessoa: Pessoa | null;
  possibleMatches?: Pessoa[];
  status: RowStatus;
  selected: boolean;
  pessoaId?: string;
  equipeId?: string;
  importResult?: 'success' | 'error' | 'skipped';
  errorMessage?: string;
  encontroId?: string | null;
  encontroEdicao?: number | null;
  encontroNome?: string;
  encontroDataInicio?: string;
  encontroDataFim?: string;
  encontroNeedsCreation?: boolean;
}

interface ProcessedSheet {
  sheetName: string;
  rows: ProcessedRow[];
  teamId: string | null;
  status: 'existing' | 'create';
}

const getRowValue = (raw: RawRow, keys: string[]) => {
  const normalizedKeys = keys.map(normalizeHeader);
  const rowKey = Object.keys(raw).find(rk => normalizedKeys.includes(normalizeHeader(rk)));
  return rowKey ? String(raw[rowKey] ?? '').trim() : '';
};

const normalizeHeader = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

const normalizeName = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const getStableRowId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 11);

const parseEdition = (value: string) => {
  const match = value.match(/\d{1,3}/);
  if (!match) return null;
  const edition = Number(match[0]);
  return Number.isFinite(edition) && edition > 0 ? edition : null;
};

const normalizeDate = (value: string) => {
  if (!value.trim()) return '';
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const brMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!brMatch) return '';

  const [, day, month, rawYear] = brMatch;
  const yearNumber = Number(rawYear.length === 2 ? `20${rawYear}` : rawYear);
  if (!yearNumber || Number(day) < 1 || Number(day) > 31 || Number(month) < 1 || Number(month) > 12) return '';

  return `${yearNumber}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

const inferEncounterName = (edition: number | null, rawName: string) => {
  if (rawName.trim()) return rawName.trim();
  if (edition) return `${edition}º EJC`;
  return '';
};

export function ImportarDadosPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [encontros, setEncontros] = useState<Encontro[]>([]);
  const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');
  const [, setIsDataLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progressCount, setProgressCount] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [importMode, setImportMode] = useState<ImportMode>('encontro-atual');
  const [defaultHistoricalEdition, setDefaultHistoricalEdition] = useState('');
  const [defaultHistoricalStartDate, setDefaultHistoricalStartDate] = useState('');
  const [defaultHistoricalEndDate, setDefaultHistoricalEndDate] = useState('');

  const [sheets, setSheets] = useState<ProcessedSheet[]>([]);
  const [allTeams, setAllTeams] = useState<Equipe[]>([]);
  const [allPessoas, setAllPessoas] = useState<Pessoa[]>([]);
  const [existingParticipationKeys, setExistingParticipationKeys] = useState<Set<string>>(new Set());

  const activeEncounter = useMemo(() => encontros.find(e => e.ativo) ?? null, [encontros]);
  const maxKnownEdition = useMemo(
    () => Math.max(0, ...encontros.map(e => e.edicao ?? 0)),
    [encontros]
  );

  const selectedEncounter = useMemo(
    () => encontros.find(e => e.id === selectedEncontroId) ?? null,
    [encontros, selectedEncontroId]
  );

  useEffect(() => {
    async function init() {
      try {
        const [encontrosData, equipesData, pessoasData, participacoesData] = await Promise.all([
          encontroService.listar(),
          equipeService.listar(),
          pessoaService.listar(),
          inscricaoService.listar()
        ]);

        setEncontros(encontrosData);
        setAllTeams(equipesData);
        setAllPessoas(pessoasData);
        setExistingParticipationKeys(new Set(
          participacoesData.map(p => `${p.pessoa_id}:${p.encontro_id}`)
        ));

        const active = encontrosData.find(e => e.ativo);
        if (active) setSelectedEncontroId(active.id);
        else if (encontrosData.length > 0) setSelectedEncontroId(encontrosData[0].id);
      } catch {
        toast.error('Erro ao carregar dados iniciais.');
      } finally {
        setIsDataLoading(false);
      }
    }
    init();
  }, []);

  const resolveEncounter = (raw: RawRow, sheetName: string) => {
    if (importMode === 'encontro-atual') {
      return {
        encontroId: selectedEncontroId,
        encontroEdicao: selectedEncounter?.edicao ?? null,
        encontroNome: selectedEncounter?.nome ?? '',
        encontroDataInicio: selectedEncounter?.data_inicio ?? '',
        encontroDataFim: selectedEncounter?.data_fim ?? '',
        encontroNeedsCreation: false
      };
    }

    const rawEdition = getRowValue(raw, ['EDICAO', 'EDIÇÃO', 'N ENCONTRO', 'Nº ENCONTRO', 'ENCONTRO NUMERO', 'ENCONTRO N']);
    const rawEncounterName = getRowValue(raw, ['ENCONTRO', 'NOME ENCONTRO', 'NOME DO ENCONTRO']);
    const edition = parseEdition(rawEdition) ?? parseEdition(rawEncounterName) ?? parseEdition(sheetName) ?? parseEdition(defaultHistoricalEdition);
    const found = edition
      ? encontros.find(e => e.edicao === edition)
      : encontros.find(e => normalizeName(e.nome) === normalizeName(rawEncounterName));

    const startDate = normalizeDate(getRowValue(raw, ['DATA INICIO', 'DATA INÍCIO', 'INICIO', 'INÍCIO', 'DATA']))
      || defaultHistoricalStartDate;
    const endDate = normalizeDate(getRowValue(raw, ['DATA FIM', 'FIM']))
      || defaultHistoricalEndDate
      || startDate;

    return {
      encontroId: found?.id ?? null,
      encontroEdicao: edition,
      encontroNome: found?.nome ?? inferEncounterName(edition, rawEncounterName),
      encontroDataInicio: found?.data_inicio ?? startDate,
      encontroDataFim: found?.data_fim ?? endDate,
      encontroNeedsCreation: !found
    };
  };

  const processWorkbook = async (file: File) => {
    setIsProcessing(true);
    setProgressCount(0);
    setProgressTotal(0);
    setProgressText('Lendo arquivo...');
    setSheets([]);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);

      setProgressText('Analisando estrutura e abas...');
      let totalRows = 0;
      const parsedSheets: { sheetName: string, rawData: RawRow[] }[] = [];

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const rowsArray = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '' });
        let headerRowIdx = 0;

        for (let i = 0; i < rowsArray.length; i++) {
          const row = rowsArray[i];
          if (!row || !Array.isArray(row)) continue;

          const hasNome = row.some(cell => {
            const val = normalizeHeader(String(cell || ''));
            return val === 'nome' || val === 'nomecompleto';
          });

          if (hasNome) {
            headerRowIdx = i;
            break;
          }
        }

        const rawData = XLSX.utils.sheet_to_json<RawRow>(worksheet, { range: headerRowIdx, defval: '' });
        if (rawData.length === 0) continue;

        parsedSheets.push({ sheetName, rawData });
        totalRows += rawData.length;
      }

      setProgressTotal(totalRows);

      const processedSheets: ProcessedSheet[] = [];
      let currentCount = 0;

      for (const { sheetName, rawData } of parsedSheets) {
        const matchedTeam = allTeams.find(t =>
          (t.nome?.toLowerCase() === sheetName.toLowerCase()) ||
          (t.nome?.toLowerCase().includes(sheetName.toLowerCase())) ||
          (sheetName.toLowerCase().includes(t.nome?.toLowerCase() || ''))
        );

        const rows: ProcessedRow[] = [];

        for (const raw of rawData) {
          const nome = getRowValue(raw, ['NOME', 'NOME COMPLETO']);
          if (!nome) {
            currentCount++;
            setProgressCount(currentCount);
            continue;
          }

          setProgressText(`Verificando: ${nome.split(' ')[0]}...`);

          const telefone = getRowValue(raw, ['TELEFONE', 'WHATSAPP', 'CELULAR']).replace(/\D/g, '');
          const funcao = getRowValue(raw, ['COORD/ENCONT', 'FUNCAO', 'FUNÇÃO', 'CARGO', 'ROLE']).toUpperCase();
          const isCoordenador = funcao.includes('COORDENADOR') || funcao === 'COORD';
          const matches = findSimilarPeoples(nome, allPessoas, telefone);
          const encounter = resolveEncounter(raw, sheetName);

          let matchedPessoa: Pessoa | null = null;
          let status: RowStatus = 'new';

          if (matches.length === 1) {
            matchedPessoa = matches[0];
            status = 'match';
          } else if (matches.length > 1) {
            status = 'multiple-matches';
          }

          if (importMode === 'historico' && (!encounter.encontroEdicao || !encounter.encontroNome)) {
            status = 'missing-encontro';
          }

          if (matchedPessoa && encounter.encontroId && existingParticipationKeys.has(`${matchedPessoa.id}:${encounter.encontroId}`)) {
            status = 'already-linked';
          }

          rows.push({
            id: getStableRowId(),
            nome,
            endereco: getRowValue(raw, ['ENDERECO', 'ENDEREÇO', 'RUA']),
            numero: getRowValue(raw, ['N', 'Nº', 'NUMERO', 'NÚMERO']),
            bairro: getRowValue(raw, ['BAIRRO']),
            telefone,
            equipeOriginal: sheetName,
            funcaoOriginal: getRowValue(raw, ['COORD/ENCONT', 'FUNCAO', 'FUNÇÃO', 'CARGO', 'ROLE']),
            isCoordenador,
            matchedPessoa,
            possibleMatches: matches,
            status,
            selected: status !== 'already-linked' && status !== 'missing-encontro',
            ...encounter
          });

          currentCount++;
          setProgressCount(currentCount);
        }

        if (rows.length > 0) {
          processedSheets.push({
            sheetName,
            rows,
            teamId: matchedTeam?.id || null,
            status: matchedTeam ? 'existing' : 'create'
          });
        }
      }

      setSheets(processedSheets);
      if (processedSheets.length === 0) {
        toast.error('Nenhum dado válido encontrado na planilha.');
      } else {
        toast.success(`${processedSheets.length} abas processadas para revisão.`);
      }
    } catch {
      console.error('Erro ao ler planilha');
      toast.error('Erro ao ler a planilha. Verifique o formato.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processWorkbook(file);
  };

  const handleToggleRow = (sheetIdx: number, rowIdx: number) => {
    const newSheets = [...sheets];
    const row = newSheets[sheetIdx].rows[rowIdx];
    if (row.status === 'already-linked' || row.status === 'missing-encontro') return;
    row.selected = !row.selected;
    setSheets(newSheets);
  };

  const handleToggleAll = (sheetIdx: number) => {
    const newSheets = [...sheets];
    const eligibleRows = newSheets[sheetIdx].rows.filter(r => r.status !== 'already-linked' && r.status !== 'missing-encontro');
    const allSelected = eligibleRows.every(r => r.selected);
    eligibleRows.forEach(r => r.selected = !allSelected);
    setSheets(newSheets);
  };

  const toggleRowStatus = (sheetIdx: number, rowIdx: number) => {
    const newSheets = [...sheets];
    const row = newSheets[sheetIdx].rows[rowIdx];
    if (row.status === 'already-linked' || row.status === 'missing-encontro') return;

    if (row.status === 'match' && row.matchedPessoa) {
      row.status = 'new';
      row.matchedPessoa = null;
    } else if (row.status === 'new' && row.possibleMatches?.length === 1) {
      row.status = 'match';
      row.matchedPessoa = row.possibleMatches[0];
    } else if (row.status === 'new' && row.possibleMatches && row.possibleMatches.length > 1) {
      row.status = 'multiple-matches';
      row.matchedPessoa = null;
    }
    setSheets(newSheets);
  };

  const handleSelectMatch = (sheetIdx: number, rowIdx: number, pessoaId: string) => {
    const newSheets = [...sheets];
    const row = newSheets[sheetIdx].rows[rowIdx];

    if (pessoaId === 'new') {
      row.status = 'new';
      row.matchedPessoa = null;
    } else {
      const selected = row.possibleMatches?.find(p => p.id === pessoaId);
      if (selected) {
        if (row.encontroId && existingParticipationKeys.has(`${selected.id}:${row.encontroId}`)) {
          row.status = 'already-linked';
          row.selected = false;
        } else {
          row.status = 'match';
          row.matchedPessoa = selected;
          row.selected = true;
        }
      }
    }
    setSheets(newSheets);
  };

  const getRowTargetEncontroId = (row: ProcessedRow, encounterMap: Map<number, string>) => {
    if (importMode === 'encontro-atual') return selectedEncontroId;
    if (row.encontroId) return row.encontroId;
    if (row.encontroEdicao) return encounterMap.get(row.encontroEdicao) ?? '';
    return '';
  };

  const createMissingHistoricalEncounters = async (rowsToImport: ProcessedRow[]) => {
    const encounterMap = new Map<number, string>();
    const missing = missingEncounters.filter(item =>
      rowsToImport.some(row => row.encontroEdicao === item.edicao)
    );

    for (const item of missing) {
      if (!item.dataInicio || !item.dataFim) {
        throw new Error(`Informe data de início e fim para criar o encontro ${item.edicao}.`);
      }

      if (activeEncounter?.edicao && item.edicao >= activeEncounter.edicao) {
        throw new Error(`A edição ${item.edicao} não pode ser criada como histórico porque é igual ou posterior ao encontro ativo.`);
      }

      const form = {
        ...encontroFormDataVazio(),
        nome: item.nome,
        edicao: item.edicao,
        data_inicio: item.dataInicio,
        data_fim: item.dataFim,
        ativo: false,
        formulario_publico_ativo: false,
        descricao: 'Criado pela importação de histórico.'
      };

      const created = await encontroService.criar(form);
      encounterMap.set(item.edicao, created.id);
    }

    return encounterMap;
  };

  const startImport = async () => {
    if (importMode === 'encontro-atual' && !selectedEncontroId) {
      toast.error('Selecione um encontro primeiro.');
      return;
    }

    const rowsToImport = sheets.flatMap(sheet => sheet.rows.filter(row => row.selected));
    if (rowsToImport.some(row => row.status === 'multiple-matches')) {
      toast.error('Resolva as correspondências múltiplas antes de importar.');
      return;
    }

    if (rowsToImport.some(row => row.status === 'missing-encontro')) {
      toast.error('Há linhas sem encontro histórico identificado.');
      return;
    }

    setIsImporting(true);
    let successCount = 0;
    let skippedCount = 0;

    try {
      const teamMap = new Map<string, string>();

      for (const sheet of sheets) {
        if (sheet.status === 'create') {
          const newTeam = await equipeService.criar({
            nome: sheet.sheetName,
            acesso_plenario: 'verde',
            aparece_pos_encontro: true
          });
          teamMap.set(sheet.sheetName, newTeam.id);
          sheet.teamId = newTeam.id;
          sheet.status = 'existing';
        } else if (sheet.teamId) {
          teamMap.set(sheet.sheetName, sheet.teamId);
        }
      }

      const encounterMap = importMode === 'historico'
        ? await createMissingHistoricalEncounters(rowsToImport)
        : new Map<number, string>();

      const newParticipationKeys = new Set(existingParticipationKeys);

      for (const sheet of sheets) {
        const teamId = teamMap.get(sheet.sheetName);
        if (!teamId) continue;

        for (const row of sheet.rows.filter(r => r.selected)) {
          try {
            let finalPessoaId = '';
            const targetEncontroId = getRowTargetEncontroId(row, encounterMap);

            if (!targetEncontroId) {
              row.importResult = 'error';
              row.errorMessage = 'Encontro alvo não identificado.';
              continue;
            }

            if (row.status === 'match' && row.matchedPessoa) {
              finalPessoaId = row.matchedPessoa.id;
            } else {
              const pessoaData: PessoaFormData = {
                nome_completo: row.nome,
                telefone: row.telefone,
                endereco: row.endereco || null,
                numero: row.numero || null,
                bairro: row.bairro || null,
                cidade: 'Franca',
                complemento: '',
                estado: 'SP',
                cep: null,
                data_nascimento: null,
                cpf: null,
                email: null,
                comunidade: '',
                nome_pai: null,
                nome_mae: null,
                telefone_pai: null,
                telefone_mae: null,
                outros_contatos: null,
                fez_ejc_outra_paroquia: false,
                qual_paroquia_ejc: null
              };
              const newPessoa = await pessoaService.criar(pessoaData, {
                automaticApproximateLocation: false,
              });
              finalPessoaId = newPessoa.id;
              setAllPessoas(prev => [...prev, newPessoa]);
            }

            const participationKey = `${finalPessoaId}:${targetEncontroId}`;
            if (newParticipationKeys.has(participationKey)) {
              row.status = 'already-linked';
              row.importResult = 'skipped';
              row.selected = false;
              skippedCount++;
              continue;
            }

            const existing = await inscricaoService.buscarPorPessoaEEncontro(finalPessoaId, targetEncontroId);
            if (existing) {
              newParticipationKeys.add(participationKey);
              row.status = 'already-linked';
              row.importResult = 'skipped';
              row.selected = false;
              skippedCount++;
              continue;
            }

            const participationData: InscricaoFormData = {
              pessoa_id: finalPessoaId,
              encontro_id: targetEncontroId,
              equipe_id: teamId,
              coordenador: row.isCoordenador,
              participante: false,
              dados_confirmados: importMode === 'historico',
              confirmado_em: importMode === 'historico' ? new Date().toISOString() : null,
              pago_taxa: false,
              pago_camiseta: false,
              origem: importMode === 'historico' ? 'historico_importacao' : 'sistema'
            };

            await inscricaoService.criar(participationData);
            newParticipationKeys.add(participationKey);
            row.importResult = 'success';
            successCount++;
          } catch (error) {
            row.importResult = 'error';
            row.errorMessage = error instanceof Error ? error.message : 'Erro ao importar linha.';
          }
        }
      }

      setExistingParticipationKeys(newParticipationKeys);
      toast.success(`Importação concluída: ${successCount} vínculos criados${skippedCount ? `, ${skippedCount} ignorados` : ''}.`);
      setSheets([...sheets]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ocorreu um erro durante a importação.');
    } finally {
      setIsImporting(false);
    }
  };

  const totalSelected = useMemo(() => {
    return sheets.reduce((total, s) => total + s.rows.filter(r => r.selected).length, 0);
  }, [sheets]);

  const allRows = useMemo(() => sheets.flatMap(sheet => sheet.rows), [sheets]);
  const missingEncounters = useMemo(() => {
    const map = new Map<number, { edicao: number; nome: string; dataInicio: string; dataFim: string; total: number }>();

    for (const row of allRows) {
      if (!row.encontroNeedsCreation || !row.encontroEdicao) continue;
      const current = map.get(row.encontroEdicao);
      if (current) {
        current.total++;
      } else {
        map.set(row.encontroEdicao, {
          edicao: row.encontroEdicao,
          nome: row.encontroNome || `${row.encontroEdicao}º EJC`,
          dataInicio: row.encontroDataInicio || defaultHistoricalStartDate,
          dataFim: row.encontroDataFim || defaultHistoricalEndDate || row.encontroDataInicio || defaultHistoricalStartDate,
          total: 1
        });
      }
    }

    return [...map.values()].sort((a, b) => a.edicao - b.edicao);
  }, [allRows, defaultHistoricalEndDate, defaultHistoricalStartDate]);

  const summary = useMemo(() => ({
    matches: allRows.filter(row => row.status === 'match').length,
    newPeople: allRows.filter(row => row.status === 'new').length,
    conflicts: allRows.filter(row => row.status === 'multiple-matches').length,
    alreadyLinked: allRows.filter(row => row.status === 'already-linked').length,
    missingEncounterRows: allRows.filter(row => row.status === 'missing-encontro').length,
    teamsToCreate: sheets.filter(sheet => sheet.status === 'create').length
  }), [allRows, sheets]);

  const shouldBlockImport = summary.conflicts > 0 || summary.missingEncounterRows > 0 || totalSelected === 0;

  return (
    <div className="app-shell">
      <main className="main-content container page-fade-in">
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button onClick={() => navigate('/secretaria')} className="icon-btn">
              <ChevronLeft size={18} />
            </button>
            <div>
              <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55 }}>Secretaria</p>
              <h1 className="page-title">Importar Dados da Planilha</h1>
            </div>
          </div>
        </div>

        <div className="grid-container" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(0, 3fr)', gap: '1.5rem', alignItems: 'start' }}>
          <div className="card" style={{ position: 'sticky', top: '90px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={18} className="text-primary" /> Configuração
            </h3>

            <div className="form-group">
              <label className="form-label">Tipo de importação</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <button
                  type="button"
                  className={importMode === 'encontro-atual' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => {
                    setImportMode('encontro-atual');
                    setSheets([]);
                  }}
                >
                  <Users size={16} /> Encontro
                </button>
                <button
                  type="button"
                  className={importMode === 'historico' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => {
                    setImportMode('historico');
                    setSheets([]);
                  }}
                >
                  <History size={16} /> Histórico
                </button>
              </div>
            </div>

            {importMode === 'encontro-atual' ? (
              <div className="form-group">
                <label className="form-label">Encontro Alvo</label>
                <LiveSearchSelect<Encontro>
                  value={selectedEncontroId}
                  onChange={(val) => setSelectedEncontroId(val)}
                  fetchData={async (search, page) => await encontroService.buscarComPaginacao(search, page)}
                  getOptionLabel={(e) => `${e.nome}${e.tema ? ` (${e.tema})` : ''} ${e.ativo ? '(Ativo)' : ''}`}
                  getOptionValue={(e) => String(e.id)}
                  placeholder="Selecione um Encontro..."
                  initialOptions={encontros}
                />
                <p style={{ fontSize: '0.7rem', opacity: 0.5, marginTop: '0.5rem' }}>
                  Todos os importados serão vinculados a este encontro.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div className="alert alert--warning" style={{ fontSize: '0.78rem', lineHeight: 1.4 }}>
                  O modo histórico cria encontros faltantes como inativos e ignora participações já existentes.
                </div>
                <div className="form-group">
                  <label className="form-label">Edição padrão, se a planilha não informar</label>
                  <input
                    className="form-input"
                    type="number"
                    value={defaultHistoricalEdition}
                    onChange={(event) => {
                      setDefaultHistoricalEdition(event.target.value);
                      setSheets([]);
                    }}
                    placeholder={`Ex: ${Math.max(1, maxKnownEdition - 1)}`}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Data início padrão para criar encontro</label>
                  <input
                    className="form-input"
                    type="date"
                    value={defaultHistoricalStartDate}
                    onChange={(event) => {
                      setDefaultHistoricalStartDate(event.target.value);
                      setSheets([]);
                    }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Data fim padrão para criar encontro</label>
                  <input
                    className="form-input"
                    type="date"
                    value={defaultHistoricalEndDate}
                    onChange={(event) => {
                      setDefaultHistoricalEndDate(event.target.value);
                      setSheets([]);
                    }}
                  />
                </div>
              </div>
            )}

            <div
              className="import-dropzone"
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed var(--border-color)',
                borderRadius: '12px',
                padding: '2rem 1rem',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                backgroundColor: 'rgba(0,0,0,0.02)',
                marginTop: '1rem'
              }}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                hidden
                accept=".xlsx, .xls, .csv"
              />
              <Upload size={32} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Clique para selecionar a planilha</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', opacity: 0.5 }}>Formato: XLSX ou XLS</p>
            </div>

            {sheets.length > 0 && (
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.82rem', marginBottom: '1rem' }}>
                  <SummaryLine label="Selecionados" value={totalSelected} />
                  <SummaryLine label="Pessoas encontradas" value={summary.matches} />
                  <SummaryLine label="Pessoas novas" value={summary.newPeople} />
                  <SummaryLine label="Conflitos" value={summary.conflicts} tone={summary.conflicts ? 'danger' : undefined} />
                  <SummaryLine label="Já vinculadas" value={summary.alreadyLinked} />
                  <SummaryLine label="Equipes a criar" value={summary.teamsToCreate} />
                  {importMode === 'historico' && <SummaryLine label="Encontros a criar" value={missingEncounters.length} />}
                </div>
                <button
                  className="btn-primary"
                  style={{ width: '100%' }}
                  disabled={shouldBlockImport || isImporting}
                  onClick={startImport}
                >
                  {isImporting ? (
                    <><Loader size={16} className="animate-spin" /> Importando...</>
                  ) : (
                    <><CheckCircle size={16} /> Confirmar Importação</>
                  )}
                </button>
                <button
                  className="btn-text"
                  style={{ width: '100%', marginTop: '0.5rem', color: 'var(--danger-text)' }}
                  onClick={() => setSheets([])}
                >
                  Limpar Tudo
                </button>
              </div>
            )}
          </div>

          <div className="import-review-area">
            {isProcessing ? (
              <div className="card text-center py-12">
                <Loader size={48} className="animate-spin" style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
                <h3>Processando Planilha...</h3>
                <p className="text-muted" style={{ marginBottom: progressTotal > 0 ? '1.5rem' : 0 }}>
                  {progressText || 'Cruzando dados com o banco de dados atual.'}
                </p>
                {progressTotal > 0 && (
                  <div style={{ maxWidth: '400px', margin: '0 auto' }}>
                    <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          backgroundColor: 'var(--primary-color)',
                          width: `${Math.round((progressCount / progressTotal) * 100)}%`,
                          transition: 'width 0.2s ease'
                        }}
                      />
                    </div>
                    <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', fontWeight: 600 }}>
                      {progressCount} / {progressTotal} linhas analisadas ({Math.round((progressCount / progressTotal) * 100)}%)
                    </p>
                  </div>
                )}
              </div>
            ) : sheets.length === 0 ? (
              <div className="card text-center py-12" style={{ border: '2px dashed var(--border-color)', backgroundColor: 'transparent' }}>
                <FileSpreadsheet size={64} style={{ margin: '0 auto 1.5rem', opacity: 0.1 }} />
                <h3 className="text-muted">Nenhum dado para exibir</h3>
                <p className="text-muted" style={{ maxWidth: '420px', margin: '0 auto' }}>
                  Faça o upload da planilha para revisar pessoas, equipes, encontros e duplicidades antes de importar.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {importMode === 'historico' && missingEncounters.length > 0 && (
                  <div className="card" style={{ borderColor: 'rgba(245, 158, 11, 0.45)' }}>
                    <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CalendarPlus size={18} /> Encontros que serão criados
                    </h3>
                    <div style={{ display: 'grid', gap: '0.6rem' }}>
                      {missingEncounters.map(item => (
                        <div key={item.edicao} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.6rem', fontSize: '0.85rem' }}>
                          <strong>{item.nome}</strong>
                          <span className="text-muted">{item.dataInicio || 'sem data'} até {item.dataFim || 'sem data'} · {item.total} linhas</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {sheets.map((sheet, sIdx) => (
                  <div key={sIdx} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{
                      padding: '1rem 1.5rem',
                      backgroundColor: 'rgba(0,0,0,0.02)',
                      borderBottom: '1px solid var(--border-color)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '1rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '8px',
                          backgroundColor: sheet.status === 'create' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(37, 99, 235, 0.1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: sheet.status === 'create' ? '#f59e0b' : 'var(--primary-color)'
                        }}>
                          <Users size={18} />
                        </div>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{sheet.sheetName}</h3>
                          <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, opacity: 0.6 }}>
                            {sheet.status === 'create' ? 'Será criada como nova equipe' : 'Equipe já existe'}
                          </span>
                        </div>
                      </div>
                      <button className="btn-text" onClick={() => handleToggleAll(sIdx)}>
                        {sheet.rows.filter(r => r.status !== 'already-linked' && r.status !== 'missing-encontro').every(r => r.selected) ? 'Desmarcar Todos' : 'Selecionar Todos'}
                      </button>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '40px' }}></th>
                            <th>Status</th>
                            <th>Nome</th>
                            {importMode === 'historico' && <th>Encontro</th>}
                            <th>Telefone</th>
                            <th>Endereço</th>
                            <th>Cargo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sheet.rows.map((row, rIdx) => (
                            <tr key={row.id} style={{ opacity: row.selected ? 1 : 0.5 }}>
                              <td className="text-center">
                                <input
                                  type="checkbox"
                                  checked={row.selected}
                                  disabled={row.status === 'already-linked' || row.status === 'missing-encontro'}
                                  onChange={() => handleToggleRow(sIdx, rIdx)}
                                />
                              </td>
                              <td><RowStatusBadge row={row} onToggle={() => toggleRowStatus(sIdx, rIdx)} onSelect={(value) => handleSelectMatch(sIdx, rIdx, value)} /></td>
                              <td>
                                <div style={{ fontWeight: 600 }}>{row.nome}</div>
                                {row.matchedPessoa && (
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-color)', opacity: 0.7, marginTop: '0.2rem' }}>
                                    Vinculado a: <strong>{row.matchedPessoa.nome_completo}</strong>
                                  </div>
                                )}
                                {row.errorMessage && <div style={{ fontSize: '0.7rem', color: '#ef4444', marginTop: '0.2rem' }}>{row.errorMessage}</div>}
                              </td>
                              {importMode === 'historico' && (
                                <td>
                                  <div style={{ fontWeight: 600 }}>{row.encontroNome || 'Não identificado'}</div>
                                  <div style={{ fontSize: '0.7rem', opacity: 0.65 }}>
                                    {row.encontroNeedsCreation ? 'Será criado' : 'Encontrado'}{row.encontroEdicao ? ` · edição ${row.encontroEdicao}` : ''}
                                  </div>
                                </td>
                              )}
                              <td>{row.telefone || '-'}</td>
                              <td>{row.endereco ? `${row.endereco}, ${row.numero}` : '-'}</td>
                              <td>
                                <span style={{
                                  fontSize: '0.7rem', fontWeight: 700,
                                  color: row.isCoordenador ? '#ec4899' : '#6366f1',
                                  padding: '0.2rem 0.4rem', borderRadius: '4px',
                                  backgroundColor: row.isCoordenador ? 'rgba(236, 72, 153, 0.1)' : 'rgba(99, 102, 241, 0.1)'
                                }}>
                                  {row.funcaoOriginal || 'ENCONTREIRO'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function SummaryLine({ label, value, tone }: { label: string; value: number; tone?: 'danger' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', color: tone === 'danger' ? '#ef4444' : undefined }}>
      <span>{label}:</span>
      <strong>{value}</strong>
    </div>
  );
}

function RowStatusBadge({ row, onToggle, onSelect }: { row: ProcessedRow; onToggle: () => void; onSelect: (value: string) => void }) {
  if (row.importResult === 'success') return <CheckCircle size={16} color="#10b981" />;
  if (row.importResult === 'error') return <AlertCircle size={16} color="#ef4444" />;
  if (row.importResult === 'skipped') return <span style={badgeStyle('#64748b')}>IGNORADO</span>;

  if (row.status === 'already-linked') {
    return <span style={badgeStyle('#64748b')}>JÁ VINCULADA</span>;
  }

  if (row.status === 'missing-encontro') {
    return <span style={badgeStyle('#ef4444')}>SEM ENCONTRO</span>;
  }

  if (row.status === 'multiple-matches') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: '190px' }}>
        <span style={badgeStyle('#6366f1')}>
          <AlertTriangle size={12} /> {row.possibleMatches?.length} SEMELHANTES
        </span>
        <select
          className="form-input"
          style={{ fontSize: '0.75rem', padding: '0.2rem', minWidth: '170px' }}
          onChange={(e) => onSelect(e.target.value)}
          value=""
        >
          <option value="" disabled>Escolha para resolver...</option>
          {row.possibleMatches?.map(p => (
            <option key={p.id} value={p.id}>
              {p.nome_completo} {p.telefone ? `(${p.telefone})` : ''}
            </option>
          ))}
          <option value="new">+ CRIAR NOVO</option>
        </select>
      </div>
    );
  }

  if (row.status === 'match') {
    return (
      <span onClick={onToggle} style={{ ...badgeStyle('#f59e0b'), cursor: 'pointer' }} title="Clique para criar novo cadastro ao invés de usar o existente.">
        <AlertTriangle size={12} /> JÁ EXISTE
      </span>
    );
  }

  return (
    <span onClick={onToggle} style={{ ...badgeStyle('var(--primary-color)'), cursor: row.possibleMatches?.length ? 'pointer' : 'default' }}>
      NOVO
    </span>
  );
}

function badgeStyle(color: string): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    color,
    fontWeight: 700,
    fontSize: '0.7rem',
    padding: '0.2rem 0.5rem',
    borderRadius: '12px',
    backgroundColor: 'rgba(100, 116, 139, 0.1)',
    whiteSpace: 'nowrap'
  };
}
