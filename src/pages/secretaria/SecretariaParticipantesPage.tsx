import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLoading } from '../../contexts/LoadingContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { encontroService } from '../../services/encontroService';
import { inscricaoService, type ParticipacaoCancelada } from '../../services/inscricaoService';
import { pessoaService } from '../../services/pessoaService';
import { useEncontros } from '../../contexts/EncontroContext';
import type { InscricaoEnriched } from '../../types/inscricao';
import { ChevronLeft, Search, Users, User, Download, FileText, FileSpreadsheet, MapPin, Loader, Plus, CheckCircle, XCircle, Clock, UserMinus, X, Car, Camera, SlidersHorizontal, Image as ImageIcon, Upload, Settings2, Minus, Plus as PlusIcon, RotateCcw } from 'lucide-react';
import type { Encontro } from '../../types/encontro';
import { toast } from 'react-hot-toast';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { useDebounce } from '../../hooks/useDebounce';
import { useAuth } from '../../hooks/useAuth';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { geocodeWithFallback } from '../../utils/geocoding';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { calculateAge } from '../../utils/dateUtils';
import { formatTelefone } from '../../utils/cpfUtils';

type GeoItemStatus = 'pending' | 'processing' | 'success' | 'error' | 'skipped';

interface GeoProgressItem {
  pessoa_id: string;
  nome: string;
  status: GeoItemStatus;
  message?: string;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Data não informada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data não informada';
  return date.toLocaleString('pt-BR');
}

interface DesistentesTabProps {
  desistentes: ParticipacaoCancelada[];
  total: number;
  isLoading: boolean;
  canRestore: boolean;
  onRestore: (desistencia: ParticipacaoCancelada) => void;
}

