import { useState, useEffect, useMemo, useRef } from 'react';
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
  Loader
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { pessoaService } from '../../services/pessoaService';
import { equipeService } from '../../services/equipeService';
import { inscricaoService } from '../../services/inscricaoService';
import { encontroService } from '../../services/encontroService';
import { findSimilarPeoples } from '../../utils/similarity';
import type { Encontro } from '../../types/encontro';
import type { Equipe } from '../../types/equipe';
import type { Pessoa, PessoaFormData } from '../../types/pessoa';
import type { InscricaoFormData } from '../../types/inscricao';

interface RawRow {
  [key: string]: unknown;
}

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

  // Matching state
  matchedPessoa: Pessoa | null;
  possibleMatches?: Pessoa[];
  status: 'new' | 'match' | 'ignore' | 'multiple-matches';
  selected: boolean;

  // Persistence state
  pessoaId?: string;
  equipeId?: string;
  importResult?: 'success' | 'error';
}

interface ProcessedSheet {
  sheetName: string;
  rows: ProcessedRow[];
  teamId: string | null; // null means team needs to be created
  status: 'existing' | 'create';
}

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

  const [sheets, setSheets] = useState<ProcessedSheet[]>([]);
  const [allTeams, setAllTeams] = useState<Equipe[]>([]);
  const [allPessoas, setAllPessoas] = useState<Pessoa[]>([]);

  useEffect(() => {
    async function init() {
      try {
        const [encontrosData, equipesData, pessoasData] = await Promise.all([
          encontroService.listar(),
          equipeService.listar(),
          pessoaService.listar()
        ]);
        setEncontros(encontrosData);
        setAllTeams(equipesData);
        setAllPessoas(pessoasData);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

      // We'll collect all people to search for duplicates in bulk if possible, 
      // but building a map of names to search for similarity.

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const rowsArray = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 });
        let headerRowIdx = 0;

        for (let i = 0; i < rowsArray.length; i++) {
          const row = rowsArray[i];
          if (!row || !Array.isArray(row)) continue;

          const hasNome = row.some(cell => {
            const val = String(cell || '').trim().toUpperCase();
            return val === 'NOME' || val === 'NOME COMPLETO';
          });

          if (hasNome) {
            headerRowIdx = i;
            break;
          }
        }

        const rawData = XLSX.utils.sheet_to_json<RawRow>(worksheet, { range: headerRowIdx });

        if (rawData.length === 0) continue;
        parsedSheets.push({ sheetName, rawData });
        totalRows += rawData.length;
      }

      setProgressTotal(totalRows);

      const processedSheets: ProcessedSheet[] = [];
      let currentCount = 0;

      for (const { sheetName, rawData } of parsedSheets) {
        // Match team
        const matchedTeam = allTeams.find(t =>
          (t.nome?.toLowerCase() === sheetName.toLowerCase()) ||
          (t.nome?.toLowerCase().includes(sheetName.toLowerCase())) ||
          (sheetName.toLowerCase().includes(t.nome?.toLowerCase() || ''))
        );

        const rows: ProcessedRow[] = [];

        for (const raw of rawData) {
          // Normalize keys (case insensitive)
          const findValue = (keys: string[]) => {
            const rowKey = Object.keys(raw).find(rk => keys.includes(rk.toUpperCase()));
            return rowKey ? String(raw[rowKey] ?? '').trim() : '';
          };

          const nome = findValue(['NOME', 'NOME COMPLETO']);
          if (!nome) {
            currentCount++;
            setProgressCount(currentCount);
            continue;
          }

          setProgressText(`Verificando: ${nome.split(' ')[0]}...`);

          const telefone = findValue(['TELEFONE', 'WHATSAPP', 'CELULAR']).replace(/\D/g, '');
          const funcao = findValue(['COORD/ENCONT', 'FUNCÃO', 'CARGO', 'ROLE']).toUpperCase();
          const isCoordenador = funcao.includes('COORDENADOR') || funcao === 'COORD';

          // Duplicate detection - fast local test avoiding N+1 database roundtrips
          const matches = findSimilarPeoples(nome, allPessoas, telefone);
          let matchedPessoa = null;
          let status: ProcessedRow['status'] = 'new';
          
          if (matches.length === 1) {
            matchedPessoa = matches[0];
            status = 'match';
          } else if (matches.length > 1) {
            matchedPessoa = null;
            status = 'multiple-matches';
          }

          rows.push({
            id: Math.random().toString(36).substr(2, 9),
            nome,
            endereco: findValue(['ENDEREÇO', 'RUA', 'ENDERECO']),
            numero: findValue(['Nº', 'N', 'NUMERO', 'NÚMERO']),
            bairro: findValue(['BAIRRO']),
            telefone,
            equipeOriginal: sheetName,
            funcaoOriginal: findValue(['COORD/ENCONT']),
            isCoordenador,
            matchedPessoa,
            possibleMatches: matches,
            status,
            selected: true
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
        toast.success(`${processedSheets.length} abas processadas!`);
      }
    } catch {
      console.error('Erro ao ler planilha');
      toast.error('Erro ao ler a planilha. Verifique o formato.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleRow = (sheetIdx: number, rowIdx: number) => {
    const newSheets = [...sheets];
    newSheets[sheetIdx].rows[rowIdx].selected = !newSheets[sheetIdx].rows[rowIdx].selected;
    setSheets(newSheets);
  };

  const handleToggleAll = (sheetIdx: number) => {
    const newSheets = [...sheets];
    const allSelected = newSheets[sheetIdx].rows.every(r => r.selected);
    newSheets[sheetIdx].rows.forEach(r => r.selected = !allSelected);
    setSheets(newSheets);
  };

  const toggleRowStatus = (sheetIdx: number, rowIdx: number) => {
    const newSheets = [...sheets];
    const row = newSheets[sheetIdx].rows[rowIdx];
    if (row.status === 'match' && row.matchedPessoa) {
      row.status = 'new';
    } else if (row.status === 'new' && row.matchedPessoa) {
      row.status = 'match';
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
        row.status = 'match';
        row.matchedPessoa = selected;
      }
    }
    setSheets(newSheets);
  };

  const startImport = async () => {
    if (!selectedEncontroId) {
      toast.error('Selecione um encontro primeiro.');
      return;
    }

    setIsImporting(true);
    let successCount = 0;

    try {
      // 1. Create missing teams
      const teamMap = new Map<string, string>(); // sheetName -> teamId

      for (const sheet of sheets) {
        if (sheet.status === 'create') {
          try {
            const newTeam = await equipeService.criar({ nome: sheet.sheetName });
            teamMap.set(sheet.sheetName, newTeam.id);
            // Also update the local state for reference
            sheet.teamId = newTeam.id;
            sheet.status = 'existing';
          } catch {
            toast.error(`Erro ao criar equipe ${sheet.sheetName}`);
          }
        } else if (sheet.teamId) {
          teamMap.set(sheet.sheetName, sheet.teamId);
        }
      }

      // 2. Process rows
      for (const sheet of sheets) {
        const teamId = teamMap.get(sheet.sheetName);
        if (!teamId) continue;

        const rowsToImport = sheet.rows.filter(r => r.selected);

        for (const row of rowsToImport) {
          if (row.status === 'multiple-matches') {
            toast.error(`Resolva as correspondências múltiplas detectadas para "${row.nome}" antes de importar (escolha um correspondente ou indique como NOVO).`);
            setIsImporting(false);
            return;
          }
        }

        for (const row of rowsToImport) {
          try {
            let finalPessoaId = '';

            // If status is 'match', we use the existing person
            if (row.status === 'match' && row.matchedPessoa) {
              finalPessoaId = row.matchedPessoa.id;
            } else {
              // Create new person
              const pessoaData: PessoaFormData = {
                nome_completo: row.nome,
                telefone: row.telefone,
                endereco: row.endereco,
                numero: row.numero,
                bairro: row.bairro,
                cidade: 'Franca', // Default per user request
                estado: '',
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
              const newPessoa = await pessoaService.criar(pessoaData);
              finalPessoaId = newPessoa.id;
            }

            // 3. Create Participation
            const participationData: InscricaoFormData = {
              pessoa_id: finalPessoaId,
              encontro_id: selectedEncontroId,
              equipe_id: teamId,
              coordenador: row.isCoordenador,
              participante: false,
              dados_confirmados: false,
              confirmado_em: null,
              pago_taxa: false
            };

            await inscricaoService.criar(participationData);
            row.importResult = 'success';
            successCount++;
          } catch {
            row.importResult = 'error';
          }
        }
      }

      toast.success(`Importação concluída: ${successCount} registros vinculados!`);
      setSheets([...sheets]); // trigger re-render to show success icons
    } catch {
      toast.error('Ocorreu um erro durante a importação.');
    } finally {
      setIsImporting(false);
    }
  };

  const totalSelected = useMemo(() => {
    return sheets.reduce((total, s) => total + s.rows.filter(r => r.selected).length, 0);
  }, [sheets]);

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

        <div className="grid-container" style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '1.5rem', alignItems: 'start' }}>

          {/* Configuration Card */}
          <div className="card" style={{ position: 'sticky', top: '90px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={18} className="text-primary" /> Configuração
            </h3>

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
                backgroundColor: 'rgba(0,0,0,0.02)'
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
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                  <span>Selecionados:</span>
                  <span style={{ fontWeight: 700 }}>{totalSelected}</span>
                </div>
                <button
                  className="btn-primary"
                  style={{ width: '100%' }}
                  disabled={totalSelected === 0 || isImporting}
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

          {/* Review Area */}
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
                <p className="text-muted" style={{ maxWidth: '400px', margin: '0 auto' }}>
                  Faça o upload da planilha ao lado para revisar os dados antes de importar para o banco.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {sheets.map((sheet, sIdx) => (
                  <div key={sIdx} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{
                      padding: '1rem 1.5rem',
                      backgroundColor: 'rgba(0,0,0,0.02)',
                      borderBottom: '1px solid var(--border-color)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
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
                            {sheet.status === 'create' ? '⚠ Será criada como nova equipe' : '✓ Equipe já existe'}
                          </span>
                        </div>
                      </div>
                      <button className="btn-text" onClick={() => handleToggleAll(sIdx)}>
                        {sheet.rows.every(r => r.selected) ? 'Desmarcar Todos' : 'Selecionar Todos'}
                      </button>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '40px' }}></th>
                            <th>Status</th>
                            <th>Nome</th>
                            <th>Telefone</th>
                            <th>Endereço</th>
                            <th>Cargo/Role</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sheet.rows.map((row, rIdx) => (
                            <tr key={row.id} style={{ opacity: row.selected ? 1 : 0.5 }}>
                              <td className="text-center">
                                <input
                                  type="checkbox"
                                  checked={row.selected}
                                  onChange={() => handleToggleRow(sIdx, rIdx)}
                                />
                              </td>
                              <td>
                                {row.importResult === 'success' ? (
                                  <CheckCircle size={16} color="#10b981" />
                                ) : row.importResult === 'error' ? (
                                  <AlertCircle size={16} color="#ef4444" />
                                ) : row.status === 'multiple-matches' ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: '180px' }}>
                                    <div 
                                      style={{ 
                                        display: 'inline-flex', alignItems: 'center', gap: '0.4rem', 
                                        color: '#6366f1', fontWeight: 700,
                                        fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '12px',
                                        backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid #6366f1'
                                      }}
                                    >
                                      <AlertTriangle size={12} /> {row.possibleMatches?.length} SEMELHANTES ENCONTRADOS
                                    </div>
                                    <select 
                                      className="form-input" 
                                      style={{ fontSize: '0.75rem', padding: '0.2rem', minWidth: '150px' }}
                                      onChange={(e) => handleSelectMatch(sIdx, rIdx, e.target.value)}
                                      value=""
                                    >
                                      <option value="" disabled>Escolha para resolver...</option>
                                      {row.possibleMatches?.map(p => (
                                        <option key={p.id} value={p.id}>
                                          {p.nome_completo} {p.telefone ? `(${p.telefone})` : ''}
                                        </option>
                                      ))}
                                      <option value="new">+ CRIAR NOVO (Não é nenhum desses)</option>
                                    </select>
                                  </div>
                                ) : row.status === 'match' ? (
                                  <div
                                    onClick={() => toggleRowStatus(sIdx, rIdx)}
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                                      color: '#f59e0b', fontWeight: 700, cursor: 'pointer',
                                      fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '12px',
                                      backgroundColor: 'rgba(245, 158, 11, 0.1)'
                                    }}
                                    title="Pessoa já existe no sistema. Clique para criar novo cadastro ao invés de usar o existente."
                                  >
                                    <AlertTriangle size={12} /> JÁ EXISTE {row.possibleMatches && row.possibleMatches.length > 1 ? '(ESCOLHIDO)' : ''}
                                  </div>
                                ) : (
                                  <div 
                                    onClick={() => toggleRowStatus(sIdx, rIdx)}
                                    style={{
                                      display: 'inline-block', fontSize: '0.7rem', fontWeight: 700,
                                      color: 'var(--primary-color)', padding: '0.2rem 0.5rem',
                                      borderRadius: '12px', backgroundColor: 'rgba(37, 99, 235, 0.1)',
                                      cursor: row.matchedPessoa || (row.possibleMatches && row.possibleMatches.length > 0) ? 'pointer' : 'default'
                                    }}
                                    title={row.matchedPessoa || (row.possibleMatches && row.possibleMatches.length > 0) ? "Clique para descartar e escolher correspondente" : ""}
                                  >
                                    NOVO {(row.matchedPessoa || (row.possibleMatches && row.possibleMatches.length > 0)) ? '(TROCADO)' : ''}
                                  </div>
                                )}
                              </td>
                              <td>
                                <div style={{ fontWeight: 600 }}>{row.nome}</div>
                                {row.matchedPessoa && (
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-color)', opacity: 0.7, marginTop: '0.2rem' }}>
                                    ➥ Vinculado a: <strong>{row.matchedPessoa.nome_completo}</strong>
                                  </div>
                                )}
                              </td>
                              <td>{row.telefone || '—'}</td>
                              <td>{row.endereco ? `${row.endereco}, ${row.numero}` : '—'}</td>
                              <td>
                                <span style={{
                                  fontSize: '0.7rem', fontWeight: 700,
                                  color: row.isCoordenador ? '#ec4899' : '#6366f1',
                                  padding: '0.2rem 0.4rem', borderRadius: '4px',
                                  backgroundColor: row.isCoordenador ? 'rgba(236, 72, 153, 0.1)' : 'rgba(99, 102, 241, 0.1)'
                                }}>
                                  {row.funcaoOriginal}
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