function DesistentesTab({ desistentes, total, isLoading, canRestore, onRestore }: DesistentesTabProps) {
  if (isLoading) {
    return (
      <div className="card text-center py-8">
        <Loader size={32} className="animate-spin" style={{ display: 'inline-block', marginBottom: '1rem' }} />
        <p>Carregando desistentes...</p>
      </div>
    );
  }

  if (desistentes.length === 0) {
    return (
      <div className="empty-state">
        <UserMinus size={48} style={{ opacity: 0.3 }} />
        <p>{total > 0 ? 'Nenhum desistente encontrado para a busca.' : 'Nenhuma desistência registrada nesta edição.'}</p>
      </div>
    );
  }

  return (
    <>
      <p className="secretaria-result-summary">
        Mostrando <strong>{desistentes.length}</strong> de <strong>{total}</strong> {total === 1 ? 'desistente registrado' : 'desistentes registrados'}
      </p>

      <div className="secretaria-desistentes-list">
        {desistentes.map((desistencia) => {
          const pessoa = desistencia.pessoas;
          const nome = pessoa?.nome_completo || 'Nome não informado';
          const dupla = desistencia.visita_grupos?.nome || 'Dupla não informada';

          return (
            <article key={desistencia.id} className="card secretaria-desistente-card">
              <div className="secretaria-desistente-avatar">
                {nome.charAt(0)}
              </div>

              <div className="secretaria-desistente-main">
                <div>
                  <h3>{nome}</h3>
                  <div className="secretaria-desistente-badges">
                    <span><Users size={12} /> {dupla}</span>
                    <span><Clock size={12} /> {formatDateTime(desistencia.data_cancelamento)}</span>
                  </div>
                </div>

                <div className="secretaria-desistente-details">
                  <span>{formatTelefone(pessoa?.telefone)}</span>
                  {pessoa?.comunidade && <span>{pessoa.comunidade}</span>}
                  {desistencia.observacoes && <span>Obs.: {desistencia.observacoes}</span>}
                </div>
              </div>

              <div className="secretaria-desistente-actions">
                {canRestore ? (
                  <button
                    type="button"
                    className="btn-primary secretaria-restore-button"
                    onClick={() => onRestore(desistencia)}
                  >
                    <RotateCcw size={16} />
                    Reverter
                  </button>
                ) : (
                  <span className="secretaria-desistente-readonly">Somente admin/secretaria</span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}


export function SecretariaParticipantesPage() {
  const { setIsLoading: setGlobalLoading } = useLoading();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { encontros } = useEncontros();
  const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');
  const [participantes, setParticipantes] = useState<InscricaoEnriched[]>([]);
  const [desistentes, setDesistentes] = useState<ParticipacaoCancelada[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDesistentes, setIsLoadingDesistentes] = useState(false);
  const [isUpdatingGeo, setIsUpdatingGeo] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showConfirmGeoModal, setShowConfirmGeoModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [participantToUnlink, setParticipantToUnlink] = useState<InscricaoEnriched | null>(null);
  const [desistenciaToRestore, setDesistenciaToRestore] = useState<ParticipacaoCancelada | null>(null);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [isRestoringDesistencia, setIsRestoringDesistencia] = useState(false);
  const [activeTab, setActiveTab] = useState<'participantes' | 'desistentes'>('participantes');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVeiculo, setFilterVeiculo] = useState(false);
  const debouncedSearch = useDebounce(searchTerm, 400);
  const [pendingGeoCount, setPendingGeoCount] = useState(0);
  const [geoProgressItems, setGeoProgressItems] = useState<GeoProgressItem[]>([]);
  const [geoDone, setGeoDone] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [uploadingPhotoId, setUploadingPhotoId] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; nome: string } | null>(null);
  const [photoActionsParticipant, setPhotoActionsParticipant] = useState<InscricaoEnriched | null>(null);
  const [adjustingPhotoId, setAdjustingPhotoId] = useState<string | null>(null);
  const [tempPhotoPosition, setTempPhotoPosition] = useState(50);
  const photoActionsInputRef = useRef<HTMLInputElement>(null);
  const progressListRef = useRef<HTMLDivElement>(null);
  const canRestoreDesistencia = hasPermission('modulo_admin') || hasPermission('modulo_secretaria');

  // Seleciona encontro ativo automaticamente quando o contexto carregar
  useEffect(() => {
    const encontroParam = searchParams.get('encontro');
    if (encontroParam) {
      setSelectedEncontroId(encontroParam);
    } else if (encontros.length > 0 && !selectedEncontroId) {
      const active = encontros.find(e => e.ativo);
      setSelectedEncontroId(active?.id ?? encontros[0].id);
    }
  }, [encontros, searchParams, selectedEncontroId]);

  const loadParticipantes = useCallback(async () => {
    if (!selectedEncontroId) return;
    setIsLoading(true);
    try {
      // Filtro server-side: busca apenas participantes (participante=true)
      const data = await inscricaoService.listarParticipantesPorEncontro(selectedEncontroId);
      setParticipantes(data);
    } catch {
      toast.error('Erro ao carregar participantes.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedEncontroId]);

  const loadDesistentes = useCallback(async () => {
    if (!selectedEncontroId) return;
    setIsLoadingDesistentes(true);
    try {
      const data = await inscricaoService.listarCanceladosPorEncontro(selectedEncontroId);
      setDesistentes(data);
    } catch (error) {
      console.error('Erro ao carregar desistentes:', error);
      toast.error('Erro ao carregar desistentes.');
    } finally {
      setIsLoadingDesistentes(false);
    }
  }, [selectedEncontroId]);

  useEffect(() => {
    setGlobalLoading(isLoading || isLoadingDesistentes);
  }, [isLoading, isLoadingDesistentes, setGlobalLoading]);

  useEffect(() => {
    loadParticipantes();
    loadDesistentes();
  }, [selectedEncontroId, loadParticipantes, loadDesistentes]);

  const filteredParticipantes = React.useMemo(() => {
    const term = debouncedSearch.toLowerCase().trim();
    const normalize = (s: string | null | undefined) => (s || '').replace(/\D/g, '');
    const termDigits = normalize(term);

    return participantes
      .filter(p => {
        // Filtro de veículo
        if (filterVeiculo && !p.recepcao_dados) return false;

        if (!term) return true;

        const pData = p.pessoas;
        if (!pData) return false;

        const matchNome = pData.nome_completo?.toLowerCase().includes(term);
        const matchCpf = pData.cpf && (pData.cpf.includes(term) || (termDigits && normalize(pData.cpf).includes(termDigits)));
        const matchEmail = pData.email?.toLowerCase().includes(term);
        const matchTelefone = pData.telefone && ((termDigits && normalize(pData.telefone).includes(termDigits)) || pData.telefone.includes(term));
        const matchComunidade = pData.comunidade?.toLowerCase().includes(term);
        const matchBairro = pData.bairro?.toLowerCase().includes(term);
        const matchCidade = pData.cidade?.toLowerCase().includes(term);

        return !!(matchNome || matchCpf || matchEmail || matchTelefone || matchComunidade || matchBairro || matchCidade);
      })
      .sort((a, b) => (a.pessoas?.nome_completo || '').localeCompare(b.pessoas?.nome_completo || ''));
  }, [participantes, debouncedSearch, filterVeiculo]);

  const filteredDesistentes = React.useMemo(() => {
    const term = debouncedSearch.toLowerCase().trim();
    const normalize = (s: string | null | undefined) => (s || '').replace(/\D/g, '');
    const termDigits = normalize(term);

    return desistentes
      .filter((d) => {
        if (!term) return true;
        const pessoa = d.pessoas;
        const dupla = d.visita_grupos?.nome || '';
        const matchNome = pessoa?.nome_completo?.toLowerCase().includes(term);
        const matchCpf = pessoa?.cpf && (pessoa.cpf.includes(term) || (termDigits && normalize(pessoa.cpf).includes(termDigits)));
        const matchEmail = pessoa?.email?.toLowerCase().includes(term);
        const matchTelefone = pessoa?.telefone && ((termDigits && normalize(pessoa.telefone).includes(termDigits)) || pessoa.telefone.includes(term));
        const matchComunidade = pessoa?.comunidade?.toLowerCase().includes(term);
        const matchDupla = dupla.toLowerCase().includes(term);
        const matchObservacoes = d.observacoes?.toLowerCase().includes(term);

        return !!(matchNome || matchCpf || matchEmail || matchTelefone || matchComunidade || matchDupla || matchObservacoes);
      })
      .sort((a, b) => (a.pessoas?.nome_completo || '').localeCompare(b.pessoas?.nome_completo || ''));
  }, [desistentes, debouncedSearch]);

  const selectedEncontro = encontros.find(e => e.id === selectedEncontroId);

  const handleUpdateGeolocalizacao = () => {
    const pending = filteredParticipantes.filter(p => !p.pessoas?.latitude || !p.pessoas?.longitude);
    if (pending.length === 0) {
      toast.success('Todos os participantes já possuem geolocalização!');
      return;
    }
    setPendingGeoCount(pending.length);
    setShowConfirmGeoModal(true);
  };

  const executeBulkGeocoding = async () => {
    setShowConfirmGeoModal(false);
    const pending = filteredParticipantes.filter(p => !p.pessoas?.latitude || !p.pessoas?.longitude);

    // Build initial progress items
    const initialItems: GeoProgressItem[] = pending.map(p => ({
      pessoa_id: p.pessoa_id,
      nome: p.pessoas?.nome_completo || p.pessoa_id,
      status: 'pending',
    }));
    setGeoProgressItems(initialItems);
    setGeoDone(false);
    setShowProgressModal(true);
    setIsUpdatingGeo(true);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    try {
      for (let i = 0; i < pending.length; i++) {
        const p = pending[i];

        // Mark as processing
        setGeoProgressItems(prev =>
          prev.map((item, idx) => idx === i ? { ...item, status: 'processing' } : item)
        );

        // Auto-scroll to current item
        setTimeout(() => {
          const el = progressListRef.current?.querySelector(`[data-idx="${i}"]`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 50);

        if (!p.pessoas?.endereco) {
          setGeoProgressItems(prev =>
            prev.map((item, idx) => idx === i ? { ...item, status: 'skipped', message: 'Sem endereço' } : item)
          );
          skippedCount++;
          continue;
        }

        const coords = await geocodeWithFallback(p.pessoas);
        if (coords) {
          await pessoaService.atualizar(p.pessoa_id, {
            latitude: coords[0],
            longitude: coords[1],
          });
          setGeoProgressItems(prev =>
            prev.map((item, idx) => idx === i
              ? { ...item, status: 'success', message: `${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}` }
              : item
            )
          );
          successCount++;
        } else {
          setGeoProgressItems(prev =>
            prev.map((item, idx) => idx === i ? { ...item, status: 'error', message: 'Endereço não encontrado' } : item)
          );
          errorCount++;
        }

        // geocodeWithFallback already handles internal delays; add a small
        // extra gap only when the address was found on the first variant
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      await loadParticipantes();
      toast.success(`Geocodificação concluída: ${successCount} sucesso(s), ${errorCount} erro(s), ${skippedCount} pulado(s).`);
    } catch (error) {
      console.error('Erro no bulk geocode:', error);
    } finally {
      setIsUpdatingGeo(false);
      setGeoDone(true);
    }
  };

  const handleUnlink = async () => {
    if (!participantToUnlink) return;
    setIsUnlinking(true);
    try {
      await inscricaoService.desvincularDoEncontro(participantToUnlink.id);
      toast.success(`${participantToUnlink.pessoas?.nome_completo} desvinculado(a) com sucesso.`);
      setParticipantToUnlink(null);
      await loadParticipantes();
    } catch {
      toast.error('Erro ao desvincular participante.');
    } finally {
      setIsUnlinking(false);
    }
  };

  const updateParticipantPhotoState = (participacaoId: string, updates: Partial<InscricaoEnriched>) => {
    setParticipantes((prev) => prev.map((p) => (p.id === participacaoId ? { ...p, ...updates } : p)));
  };

  const handlePhotoUpload = async (participante: InscricaoEnriched, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem válido.');
      return;
    }

    setUploadingPhotoId(participante.id);
    const loadingToast = toast.loading('Enviando foto do participante...');

    try {
      const fotoUrl = await inscricaoService.uploadFotoParticipante(participante.id, file);
      await inscricaoService.atualizarFotoParticipante(participante.id, fotoUrl);
      updateParticipantPhotoState(participante.id, { foto_url: fotoUrl, foto_posicao_y: 50 });
      toast.success('Foto do participante atualizada!', { id: loadingToast });
    } catch (error) {
      console.error('Erro ao enviar foto do participante:', error);
      toast.error('Erro ao enviar a foto.', { id: loadingToast });
    } finally {
      setUploadingPhotoId(null);
    }
  };

  const handleRestoreDesistencia = async () => {
    if (!desistenciaToRestore) return;
    setIsRestoringDesistencia(true);
    try {
      await inscricaoService.desfazerDesistencia(desistenciaToRestore.id);
      toast.success(`${desistenciaToRestore.pessoas?.nome_completo || 'Participante'} restaurado(a) no encontro.`);
      setDesistenciaToRestore(null);
      await Promise.all([loadParticipantes(), loadDesistentes()]);
      setActiveTab('participantes');
    } catch (error) {
      console.error('Erro ao desfazer desistência:', error);
      const message = error instanceof Error ? error.message : 'Erro ao desfazer desistência.';
      toast.error(message);
    } finally {
      setIsRestoringDesistencia(false);
    }
  };

  const handleTabChange = (tab: 'participantes' | 'desistentes') => {
    setActiveTab(tab);
    setSearchTerm('');
    setFilterVeiculo(false);
  };

  const handleStartPhotoAdjustment = (participante: InscricaoEnriched) => {
    setAdjustingPhotoId(participante.id);
    setTempPhotoPosition(participante.foto_posicao_y ?? 50);
  };

  const handleSavePhotoAdjustment = async (participante: InscricaoEnriched) => {
    try {
      await inscricaoService.atualizarPosicaoFotoParticipante(participante.id, tempPhotoPosition);
      updateParticipantPhotoState(participante.id, { foto_posicao_y: tempPhotoPosition });
      setPhotoActionsParticipant((current) => current?.id === participante.id ? { ...current, foto_posicao_y: tempPhotoPosition } : current);
      setAdjustingPhotoId(null);
      toast.success('Enquadramento salvo!');
    } catch (error) {
      console.error('Erro ao salvar enquadramento:', error);
      toast.error('Erro ao salvar ajuste.');
    }
  };

  const handlePhotoActionsUpload = (file: File) => {
    if (!photoActionsParticipant) return;
    handlePhotoUpload(photoActionsParticipant, file);
  };

  const nudgePhotoPosition = (delta: number) => {
    setTempPhotoPosition((current) => Math.min(100, Math.max(0, current + delta)));
  };

  const handleDownloadPhoto = async (url: string, nome: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Falha ao baixar imagem');
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `foto_${nome.toLowerCase().replace(/[^a-z0-9]+/gi, '_') || 'participante'}.${blob.type.split('/')[1] || 'jpg'}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('Erro ao baixar foto:', error);
      toast.error('Erro ao baixar foto.');
    }
  };

  const getExportData = () => {
    return filteredParticipantes.map((p, idx) => {
      const pData = p.pessoas;
      const origem = p.origem || pData?.origem || '—';
      const origemTexto = origem === 'online' ? 'Online' : (origem !== '—' ? 'Presencial' : '—');
      const duplaVisitante = p.visita_participacao?.find((v) => !v.visitante)?.visita_grupos?.nome || '—';
      const circuloVinculado = p.circulo_participacao?.[0]?.circulos?.nome || '—';
      
      return {
        '#': idx + 1,
        'Nome Completo': pData?.nome_completo || '—',
        'Data de Nascimento': pData?.data_nascimento ? new Date(pData.data_nascimento.includes('T') ? pData.data_nascimento : `${pData.data_nascimento}T12:00:00`).toLocaleDateString('pt-BR') : '—',
        'Idade': calculateAge(pData?.data_nascimento) || '—',
        'Telefone': formatTelefone(pData?.telefone),
        'Logradouro': pData?.endereco || '—',
        'Número': pData?.numero || '—',
        'Bairro': pData?.bairro || '—',
        'Cidade': pData?.cidade || '—',
        'Estado': pData?.estado || '—',
        'CEP': pData?.cep || '—',
        'Comunidade': pData?.comunidade || '—',
        'Dupla Visitante': duplaVisitante,
        'Círculo': circuloVinculado,
        'Origem': origemTexto,
        'Veículo': p.recepcao_dados ? `${p.recepcao_dados.veiculo_tipo === 'moto' ? 'Moto' : 'Carro'} - ${p.recepcao_dados.veiculo_modelo} (${p.recepcao_dados.veiculo_placa})` : '—',
      };
    });
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const data = getExportData();
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      
      doc.setFontSize(16);
      doc.text(`Participantes: ${selectedEncontro?.nome || 'Encontro'}`, 14, 18);
      
      autoTable(doc, {
        head: [['#', 'Nome', 'Nasc.', 'Idade', 'Telefone', 'Endereço', 'Bairro', 'Cidade', 'Dupla', 'Círculo', 'Veículo']],
        body: data.map(d => [
          d['#'], 
          d['Nome Completo'], 
          d['Data de Nascimento'], 
          d['Idade'], 
          d['Telefone'], 
          `${d['Logradouro']}${d['Número'] !== '—' ? `, ${d['Número']}` : ''}`, 
          d['Bairro'], 
          d['Cidade'],
          d['Dupla Visitante'],
          d['Círculo'],
          d['Veículo'],
        ]),
        startY: 25,
        styles: { fontSize: 8 },
        columnStyles: {
          1: { cellWidth: 50 }, // Nome
          5: { cellWidth: 50 }, // Endereço
        }
      });
      
      doc.save(`participantes_${selectedEncontro?.nome || 'encontro'}.pdf`);
      setShowExportMenu(false);
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast.error('Erro ao gerar PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const data = getExportData();
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Participantes');
      
      // Auto-size columns
      const maxWidths = Object.keys(data[0] || {}).map(key => {
        return Math.max(
          key.length,
          ...data.map(row => String(row[key as keyof typeof row]).length)
        );
      });
      worksheet['!cols'] = maxWidths.map(w => ({ wch: w + 2 }));

      XLSX.writeFile(workbook, `participantes_${selectedEncontro?.nome || 'encontro'}.xlsx`);
      setShowExportMenu(false);
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      toast.error('Erro ao gerar planilha.');
    } finally {
      setIsExporting(false);
    }
  };

  // Contagem de participantes com veículo (para exibir no botão)
  const countComVeiculo = React.useMemo(
    () => participantes.filter(p => !!p.recepcao_dados).length,
    [participantes]
  );

  return (
    <>
        <div className="fade-in">
          <div className="page-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button onClick={() => navigate(-1)} className="icon-btn">
                <ChevronLeft size={18} />
              </button>
              <div>
                <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55 }}>Secretaria</p>
                <h1 className="page-title" style={{ fontSize: '1.5rem' }}>Participantes do Encontro</h1>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button
                onClick={() => navigate('/inscricao')}
                className="btn-secondary flex items-center gap-2"
                style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
              >
                <Plus size={16} /> <span className="hide-mobile">Nova Inscrição</span>
              </button>

              <button
                onClick={handleUpdateGeolocalizacao}
                disabled={isUpdatingGeo || filteredParticipantes.length === 0}
                className="btn-secondary flex items-center gap-2"
                style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
              >
                {isUpdatingGeo ? <Loader size={16} className="animate-spin" /> : <MapPin size={16} />}
                <span className="hide-mobile">{isUpdatingGeo ? 'Atualizando...' : 'Atualizar Geo'}</span>
              </button>

              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="btn-primary flex items-center gap-2"
                  style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                  disabled={filteredParticipantes.length === 0}
                >
                  <Download size={16} />
                  <span className="hide-mobile">Exportar</span>
                </button>

                {showExportMenu && (
                  <>
                    <div onClick={() => setShowExportMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
                    <div style={{
                      position: 'absolute',
                      right: 0,
                      top: '120%',
                      zIndex: 100,
                      backgroundColor: 'var(--card-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                      minWidth: '220px',
                      overflow: 'hidden',
                      animation: 'fadeInUp 0.2s ease'
                    }}>
                      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', opacity: 0.5, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                        Exportar como
                      </div>
                      <button 
                        onClick={handleExportPDF} 
                        className="dropdown-item-custom"
                        disabled={isExporting}
                      >
                        <div className="icon-box-pdf">
                          {isExporting ? <Loader size={18} className="animate-spin" /> : <FileText size={18} />}
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>PDF</div>
                          <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{isExporting ? 'Gerando...' : 'Documento formatado'}</div>
                        </div>
                      </button>
                      <button 
                        onClick={handleExportExcel} 
                        className="dropdown-item-custom"
                        disabled={isExporting}
                      >
                        <div className="icon-box-excel">
                          {isExporting ? <Loader size={18} className="animate-spin" /> : <FileSpreadsheet size={18} />}
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Excel</div>
                          <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{isExporting ? 'Gerando...' : 'Planilha editável'}</div>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="secretaria-tabs" role="tablist" aria-label="Participantes da edição">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'participantes'}
              className={activeTab === 'participantes' ? 'is-active' : ''}
              onClick={() => handleTabChange('participantes')}
            >
              <Users size={16} />
              Participantes
              <span>{participantes.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'desistentes'}
              className={activeTab === 'desistentes' ? 'is-active danger' : ''}
              onClick={() => handleTabChange('desistentes')}
            >
              <UserMinus size={16} />
              Desistentes
              <span>{desistentes.length}</span>
            </button>
          </div>

          <div className="card" style={{ marginBottom: '2rem' }}>
            <div className="grid-container secretaria-filter-grid">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Encontro</label>
                <LiveSearchSelect<Encontro>
                  value={selectedEncontroId}
                  onChange={(val) => setSelectedEncontroId(val)}
                  fetchData={async (search, page) => await encontroService.buscarComPaginacao(search, page)}
                  getOptionLabel={(e) => `${e.nome}${e.tema ? ` (${e.tema})` : ''} ${e.ativo ? '(Ativo)' : ''}`}
                  getOptionValue={(e) => String(e.id)}
                  placeholder="Selecione um Encontro..."
                  initialOptions={encontros}
                  className="montagem-header-select"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0, flex: 2 }}>
                <label className="form-label">{activeTab === 'desistentes' ? 'Buscar Desistente' : 'Buscar Participante'}</label>
                <div className="form-input-wrapper">
                  <div className="form-input-icon">
                    <Search size={16} />
                  </div>
                  <input
                    type="text"
                    className="form-input form-input--with-icon"
                    placeholder={activeTab === 'desistentes' ? 'Nome, e-mail, telefone, comunidade, dupla ou observação...' : 'Nome, e-mail, telefone, bairro ou cidade...'}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      style={{
                        position: 'absolute',
                        right: '0.6rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--muted-text)',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0.2rem',
                      }}
                      title="Limpar busca"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {activeTab === 'participantes' && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  Filtros
                  {countComVeiculo > 0 && !isLoading && (
                    <span style={{ fontSize: '0.7rem', opacity: 0.55, fontWeight: 400 }}>
                      ({countComVeiculo} com veículo)
                    </span>
                  )}
                </label>
                <button
                  type="button"
                  onClick={() => setFilterVeiculo(v => !v)}
                  className={filterVeiculo ? 'btn-primary flex items-center gap-2' : 'btn-secondary flex items-center gap-2'}
                  style={{
                    fontSize: '0.85rem',
                    padding: '0.55rem 1rem',
                    width: '100%',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                  }}
                  title={filterVeiculo ? 'Remover filtro de veículo' : 'Mostrar apenas participantes com veículo'}
                >
                  <Car size={16} />
                  <span>Com veículo{filterVeiculo ? ' ✓' : ''}</span>
                </button>
              </div>
              )}
            </div>
          </div>

          {activeTab === 'desistentes' ? (
            <DesistentesTab
              desistentes={filteredDesistentes}
              total={desistentes.length}
              isLoading={isLoadingDesistentes}
              canRestore={canRestoreDesistencia}
              onRestore={setDesistenciaToRestore}
            />
          ) : isLoading ? (
            <div className="card text-center py-8">
              <Loader size={32} className="animate-spin" style={{ display: 'inline-block', marginBottom: '1rem' }} />
              <p>Carregando participantes...</p>
            </div>
          ) : filteredParticipantes.length === 0 ? (
            <div className="empty-state">
              <Users size={48} style={{ opacity: 0.3 }} />
              <p>
                {filterVeiculo && participantes.length > 0
                  ? 'Nenhum participante com veículo encontrado.'
                  : 'Nenhum participante encontrado.'}
              </p>
              {filterVeiculo && (
                <button
                  type="button"
                  onClick={() => setFilterVeiculo(false)}
                  className="btn-secondary"
                  style={{ marginTop: '1rem', fontSize: '0.85rem' }}
                >
                  Remover filtro de veículo
                </button>
              )}
            </div>
          ) : (
            <>
              <p style={{ fontSize: '0.85rem', opacity: 0.6, margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span>Mostrando <strong>{filteredParticipantes.length}</strong> de <strong>{participantes.length}</strong> {participantes.length === 1 ? 'participante encontrado' : 'participantes encontrados'}</span>
                {filterVeiculo && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', backgroundColor: 'rgba(37,99,235,0.1)', color: 'var(--primary-color)', borderRadius: '20px', padding: '0.15rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, border: '1px solid rgba(37,99,235,0.25)' }}>
                    <Car size={12} /> Filtro: com veículo
                    <button type="button" onClick={() => setFilterVeiculo(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', alignItems: 'center', padding: 0, marginLeft: '0.1rem' }}><X size={11} /></button>
                  </span>
                )}
              </p>

              <div className="pessoa-grid secretaria-pessoa-grid">
                {filteredParticipantes.map((p) => {
                  const hasGeo = !!(p.pessoas?.latitude && p.pessoas?.longitude);
                  const endereco = p.pessoas?.endereco
                    ? `${p.pessoas.endereco}${p.pessoas.numero ? `, ${p.pessoas.numero}` : ''}`
                    : 'Endereço não informado';
                  const localidade = [p.pessoas?.bairro, p.pessoas?.cidade].filter(Boolean).join(' - ') || 'Bairro/Cidade não informados';
                  const nomeParticipante = p.pessoas?.nome_completo || 'Nome não informado';
                  const duplaVisitante = p.visita_participacao?.find((v) => !v.visitante)?.visita_grupos?.nome;
                  const circuloVinculado = p.circulo_participacao?.[0]?.circulos?.nome;
                  const isAdjustingPhoto = adjustingPhotoId === p.id;
                  const photoPosition = isAdjustingPhoto ? tempPhotoPosition : (p.foto_posicao_y ?? 50);

                  return (
                    <div key={p.id} className="pessoa-row secretaria-pessoa-row">
                      <div className="pessoa-row-main secretaria-pessoa-main">
                        <div className="secretaria-photo-block">
                          <button
                            type="button"
                            className="secretaria-participant-photo"
                            onClick={() => setPhotoActionsParticipant(p)}
                            title="Abrir opções da foto"
                            aria-label={`Abrir opções da foto de ${nomeParticipante}`}
                          >
                            {uploadingPhotoId === p.id ? (
                              <Loader size={18} className="animate-spin" />
                            ) : p.foto_url ? (
                              <img
                                src={p.foto_url}
                                alt={nomeParticipante}
                                style={{ objectPosition: `center ${photoPosition}%` }}
                              />
                            ) : (
                              <User size={20} />
                            )}
                            <span className="secretaria-photo-camera">
                              <Settings2 size={12} />
                            </span>
                          </button>
                        </div>
                        <div className="pessoa-row-info">
                          <h3 className="pessoa-row-name">{nomeParticipante}</h3>
                          <div className="secretaria-link-badges">
                            <span className={`secretaria-context-badge circle${circuloVinculado ? '' : ' muted'}`}>
                              <ImageIcon size={11} /> {circuloVinculado || 'Sem círculo'}
                            </span>
                            {duplaVisitante && (
                              <span className="secretaria-context-badge">
                                <Users size={11} /> {duplaVisitante}
                              </span>
                            )}
                            {p.recepcao_dados && (
                              <span className="secretaria-context-badge vehicle">
                                <Car size={11} />
                                {p.recepcao_dados.veiculo_tipo === 'moto' ? 'Moto' : 'Carro'} · {p.recepcao_dados.veiculo_placa}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="pessoa-row-col secretaria-pessoa-contact">
                        <span className="pessoa-row-label">Contato</span>
                        <div className="pessoa-row-value-group">
                          <span className="pessoa-row-value">{formatTelefone(p.pessoas?.telefone)}</span>
                          {p.pessoas?.email && (
                            <span className="pessoa-row-sub" style={{ opacity: 0.65, fontSize: '0.75rem' }}>
                              {p.pessoas.email}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="pessoa-row-col secretaria-pessoa-address">
                        <span className="pessoa-row-label">Endereço</span>
                        <span className="pessoa-row-value secretaria-address-main" style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <MapPin size={12} style={{ flexShrink: 0, color: hasGeo ? 'var(--success-border)' : 'var(--danger-border)', opacity: hasGeo ? 1 : 0.45 }} />
                          <span>
                            {endereco}
                          </span>
                        </span>
                        <span className="pessoa-row-sub secretaria-address-sub" style={{ opacity: 0.65, fontSize: '0.75rem' }}>
                          {localidade}
                        </span>
                      </div>

                      <div className="pessoa-row-actions secretaria-pessoa-actions">
                        {selectedEncontro?.ativo && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setParticipantToUnlink(p); }}
                            className="secretaria-unlink-button"
                            title="Desvincular do encontro"
                            aria-label="Desvincular do encontro"
                          >
                            <UserMinus size={16} />
                            <span>Desvincular</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

      {/* ── Confirm geo modal ── */}
      <Modal
        isOpen={showConfirmGeoModal}
        onClose={() => setShowConfirmGeoModal(false)}
        title="Confirmar Atualização"
      >
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--primary-color)', margin: '0 auto 1.5rem auto'
          }}>
            <MapPin size={32} />
          </div>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Atualizar coordenadas?</h3>
          <p style={{ opacity: 0.7, marginBottom: '2rem' }}>
            Serão processados <strong>{pendingGeoCount}</strong> participante(s) sem geolocalização.
            <br />O processo pode levar alguns minutos (1 req/s).
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button onClick={() => setShowConfirmGeoModal(false)} className="btn-secondary">Cancelar</button>
            <button onClick={executeBulkGeocoding} className="btn-primary">Sim, Iniciar</button>
          </div>
        </div>
      </Modal>

      {/* ── Progress modal ── */}
      <Modal
        isOpen={showProgressModal}
        onClose={() => { if (geoDone) setShowProgressModal(false); }}
        title="Atualizando Geolocalização"
        maxWidth="680px"
      >
        <div style={{ width: '100%' }}>
          <div style={{
            display: 'flex', gap: '0.75rem', flexWrap: 'wrap',
            marginBottom: '1.25rem', padding: '1rem',
            backgroundColor: 'rgba(37,99,235,0.04)',
            borderRadius: '10px', border: '1px solid var(--border-color)',
          }}>
            {([
              { label: 'Total', count: geoProgressItems.length, color: 'var(--text-color)' },
              { label: 'Sucesso', count: geoProgressItems.filter(i => i.status === 'success').length, color: '#10b981' },
              { label: 'Erro', count: geoProgressItems.filter(i => i.status === 'error').length, color: '#ef4444' },
              { label: 'Sem endereço', count: geoProgressItems.filter(i => i.status === 'skipped').length, color: '#f59e0b' },
              { label: 'Pendente', count: geoProgressItems.filter(i => i.status === 'pending' || i.status === 'processing').length, color: '#94a3b8' },
            ] as { label: string; count: number; color: string }[]).map(({ label, count, color }) => (
              <div key={label} style={{ flex: '1 1 80px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color, lineHeight: 1 }}>{count}</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '2px' }}>{label}</div>
              </div>
            ))}
          </div>

          <div
            ref={progressListRef}
            style={{ maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}
          >
            {geoProgressItems.map((item, idx) => {
              type CfgMap = Record<GeoItemStatus, { icon: React.ReactNode; color: string; bg: string; label: string }>;
              const statusConfig: CfgMap = {
                pending: { icon: <Clock size={15} />, color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', label: 'Aguardando' },
                processing: { icon: <Loader size={15} className="animate-spin" />, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', label: 'Processando' },
                success: { icon: <CheckCircle size={15} />, color: '#10b981', bg: 'rgba(16,185,129,0.1)', label: 'Sucesso' },
                error: { icon: <XCircle size={15} />, color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: 'Erro' },
                skipped: { icon: <MapPin size={15} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Ignorado' },
              };
              const cfg = statusConfig[item.status];
              return (
                <div
                  key={item.pessoa_id}
                  data-idx={idx}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.6rem 0.9rem', borderRadius: '8px',
                    backgroundColor: cfg.bg,
                    border: `1px solid ${cfg.color}33`,
                    transition: 'background-color 0.3s',
                  }}
                >
                  <div style={{ color: cfg.color, flexShrink: 0, display: 'flex' }}>{cfg.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.nome}
                    </div>
                    {item.message && (
                      <div style={{ fontSize: '0.75rem', color: cfg.color, opacity: 0.85 }}>{item.message}</div>
                    )}
                  </div>
                  <div style={{
                    fontSize: '0.7rem', fontWeight: 700, color: cfg.color,
                    padding: '0.15rem 0.45rem', borderRadius: '4px', whiteSpace: 'nowrap',
                    border: `1px solid ${cfg.color}44`,
                  }}>
                    {cfg.label}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', alignItems: 'center' }}>
            {!geoDone && (
              <span style={{ fontSize: '0.8rem', opacity: 0.55, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Loader size={13} className="animate-spin" /> Processando, aguarde...
              </span>
            )}
            <button
              className="btn-primary"
              disabled={!geoDone}
              onClick={() => setShowProgressModal(false)}
              style={{ opacity: geoDone ? 1 : 0.4, cursor: geoDone ? 'pointer' : 'not-allowed' }}
            >
              {geoDone ? 'Concluído ✓' : 'Aguarde...'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!participantToUnlink}
        title="Desvincular Participante"
        message={
          <>
            Tem certeza que deseja desvincular o(a) participante <strong style={{ color: 'var(--text-color)' }}>{participantToUnlink?.pessoas?.nome_completo}</strong> deste encontro?
            <br /><br />
            Esta ação <strong style={{ color: 'var(--danger-text)' }}>apenas removerá o vínculo</strong> da pessoa com este encontro específico. O cadastro da pessoa no sistema de pessoas será mantido intacto.
          </>
        }
        confirmText="Sim, desvincular"
        cancelText="Cancelar"
        onConfirm={handleUnlink}
        onCancel={() => setParticipantToUnlink(null)}
        isLoading={isUnlinking}
        isDestructive={true}
      />

      <ConfirmDialog
        isOpen={!!desistenciaToRestore}
        title="Reverter desistência"
        message={
          <>
            Deseja recolocar <strong style={{ color: 'var(--text-color)' }}>{desistenciaToRestore?.pessoas?.nome_completo}</strong> neste encontro e na dupla <strong style={{ color: 'var(--text-color)' }}>{desistenciaToRestore?.visita_grupos?.nome || 'original'}</strong>?
            <br /><br />
            A desistência ficará registrada no histórico como revertida.
          </>
        }
        confirmText="Sim, reverter"
        cancelText="Cancelar"
        onConfirm={handleRestoreDesistencia}
        onCancel={() => setDesistenciaToRestore(null)}
        isLoading={isRestoringDesistencia}
      />

      <Modal
        isOpen={!!previewPhoto}
        onClose={() => setPreviewPhoto(null)}
        title={previewPhoto?.nome || 'Foto do participante'}
        maxWidth="720px"
      >
        {previewPhoto && (
          <div className="secretaria-photo-preview-modal">
            <img src={previewPhoto.url} alt={previewPhoto.nome} />
            <div className="secretaria-photo-preview-actions">
              <button type="button" className="btn-secondary" onClick={() => handleDownloadPhoto(previewPhoto.url, previewPhoto.nome)}>
                <Download size={16} /> Baixar
              </button>
              <button type="button" className="btn-primary" onClick={() => setPreviewPhoto(null)}>
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!photoActionsParticipant}
        onClose={() => {
          setPhotoActionsParticipant(null);
          setAdjustingPhotoId(null);
        }}
        title={photoActionsParticipant?.pessoas?.nome_completo || 'Foto do participante'}
        maxWidth="720px"
      >
        {photoActionsParticipant && (
          <div className="secretaria-photo-options-modal">
            <div className="secretaria-photo-options-frame">
              {photoActionsParticipant.foto_url ? (
                <img
                  src={photoActionsParticipant.foto_url}
                  alt={photoActionsParticipant.pessoas?.nome_completo || 'Participante'}
                  className={adjustingPhotoId === photoActionsParticipant.id ? 'is-adjusting' : ''}
                  style={{
                    objectPosition: `center ${adjustingPhotoId === photoActionsParticipant.id ? tempPhotoPosition : (photoActionsParticipant.foto_posicao_y ?? 50)}%`,
                  }}
                />
              ) : (
                <div className="secretaria-photo-options-empty">
                  <User size={34} />
                  <span>Sem foto cadastrada</span>
                </div>
              )}
              {uploadingPhotoId === photoActionsParticipant.id && (
                <div className="secretaria-photo-options-loading">
                  <Loader size={24} className="animate-spin" />
                </div>
              )}
            </div>

            {adjustingPhotoId === photoActionsParticipant.id && photoActionsParticipant.foto_url ? (
              <div className="secretaria-photo-options-adjust">
                <label>Ajustar enquadramento</label>
                <div className="secretaria-photo-adjust-control">
                  <button type="button" onClick={() => nudgePhotoPosition(-2)} aria-label="Subir enquadramento">
                    <Minus size={15} />
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={tempPhotoPosition}
                    onChange={(event) => setTempPhotoPosition(Number(event.target.value))}
                  />
                  <button type="button" onClick={() => nudgePhotoPosition(2)} aria-label="Descer enquadramento">
                    <PlusIcon size={15} />
                  </button>
                </div>
                <div className="secretaria-photo-options-actions">
                  <button type="button" className="btn-secondary" onClick={() => setAdjustingPhotoId(null)}>
                    Cancelar
                  </button>
                  <button type="button" className="btn-primary" onClick={() => handleSavePhotoAdjustment(photoActionsParticipant)}>
                    Salvar ajuste
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="secretaria-photo-options-grid">
                  {photoActionsParticipant.foto_url && (
                    <>
                      <button
                        type="button"
                        className="secretaria-photo-option"
                        onClick={() => handleDownloadPhoto(photoActionsParticipant.foto_url!, photoActionsParticipant.pessoas?.nome_completo || 'Participante')}
                      >
                        <Download size={17} /> Baixar
                      </button>
                      <button
                        type="button"
                        className="secretaria-photo-option"
                        onClick={() => handleStartPhotoAdjustment(photoActionsParticipant)}
                      >
                        <SlidersHorizontal size={17} /> Ajustar
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="secretaria-photo-option primary"
                    onClick={() => photoActionsInputRef.current?.click()}
                  >
                    {photoActionsParticipant.foto_url ? <Camera size={17} /> : <Upload size={17} />}
                    {photoActionsParticipant.foto_url ? 'Alterar' : 'Adicionar'}
                  </button>
                </div>
                <input
                  ref={photoActionsInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) handlePhotoActionsUpload(file);
                    event.target.value = '';
                  }}
                />
              </>
            )}
          </div>
        )}
      </Modal>

      <style>{`
        .secretaria-tabs {
          display: flex;
          gap: 0.65rem;
          flex-wrap: wrap;
          margin: 0 0 1rem;
        }
        .secretaria-tabs button {
          border: 1px solid var(--border-color);
          background: var(--card-bg);
          color: var(--text-color);
          border-radius: 8px;
          padding: 0.65rem 0.85rem;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 800;
          cursor: pointer;
        }
        .secretaria-tabs button span {
          min-width: 24px;
          height: 22px;
          border-radius: 999px;
          background: var(--secondary-bg);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 0.4rem;
          font-size: 0.75rem;
        }
        .secretaria-tabs button.is-active {
          border-color: color-mix(in srgb, var(--primary-color) 55%, var(--border-color));
          background: rgba(var(--primary-rgb), 0.1);
          color: var(--primary-color);
        }
        .secretaria-tabs button.is-active.danger {
          border-color: rgba(239, 68, 68, 0.35);
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }
        .secretaria-filter-grid {
          display: grid;
          grid-template-columns: minmax(220px, 0.85fr) minmax(360px, 1.65fr) minmax(148px, 0.5fr);
          gap: 1.25rem;
          align-items: end;
        }
        .secretaria-result-summary {
          font-size: 0.85rem;
          opacity: 0.6;
          margin: 0 0 0.75rem;
        }
        .secretaria-desistentes-list {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }
        .secretaria-desistente-card {
          display: grid;
          grid-template-columns: 46px minmax(0, 1fr) auto;
          gap: 1rem;
          align-items: center;
          padding: 1rem;
          border-left: 4px solid #ef4444;
        }
        .secretaria-desistente-avatar {
          width: 46px;
          height: 46px;
          border-radius: 12px;
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 1.1rem;
        }
        .secretaria-desistente-main {
          min-width: 0;
          display: grid;
          gap: 0.55rem;
        }
        .secretaria-desistente-main h3 {
          margin: 0;
          font-size: 1rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .secretaria-desistente-badges,
        .secretaria-desistente-details {
          display: flex;
          gap: 0.45rem;
          flex-wrap: wrap;
          align-items: center;
        }
        .secretaria-desistente-badges span {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          border-radius: 999px;
          border: 1px solid var(--border-color);
          padding: 0.18rem 0.55rem;
          font-size: 0.72rem;
          font-weight: 800;
          color: var(--text-color);
          background: var(--secondary-bg);
        }
        .secretaria-desistente-details span {
          font-size: 0.78rem;
          color: var(--muted-text);
          overflow-wrap: anywhere;
        }
        .secretaria-desistente-actions {
          display: flex;
          justify-content: flex-end;
        }
        .secretaria-restore-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          line-height: 1;
          white-space: nowrap;
        }
        .secretaria-restore-button svg {
          display: block;
          flex-shrink: 0;
        }
        .secretaria-desistente-readonly {
          font-size: 0.75rem;
          color: var(--muted-text);
          text-align: right;
        }
        .dropdown-item-custom {
          width: 100%;
          padding: 0.85rem 1rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          border: none;
          background: none;
          cursor: pointer;
          color: var(--text-color);
          transition: background-color 0.15s;
        }
        .dropdown-item-custom:hover {
          background-color: var(--primary-light);
        }
        .icon-box-pdf, .icon-box-excel {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .icon-box-pdf {
          background-color: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }
        .icon-box-excel {
          background-color: rgba(16, 185, 129, 0.1);
          color: #10b981;
        }
        .action-btn-hover:hover {
          background-color: rgba(239, 68, 68, 0.1);
        }
        .secretaria-unlink-button {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          border: 1px solid rgba(239, 68, 68, 0.7);
          background: transparent;
          color: #ef4444;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          cursor: pointer;
          transition: opacity 0.2s ease, transform 0.2s ease;
        }
        .secretaria-unlink-button svg {
          display: block;
          width: 16px;
          height: 16px;
          color: #ef4444;
          stroke: #ef4444;
          flex-shrink: 0;
        }
        .secretaria-unlink-button:hover {
          background: rgba(239, 68, 68, 0.08);
          border-color: #ef4444;
          transform: translateY(-1px);
        }
        .secretaria-unlink-button span {
          display: none;
          font-size: 0.85rem;
          font-weight: 700;
        }
        .secretaria-pessoa-row {
          display: grid;
          grid-template-columns: minmax(330px, 1.55fr) minmax(190px, 0.85fr) minmax(280px, 1.25fr) auto;
          align-items: center;
        }
        .secretaria-photo-block {
          display: flex;
          align-items: center;
          flex: 0 0 auto;
          width: 76px;
        }
        .secretaria-participant-photo {
          width: 66px;
          height: 66px;
          border-radius: 14px;
          border: 1px solid var(--border-color);
          background: var(--secondary-bg);
          color: var(--muted-text);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          flex-shrink: 0;
          padding: 0;
          cursor: pointer;
          position: relative;
        }
        .secretaria-participant-photo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .secretaria-photo-camera {
          position: absolute;
          right: 4px;
          bottom: 4px;
          width: 22px;
          height: 22px;
          border-radius: 7px;
          border: 1px solid rgba(255, 255, 255, 0.55);
          background: rgba(15, 23, 42, 0.72);
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .secretaria-link-badges {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          flex-wrap: wrap;
          margin-top: 0.4rem;
        }
        .secretaria-context-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          max-width: 100%;
          border-radius: 999px;
          padding: 0.15rem 0.5rem;
          border: 1px solid rgba(37, 99, 235, 0.2);
          background: rgba(37, 99, 235, 0.08);
          color: var(--primary-color);
          font-size: 0.7rem;
          font-weight: 700;
        }
        .secretaria-context-badge.circle {
          border-color: rgba(245, 158, 11, 0.25);
          background: rgba(245, 158, 11, 0.1);
          color: #d97706;
        }
        .secretaria-context-badge.circle.muted {
          border-color: var(--border-color);
          background: color-mix(in srgb, var(--muted-text) 8%, transparent);
          color: var(--muted-text);
        }
        .secretaria-context-badge.vehicle {
          border-color: rgba(37, 99, 235, 0.2);
          background: rgba(37, 99, 235, 0.08);
          color: var(--primary-color);
        }
        .secretaria-photo-preview-modal {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .secretaria-photo-preview-modal img {
          width: 100%;
          max-height: min(70vh, 620px);
          object-fit: contain;
          border-radius: 8px;
          background: var(--secondary-bg);
          border: 1px solid var(--border-color);
        }
        .secretaria-photo-preview-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
        }
        .secretaria-photo-options-modal {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .secretaria-photo-options-frame {
          position: relative;
          width: min(100%, 560px);
          height: min(58vh, 460px);
          margin: 0 auto;
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid var(--border-color);
          background: var(--secondary-bg);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .secretaria-photo-options-frame img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
        }
        .secretaria-photo-options-frame img.is-adjusting {
          object-fit: cover;
        }
        .secretaria-photo-options-empty {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.65rem;
          color: var(--muted-text);
          font-weight: 700;
        }
        .secretaria-photo-options-loading {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.48);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .secretaria-photo-options-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(112px, 1fr));
          gap: 0.65rem;
          width: 100%;
        }
        .secretaria-photo-option {
          min-height: 42px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background: var(--card-bg);
          color: var(--text-color);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          font-weight: 800;
          cursor: pointer;
        }
        .secretaria-photo-option svg,
        .secretaria-photo-adjust-control button svg,
        .secretaria-photo-options-actions button svg {
          color: currentColor;
          stroke: currentColor;
          flex-shrink: 0;
        }
        .secretaria-photo-option:hover {
          border-color: color-mix(in srgb, var(--primary-color) 45%, var(--border-color));
          color: var(--primary-color);
        }
        .secretaria-photo-option.primary {
          background: var(--primary-color);
          border-color: var(--primary-color);
          color: #fff;
        }
        .secretaria-photo-option.primary svg {
          color: #fff;
          stroke: #fff;
        }
        .secretaria-photo-options-adjust {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          width: min(100%, 560px);
          margin: 0 auto;
        }
        .secretaria-photo-options-adjust label {
          font-weight: 800;
          font-size: 0.85rem;
        }
        .secretaria-photo-options-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        .secretaria-photo-adjust-control {
          display: grid;
          grid-template-columns: 38px 1fr 38px;
          align-items: center;
          gap: 0.55rem;
        }
        .secretaria-photo-adjust-control button {
          width: 38px;
          height: 38px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background: var(--card-bg);
          color: var(--text-color);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .secretaria-photo-adjust-control button:hover {
          color: var(--primary-color);
          border-color: color-mix(in srgb, var(--primary-color) 45%, var(--border-color));
        }
        .secretaria-photo-adjust-control input[type="range"] {
          width: 100%;
          accent-color: var(--primary-color);
        }
        @media (max-width: 640px) {
          .secretaria-photo-options-frame {
            height: min(48vh, 360px);
          }
          .secretaria-photo-options-grid {
            grid-template-columns: 1fr 1fr;
          }
          .secretaria-photo-options-actions {
            justify-content: stretch;
          }
          .secretaria-photo-options-actions button {
            flex: 1;
          }
        }
        .secretaria-pessoa-main,
        .secretaria-pessoa-contact,
        .secretaria-pessoa-address {
          min-width: 0;
        }
        .secretaria-pessoa-contact,
        .secretaria-pessoa-address {
          display: flex;
        }
        .secretaria-pessoa-contact .pessoa-row-value,
        .secretaria-pessoa-contact .pessoa-row-sub,
        .secretaria-pessoa-address .pessoa-row-value,
        .secretaria-pessoa-address .pessoa-row-sub {
          overflow-wrap: anywhere;
        }
        .secretaria-address-main span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .secretaria-address-sub {
          display: block;
        }
        .secretaria-pessoa-actions {
          justify-content: flex-end;
          margin-left: 0;
        }
        @media (max-width: 900px) {
          .secretaria-filter-grid {
            grid-template-columns: 1fr;
            gap: 1rem;
          }
          .secretaria-tabs {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }
          .secretaria-tabs button {
            justify-content: center;
          }
          .secretaria-desistente-card {
            grid-template-columns: 42px minmax(0, 1fr);
            align-items: start;
          }
          .secretaria-desistente-actions {
            grid-column: 1 / -1;
            justify-content: stretch;
          }
          .secretaria-desistente-actions .btn-primary {
            width: 100%;
            justify-content: center;
          }
          .secretaria-pessoa-grid {
            gap: 0.85rem;
            border: none;
            overflow: visible;
          }
          .secretaria-pessoa-row {
            grid-template-columns: 1fr;
            align-items: stretch;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 0.9rem;
            gap: 0.8rem;
          }
          .secretaria-pessoa-main {
            align-items: flex-start;
          }
          .secretaria-photo-block {
            width: 66px;
          }
          .secretaria-participant-photo {
            width: 58px;
            height: 58px;
            border-radius: 12px;
          }
          .secretaria-pessoa-row:last-child {
            border-bottom: 1px solid var(--border-color);
          }
          .secretaria-pessoa-contact,
          .secretaria-pessoa-address {
            display: flex;
          }
          .secretaria-address-main span,
          .secretaria-pessoa-contact .pessoa-row-sub {
            white-space: normal;
            overflow: visible;
            text-overflow: clip;
          }
          .secretaria-pessoa-actions {
            justify-content: flex-start;
            padding-top: 0.35rem;
            border-top: 1px solid var(--border-color);
          }
          .secretaria-unlink-button {
            width: 100%;
            height: 40px;
          }
          .secretaria-unlink-button span {
            display: inline;
          }
        }
      `}</style>
    </>
  );
}
