import {
  ArrowLeftRight,
  Check,
  Edit2,
  ExternalLink,
  Link2,
  Link2OffIcon,
  List,
  Loader,
  Lock,
  MapPin,
  Monitor,
  Plus,
  Search as SearchIcon,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
  TrendingUp,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronRight,
  Camera,
  ImagePlus
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { WhatsappLogo } from 'phosphor-react';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { FormField } from '../../components/ui/FormField';
import { FormRow } from '../../components/ui/FormRow';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { PageHeader } from '../../components/ui/PageHeader';
import { MobileFileUploadButton } from '../../components/ui/MobileFileUploadButton';
import { EncontristaMap } from '../../components/visitacao/EncontristaMap';
import { TrocaDuplasModal } from '../../components/visitacao/TrocaDuplasModal';
import { AddressGeolocationControls, type GeolocationFormValue } from '../../components/geolocation/AddressGeolocationControls';
import { inscricaoService } from '../../services/inscricaoService';
import { geolocationService } from '../../services/geolocationService';
import { visitacaoService } from '../../services/visitacaoService';
import { useEncontros } from '../../contexts/EncontroContext';
import { useEquipes } from '../../hooks/useEquipes';
import type { InscricaoEnriched } from '../../types/inscricao';
import type { VisitaGrupo, VisitaGrupoDeleteImpact, VisitaParticipacaoEnriched, VisitaStatus } from '../../types/visitacao';
import type { ParticipacaoCancelada } from '../../services/inscricaoService';
import { normalizeString, formatPhone } from '../../utils/stringUtils';
import { getAddressByCEP } from '../../services/cepService';
import { getPlanningCoordinate, hasRegionalAddress, isRouteReadyLocation } from '../../types/geolocation';
import { buildGoogleMapsStopUrl } from '../../utils/visitRoutePlanning';

type AddressFormState = GeolocationFormValue & {
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  cep: string;
  estado: string;
};

type GrupoMonitoramento = VisitaGrupo & {
  visitantes: VisitaParticipacaoEnriched[];
  membrosVisita: VisitaParticipacaoEnriched[];
  desistentes: ParticipacaoCancelada[];
  stats: {
    total: number;
    realizadas: number;
    ausentes: number;
    canceladas: number;
    pendentes: number;
  };
  progresso: number;
};

type GrupoComDesistentes = Pick<GrupoMonitoramento, 'nome' | 'desistentes'>;

type ParticipantFilterMode = 'all' | 'exclude_current' | 'current' | 'unlinked' | 'unmapped';

const PARTICIPANT_FILTER_OPTIONS: Array<{ value: ParticipantFilterMode; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'exclude_current', label: 'Exceto esta dupla' },
  { value: 'current', label: 'Nesta dupla' },
  { value: 'unlinked', label: 'Sem dupla' },
  { value: 'unmapped', label: 'Sem localização' },
];

function ParticipantFilterChips({
  value,
  onChange,
  count,
}: {
  value: ParticipantFilterMode;
  onChange: (value: ParticipantFilterMode) => void;
  count: number;
}) {
  return (
    <div className="participant-filter-row">
      <div className="participant-filter-chips" role="group" aria-label="Filtrar encontristas">
        {PARTICIPANT_FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            className={`participant-filter-chip ${value === option.value ? 'active' : ''}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <span className="participant-result-count">
        {count} {count === 1 ? 'encontrista' : 'encontristas'}
      </span>
    </div>
  );
}

export function CoordenadorVisitacaoPage() {
  const [searchParams] = useSearchParams();
  const requestedGroupId = searchParams.get('grupo');
  const { encontroSelecionadoId: selectedEncontroId, encontroSelecionado } = useEncontros();
  const { equipes } = useEquipes();
  const [activeTab, setActiveTab] = useState<'painel' | 'vincular'>('painel');

  // Data States
  const [grupos, setGrupos] = useState<VisitaGrupo[]>([]);
  const [selectedGrupoId, setSelectedGrupoId] = useState<string>('');
  const [participantes, setParticipantes] = useState<InscricaoEnriched[]>([]); // jovens
  const [equipeVisitacao, setEquipeVisitacao] = useState<InscricaoEnriched[]>([]);
  const [vinculos, setVinculos] = useState<VisitaParticipacaoEnriched[]>([]);
  const [participacoesCanceladas, setParticipacoesCanceladas] = useState<ParticipacaoCancelada[]>([]);

  // Selection states 
  const [selectedPessoa1, setSelectedPessoa1] = useState<string>('');
  const [selectedPessoa2, setSelectedPessoa2] = useState<string>('');
  const [listParticipantSearch, setListParticipantSearch] = useState('');
  const [searchParticipant, setSearchParticipant] = useState('');
  const [editingName, setEditingName] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');
  const [pendingRename, setPendingRename] = useState<{ id: string; oldName: string; newName: string } | null>(null);
  const [deleteImpact, setDeleteImpact] = useState<VisitaGrupoDeleteImpact | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isLoadingDeleteImpact, setIsLoadingDeleteImpact] = useState(false);
  const [replacementTarget, setReplacementTarget] = useState<{
    grupoId: string;
    grupoNome: string;
    vinculoId: string;
    visitanteNome: string;
  } | null>(null);
  const [replacementParticipationId, setReplacementParticipationId] = useState('');
  const [moveParticipantTarget, setMoveParticipantTarget] = useState<{
    vinculoId: string;
    pessoaNome: string;
    sourceGrupoId: string;
    sourceGrupoNome: string;
  } | null>(null);
  const [vincularSubTab, setVincularSubTab] = useState<'lista' | 'buscar' | 'mapa'>('lista');
  const [neighborhoodFilter, setNeighborhoodFilter] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [participantFilterMode, setParticipantFilterMode] = useState<ParticipantFilterMode>('all');
  const [monitorFilter, setMonitorFilter] = useState<'todos' | 'pendentes' | 'concluidos' | 'nao_iniciados'>('todos');
  const [selectedDuoForDetails, setSelectedDuoForDetails] = useState<GrupoMonitoramento | null>(null);
  const [selectedDuoForCanceled, setSelectedDuoForCanceled] = useState<GrupoComDesistentes | null>(null);
  const [photoPreviewGroup, setPhotoPreviewGroup] = useState<VisitaGrupo | null>(null);
  const [photoTargetGroup, setPhotoTargetGroup] = useState<VisitaGrupo | null>(null);
  const [photoDeleteTarget, setPhotoDeleteTarget] = useState<VisitaGrupo | null>(null);
  const [uploadingGroupId, setUploadingGroupId] = useState<string | null>(null);
  const photoPickerTriggerRef = useRef<HTMLButtonElement>(null);

  // UI States
  const [isFetching, setIsFetching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [editingAddressPessoa, setEditingAddressPessoa] = useState<InscricaoEnriched | null>(null);
  const [addressForm, setAddressForm] = useState<AddressFormState>({
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    cep: '',
    estado: 'SP',
    latitude: null,
    longitude: null,
    geo_status: 'pending',
    geo_retry_count: 0,
  });
  const isHistoricalEncounter = encontroSelecionado?.ativo !== true;

  const requireActiveEncounter = () => {
    if (!isHistoricalEncounter) return true;
    toast.error('Encontro encerrado. A composição das duplas está disponível apenas para consulta.');
    return false;
  };

  useEffect(() => {
    if (!isHistoricalEncounter) return;
    setIsCreateModalOpen(false);
    setIsSwapModalOpen(false);
    setEditingName(null);
    setPendingRename(null);
    setDeleteImpact(null);
    setPhotoDeleteTarget(null);
    setReplacementTarget(null);
    setMoveParticipantTarget(null);
    setEditingAddressPessoa(null);
  }, [isHistoricalEncounter]);

  const loadData = useCallback(async () => {
    if (!selectedEncontroId) return;
    setIsFetching(true);
    try {
      // Filtros server-side: busca apenas participantes (jovens)
      const allParticipantes = await inscricaoService.listarParticipantesPorEncontro(selectedEncontroId);
      setParticipantes(allParticipantes);

      // Usa equipes do contexto (já cacheado) para encontrar a equipe de visitação
      const visitacaoTeam = equipes.find(e => e.nome?.toLowerCase().includes('visitação') || e.nome?.toLowerCase().includes('visitacao'));

      if (visitacaoTeam) {
        const encontreiros = await inscricaoService.listarEncontreirosPorEncontro(selectedEncontroId);
        setEquipeVisitacao(encontreiros.filter(i => i.equipe_id === visitacaoTeam.id));
      } else {
        const encontreiros = await inscricaoService.listarEncontreirosPorEncontro(selectedEncontroId);
        setEquipeVisitacao(encontreiros);
      }

      const [gData, vData, canceladosData] = await Promise.all([
        visitacaoService.listarGrupos(selectedEncontroId),
        visitacaoService.listarParticipacaoPorEncontro(selectedEncontroId),
        inscricaoService.listarCanceladosPorEncontro(selectedEncontroId)
      ]);

      setGrupos(gData);
      setVinculos(vData || []);
      setParticipacoesCanceladas(canceladosData || []);

      if (gData.length > 0) {
        const nextGroupId = gData.some((group) => group.id === requestedGroupId)
          ? requestedGroupId!
          : (gData.some((group) => group.id === selectedGrupoId) ? selectedGrupoId : gData[0].id);
        if (nextGroupId !== selectedGrupoId) setSelectedGrupoId(nextGroupId);
      }
    } catch (_error) {
      console.error('Error loading meeting data:', _error);
    } finally {
      setIsFetching(false);
    }
  }, [selectedEncontroId, selectedGrupoId, equipes, requestedGroupId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Updated filtering rule for visitors
  const visitantesDisponiveis = useMemo(() => {
    // Current group visitors
    const vinculadosComoVisitantes = new Set(
      vinculos.filter(v => v.visitante).map(v => v.participacao_id)
    );

    return equipeVisitacao.filter(p =>
      !p.coordenador && // Not a coordinator
      !vinculadosComoVisitantes.has(p.id) // Not already linked as visitor
    );
  }, [equipeVisitacao, vinculos]);

  const handleVincular = async (participacaoId: string) => {
    if (!requireActiveEncounter()) return;
    if (!selectedGrupoId || !selectedEncontroId) return;
    const existingVinculo = vinculos.find(v => v.participacao_id === participacaoId);
    if (existingVinculo?.grupo_id) {
      toast.error('Esta pessoa já está vinculada a uma visita.');
      return;
    }

    setIsLoading(true);
    try {
      await visitacaoService.vincularOuReatribuirEncontrista(selectedGrupoId, participacaoId);
      await loadData();
      toast.success('Pessoa vinculada com sucesso!');
    } catch {
      toast.error('Erro ao vincular à visita.');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmMoveParticipant = async () => {
    if (!requireActiveEncounter()) return;
    if (!moveParticipantTarget || !selectedGrupoId) return;

    setIsLoading(true);
    try {
      await visitacaoService.trocarEncontristasEntreDuplas(
        moveParticipantTarget.sourceGrupoId,
        selectedGrupoId,
        'individual',
        [moveParticipantTarget.vinculoId]
      );
      setMoveParticipantTarget(null);
      await loadData();
      toast.success('Dupla do encontrista alterada com sucesso.');
    } catch {
      toast.error('Não foi possível alterar a dupla do encontrista.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!requireActiveEncounter()) return;
    if (!selectedEncontroId || !selectedPessoa1 || !selectedPessoa2) return;
    setIsLoading(true);
    try {
      const newGroup = await visitacaoService.criarDuplaTransacional(
        selectedEncontroId,
        selectedPessoa1,
        selectedPessoa2
      );

      setSelectedPessoa1('');
      setSelectedPessoa2('');
      setSelectedGrupoId(newGroup.id);
      setIsCreateModalOpen(false);
      await loadData();
      toast.success('Dupla de visitação criada com sucesso!');
    } catch {
      toast.error('Erro ao criar grupo de visitação.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRenameGroup = async () => {
    if (!requireActiveEncounter()) return;
    if (!editingName || !tempName.trim()) return;
    const group = grupos.find(item => item.id === editingName);
    const currentName = group?.nome?.trim() || '';
    const newName = tempName.trim();
    if (currentName === newName) {
      setEditingName(null);
      return;
    }
    setPendingRename({ id: editingName, oldName: currentName, newName });
  };

  const confirmRenameGroup = async () => {
    if (!requireActiveEncounter()) return;
    if (!pendingRename) return;
    setIsLoading(true);
    try {
      await visitacaoService.atualizarGrupo(pendingRename.id, pendingRename.newName);
      setEditingName(null);
      setPendingRename(null);
      await loadData();
      toast.success('Grupo renomeado com sucesso!');
    } catch {
      toast.error('Erro ao renomear grupo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDesvincular = async (id: string) => {
    if (!requireActiveEncounter()) return;
    setIsLoading(true);
    try {
      await visitacaoService.desvincular(id);
      await loadData();
      toast.success('Desvinculado com sucesso!');
    } catch {
      toast.error('Erro ao desvincular.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!requireActiveEncounter()) return;
    setIsLoadingDeleteImpact(true);
    try {
      const impact = await visitacaoService.obterImpactoExclusaoGrupo(id);
      setDeleteImpact(impact);
      setDeleteConfirmation('');
    } catch {
      toast.error('Não foi possível analisar o impacto da exclusão.');
    } finally {
      setIsLoadingDeleteImpact(false);
    }
  };

  const confirmDeleteGroup = async () => {
    if (!requireActiveEncounter()) return;
    if (!deleteImpact) return;
    setIsLoading(true);
    try {
      await visitacaoService.dissolverGrupo(deleteImpact.grupo_id);
      if (selectedGrupoId === deleteImpact.grupo_id) setSelectedGrupoId('');
      setSelectedDuoForDetails(null);
      setDeleteImpact(null);
      setDeleteConfirmation('');
      await loadData();
      toast.success('Dupla dissolvida. Os encontristas continuam disponíveis para reatribuição.');
    } catch {
      toast.error('Erro ao dissolver a dupla. Nenhuma alteração foi concluída.');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmVisitorReplacement = async () => {
    if (!requireActiveEncounter()) return;
    if (!replacementTarget || !replacementParticipationId) return;
    setIsLoading(true);
    try {
      await visitacaoService.substituirVisitante(
        replacementTarget.grupoId,
        replacementTarget.vinculoId,
        replacementParticipationId
      );
      setReplacementTarget(null);
      setReplacementParticipationId('');
      setSelectedDuoForDetails(null);
      await loadData();
      toast.success('Visitante substituído e nome da dupla atualizado.');
    } catch {
      toast.error('Erro ao substituir visitante. A dupla não foi alterada.');
    } finally {
      setIsLoading(false);
    }
  };

  const openGroupPhotoPicker = (group: VisitaGrupo) => {
    if (!requireActiveEncounter()) return;
    setPhotoTargetGroup(group);
    photoPickerTriggerRef.current?.click();
  };

  const handleGroupPhotoSelected = async (files: File[]) => {
    const file = files[0];
    if (!file || !photoTargetGroup || !requireActiveEncounter()) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem para a foto da dupla.');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 8MB.');
      return;
    }

    const target = photoTargetGroup;
    setUploadingGroupId(target.id);
    try {
      const fotoUrl = await visitacaoService.uploadFotoGrupo(target.id, file);
      await visitacaoService.atualizarFotoGrupo(target.id, fotoUrl);
      setGrupos(current => current.map(group => group.id === target.id ? { ...group, foto_url: fotoUrl } : group));
      setPhotoPreviewGroup(current => current?.id === target.id ? { ...current, foto_url: fotoUrl } : current);
      toast.success(target.foto_url ? 'Foto da dupla trocada.' : 'Foto da dupla adicionada.');
    } catch (error) {
      console.error('Erro ao salvar foto da dupla:', error);
      toast.error('Erro ao salvar foto da dupla.');
    } finally {
      setUploadingGroupId(null);
      setPhotoTargetGroup(null);
    }
  };

  const handleDeleteGroupPhoto = async () => {
    if (!requireActiveEncounter()) return;
    const fotoUrl = photoDeleteTarget?.foto_url;
    if (!photoDeleteTarget || !fotoUrl) return;

    const group = photoDeleteTarget;
    setUploadingGroupId(group.id);
    try {
      await visitacaoService.removerFotoGrupo(group.id, fotoUrl);
      setGrupos(current => current.map(item => item.id === group.id ? { ...item, foto_url: null } : item));
      setPhotoPreviewGroup(null);
      toast.success('Foto da dupla excluída.');
    } catch (error) {
      console.error('Erro ao excluir foto da dupla:', error);
      toast.error('Erro ao excluir foto da dupla.');
    } finally {
      setUploadingGroupId(null);
      setPhotoDeleteTarget(null);
    }
  };

  const handleEditAddress = (p: InscricaoEnriched) => {
    if (!requireActiveEncounter()) return;
    if (!p.pessoas) return;
    setAddressForm({
      endereco: p.pessoas.endereco || '',
      numero: p.pessoas.numero || '',
      complemento: p.pessoas.complemento || '',
      bairro: p.pessoas.bairro || '',
      cidade: p.pessoas.cidade || '',
      cep: p.pessoas.cep || '',
      estado: p.pessoas.estado || 'SP',
      latitude: p.pessoas.latitude,
      longitude: p.pessoas.longitude,
      geo_status: p.pessoas.geo_status || (p.pessoas.latitude != null && p.pessoas.longitude != null ? 'legacy_review' : 'pending'),
      geo_source: p.pessoas.geo_source,
      geo_precision: p.pessoas.geo_precision,
      geo_accuracy_m: p.pessoas.geo_accuracy_m,
      geo_address_fingerprint: p.pessoas.geo_address_fingerprint,
      geo_checked_at: p.pessoas.geo_checked_at,
      geo_verified_at: p.pessoas.geo_verified_at,
      geo_verified_by: p.pessoas.geo_verified_by,
      geo_failure_code: p.pessoas.geo_failure_code,
      geo_retry_count: p.pessoas.geo_retry_count || 0,
      geo_next_retry_at: p.pessoas.geo_next_retry_at,
      geo_reference_latitude: p.pessoas.geo_reference_latitude,
      geo_reference_longitude: p.pessoas.geo_reference_longitude,
      geo_reference_source: p.pessoas.geo_reference_source,
      geo_reference_precision: p.pessoas.geo_reference_precision,
      geo_reference_address_fingerprint: p.pessoas.geo_reference_address_fingerprint,
      geo_reference_checked_at: p.pessoas.geo_reference_checked_at,
    });
    setEditingAddressPessoa(p);
  };

  const handleAddressFieldChange = (field: keyof Pick<AddressFormState, 'endereco' | 'numero' | 'complemento' | 'bairro' | 'cidade' | 'cep' | 'estado'>, value: string) => {
    setAddressForm(prev => ({
      ...prev,
      [field]: value,
      latitude: null,
      longitude: null,
      geo_status: 'pending',
      geo_source: null,
      geo_precision: null,
      geo_accuracy_m: null,
      geo_address_fingerprint: null,
      geo_checked_at: null,
      geo_verified_at: null,
      geo_verified_by: null,
      geo_failure_code: null,
      geo_next_retry_at: null,
      geo_reference_latitude: null,
      geo_reference_longitude: null,
      geo_reference_source: null,
      geo_reference_precision: null,
      geo_reference_address_fingerprint: null,
      geo_reference_checked_at: null,
    }));
  };

  const handleCEPBlur = async () => {
    const cleanCEP = addressForm.cep.replace(/\D/g, '');
    if (cleanCEP.length === 8) {
      setIsLoading(true);
      try {
        const data = await getAddressByCEP(cleanCEP);
        if (data) {
          setAddressForm(prev => ({
            ...prev,
            endereco: data.endereco || prev.endereco,
            bairro: data.bairro || prev.bairro,
            cidade: data.cidade || prev.cidade,
            estado: data.estado || prev.estado,
            latitude: null,
            longitude: null,
            geo_status: 'pending',
            geo_source: null,
            geo_precision: null,
            geo_accuracy_m: null,
            geo_address_fingerprint: null,
            geo_checked_at: null,
            geo_verified_at: null,
            geo_verified_by: null,
            geo_failure_code: null,
            geo_next_retry_at: null,
            geo_reference_latitude: null,
            geo_reference_longitude: null,
            geo_reference_source: null,
            geo_reference_precision: null,
            geo_reference_address_fingerprint: null,
            geo_reference_checked_at: null,
          }));
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  const formatCEP = (val: string) => {
    const v = val.replace(/\D/g, '').slice(0, 8);
    if (v.length <= 5) return v;
    return `${v.slice(0, 5)}-${v.slice(5)}`;
  };

  const handleSaveAddress = async () => {
    if (!requireActiveEncounter()) return;
    if (!editingAddressPessoa) return;
    setIsLoading(true);
    try {
      const resolution = isRouteReadyLocation(addressForm)
        ? null
        : await geolocationService.resolveRegionalReferenceForPersistence(addressForm);
      const updateData: AddressFormState = resolution
        ? { ...addressForm, ...resolution.update }
        : addressForm;
      // 2. Atualiza no banco
      await visitacaoService.atualizarEnderecoParticipante(editingAddressPessoa.id, updateData);

      // 3. Atualiza localmente o estado de participantes para refletir a mudança
      setParticipantes(prev => prev.map(p => {
        if (p.pessoa_id === editingAddressPessoa.pessoa_id) {
          return {
            ...p,
            pessoas: p.pessoas ? { ...p.pessoas, ...updateData } : undefined
          };
        }
        return p;
      }));

      // 4. Se houver vínculos na tela, atualiza eles também
      setVinculos(prev => prev.map(v => {
        if (v.participacao_id === editingAddressPessoa.id && v.participacoes) {
          return {
            ...v,
            participacoes: {
              ...v.participacoes,
              pessoas: v.participacoes.pessoas
                ? { ...v.participacoes.pessoas, ...updateData }
                : null
            }
          };
        }
        return v;
      }));

      if (isRouteReadyLocation(updateData)) {
        toast.success('Endereço e localização confiável atualizados.');
      } else if (updateData.geo_reference_latitude != null) {
        toast.success('Endereço e localização aproximada atualizados.');
      } else {
        toast('Endereço salvo sem referência geográfica. A navegação usará o endereço em texto.', { icon: 'ℹ️' });
      }
      setEditingAddressPessoa(null);
    } catch (err) {
      console.error('Erro ao salvar endereço:', err);
      toast.error('Erro ao atualizar endereço.');
    } finally {
      setIsLoading(false);
    }
  };

  const currentGrupo = useMemo(() =>
    grupos.find(g => g.id === selectedGrupoId),
    [grupos, selectedGrupoId]);

  const deleteHasOperationalImpact = Boolean(deleteImpact && (
    deleteImpact.encontristas_total > 0
    || deleteImpact.realizadas_total > 0
    || deleteImpact.ausentes_total > 0
    || deleteImpact.fotos_familia_total > 0
    || deleteImpact.intencoes_camiseta_total > 0
    || deleteImpact.presencas_total > 0
    || deleteImpact.desistentes_total > 0
  ));
  const deleteConfirmationPhrase = deleteImpact?.nome?.trim() || 'EXCLUIR';

  const replacementCandidate = useMemo(
    () => equipeVisitacao.find(item => item.id === replacementParticipationId) ?? null,
    [equipeVisitacao, replacementParticipationId]
  );

  const replacementGeneratedName = useMemo(() => {
    if (!replacementTarget || !replacementCandidate) return '';
    const groupVisitors = vinculos
      .filter(link => link.grupo_id === replacementTarget.grupoId && link.visitante)
      .map(link => link.id === replacementTarget.vinculoId
        ? replacementCandidate.pessoas?.nome_completo
        : link.participacoes?.pessoas?.nome_completo)
      .filter((name): name is string => Boolean(name));
    return groupVisitors.map(name => name.trim().split(' ')[0]).join(' & ');
  }, [replacementCandidate, replacementTarget, vinculos]);

  const searchResults = useMemo(() => {
    const q = normalizeString(searchParticipant);
    if (!q) return [];

    return participantes
      .filter(p => {
        const name = normalizeString(p.pessoas?.nome_completo || '');
        const email = normalizeString(p.pessoas?.email || '');
        const phone = normalizeString(p.pessoas?.telefone || '');
        return name.includes(q) || email.includes(q) || phone.includes(q);
      })
      .map(p => {
        const vinculo = vinculos.find(v => v.participacao_id === p.id && !v.visitante);
        if (!vinculo?.grupo_id) {
          return {
            id: p.id,
            vinculoId: vinculo?.id ?? null,
            nome: p.pessoas?.nome_completo,
            status: 'available' as const,
            grupoId: null,
            grupoNome: null,
          };
        }
        if (vinculo.grupo_id === selectedGrupoId) {
          return {
            id: p.id,
            vinculoId: vinculo.id,
            nome: p.pessoas?.nome_completo,
            status: 'in_this_group' as const,
            grupoId: vinculo.grupo_id,
            grupoNome: currentGrupo?.nome || 'Dupla selecionada',
          };
        }
        return {
          id: p.id,
          vinculoId: vinculo.id,
          nome: p.pessoas?.nome_completo,
          status: 'in_other_group' as const,
          grupoId: vinculo.grupo_id,
          grupoNome: vinculo.visita_grupos?.nome || 'Outra dupla',
        };
      })
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [currentGrupo?.nome, participantes, searchParticipant, selectedGrupoId, vinculos]);

  const filteredParticipants = useMemo(() => participantes
    .filter((participant) => {
      const nameMatch = normalizeString(participant.pessoas?.nome_completo || '')
        .includes(normalizeString(listParticipantSearch));
      const neighborhoodMatch = normalizeString(participant.pessoas?.bairro || '')
        .includes(normalizeString(neighborhoodFilter));
      if (!nameMatch || !neighborhoodMatch) return false;

      const link = vinculos.find(item => item.participacao_id === participant.id && !item.visitante);
      const isLinkedToSelected = link?.grupo_id === selectedGrupoId;
      const isUnmapped = !participant.pessoas || !getPlanningCoordinate(participant.pessoas);
      const hasNoLink = !link?.grupo_id;

      if (participantFilterMode === 'exclude_current') return !isLinkedToSelected;
      if (participantFilterMode === 'current') return isLinkedToSelected;
      if (participantFilterMode === 'unlinked') return hasNoLink;
      if (participantFilterMode === 'unmapped') return isUnmapped;
      return true;
    })
    .sort((left, right) => (left.pessoas?.nome_completo || '')
      .localeCompare(right.pessoas?.nome_completo || '')),
  [listParticipantSearch, neighborhoodFilter, participantFilterMode, participantes, selectedGrupoId, vinculos]);

  const stats = useMemo(() => {
    const totalP = vinculos.filter(v => !v.visitante).length;
    const realizada = vinculos.filter(v => !v.visitante && v.status === 'realizada').length;
    const pendente = vinculos.filter(v => !v.visitante && v.status === 'pendente').length;
    return { totalP, realizada, pendente, percent: totalP > 0 ? (realizada / totalP) * 100 : 0 };
  }, [vinculos]);

  const monitoramentoGrupos = useMemo(() => {
    const data = grupos.map(g => {
      const membrosVisita = vinculos.filter(v => v.grupo_id === g.id && !v.visitante);
      const visitantes = vinculos.filter(v => v.grupo_id === g.id && v.visitante);
      const desistentes = participacoesCanceladas.filter(c => c.grupo_id === g.id);
      const realizadas = membrosVisita.filter(m => m.status === 'realizada').length;
      const ausentes = membrosVisita.filter(m => m.status === 'ausente').length;
      const pendentes = membrosVisita.filter(m => m.status === 'pendente').length;

      return {
        ...g,
        visitantes,
        membrosVisita,
        desistentes,
        stats: {
          total: membrosVisita.length,
          realizadas,
          ausentes,
          canceladas: desistentes.length,
          pendentes
        },
        progresso: membrosVisita.length > 0
          ? (realizadas / membrosVisita.length) * 100
          : 0
      };
    });

    switch (monitorFilter) {
      case 'pendentes':
        return data.filter(g => g.progresso < 100 && g.membrosVisita.length > 0);
      case 'concluidos':
        return data.filter(g => g.progresso === 100 && g.membrosVisita.length > 0);
      case 'nao_iniciados':
        return data.filter(g => g.stats.realizadas === 0 && g.membrosVisita.length > 0);
      default:
        return data;
    }
  }, [grupos, vinculos, participacoesCanceladas, monitorFilter]);

  const getStatusBadge = (status: VisitaStatus) => {
    const config = {
      pendente: { label: 'Pendente', color: '#6b7280' },
      realizada: { label: 'Realizada', color: '#10b981' },
      ausente: { label: 'Ausente', color: '#f59e0b' },
      cancelada: { label: 'Desistente', color: '#ef4444' }
    };
    const s = config[status] || config.pendente;
    return <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', background: s.color + '20', color: s.color, fontWeight: 600 }}>{s.label}</span>;
  };

  const formatCancelamentoDate = (date?: string | null) => {
    if (!date) return null;
    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) return null;
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(parsedDate);
  };

  if (isFetching && !selectedEncontroId) return <div>Carregando...</div>;

  return (
    <>
      <PageHeader
        title="Gestão de Visitação"
        subtitle="Início / Visitação"
        backPath="/visitacao"
        tabs={
          <div className="tabs-modern-container desktop-visitacao-tabs">
            <button
              onClick={() => setActiveTab('painel')}
              className={`tab-btn-modern ${activeTab === 'painel' ? 'active' : ''}`}
            >
              <Monitor size={18} /> 1. Painel de Duplas
            </button>
            <button
              onClick={() => setActiveTab('vincular')}
              className={`tab-btn-modern ${activeTab === 'vincular' ? 'active' : ''}`}
            >
              <UserPlus size={18} /> 2. Vínculo de Encontristas
            </button>
          </div>
        }
      />

      {isHistoricalEncounter && (
        <div className="card" role="status" style={{ padding: '0.9rem 1rem', marginBottom: '1.5rem', borderColor: 'var(--warning-border, rgba(245, 158, 11, 0.45))', background: 'var(--warning-bg, rgba(245, 158, 11, 0.08))', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Lock size={17} />
          <span><strong>Encontro encerrado.</strong> A composição das duplas está disponível apenas para consulta.</span>
        </div>
      )}

      {activeTab === 'painel' && (
        <div className="flex-col gap-8">
          {/* GLOBAL HERO STATS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="card" style={{ flex: 1, padding: '1.5rem', background: 'linear-gradient(135deg, var(--card-bg) 0%, rgba(59, 130, 246, 0.05) 100%)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800 }}>
                      <TrendingUp size={22} /> Monitoramento Global
                    </h3>
                    <p style={{ margin: '0.4rem 0 0', fontSize: '0.9rem', opacity: 0.7 }}>
                      <strong>{stats.realizada}</strong> visitas realizadas de um total de <strong>{stats.totalP}</strong> encontristas.
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--primary-color)', lineHeight: 1 }}>
                      {Math.round(stats.percent)}%
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.5, textTransform: 'uppercase' }}>Concluído</span>
                  </div>
                </div>
                <div style={{ width: '100%', height: '14px', background: 'rgba(0,0,0,0.05)', borderRadius: '99px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${stats.percent}%`,
                    background: 'linear-gradient(90deg, #3b82f6 0%, #10b981 100%)',
                    borderRadius: '99px',
                    transition: 'width 1.5s cubic-bezier(0.4, 0, 0.2, 1)'
                  }} />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: '1rem' }}>
              <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ background: '#10b98115', color: '#10b981', padding: '0.75rem', borderRadius: '12px' }}>
                  <CheckCircle size={24} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, opacity: 0.6 }}>Visitas Realizadas</p>
                  <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>{stats.realizada}</h3>
                </div>
              </div>
              <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #f59e0b', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ background: '#f59e0b15', color: '#f59e0b', padding: '0.75rem', borderRadius: '12px' }}>
                  <Clock size={24} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, opacity: 0.6 }}>Aguardando Visita</p>
                  <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>{stats.pendente}</h3>
                </div>
              </div>
              <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #6366f1', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ background: '#6366f115', color: '#6366f1', padding: '0.75rem', borderRadius: '12px' }}>
                  <Users size={24} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, opacity: 0.6 }}>Duplas Ativas</p>
                  <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>{grupos.length}</h3>
                </div>
              </div>
            </div>
          </div>

          {/* FILTERS & ADD BUTTON */}
          <div className="visitacao-monitor-toolbar">
            <div className="visitacao-monitor-filters">
              <button
                onClick={() => setMonitorFilter('todos')}
                className={`filter-chip-modern ${monitorFilter === 'todos' ? 'active' : ''}`}
              >
                Todas as Duplas
              </button>
              <button
                onClick={() => setMonitorFilter('pendentes')}
                className={`filter-chip-modern ${monitorFilter === 'pendentes' ? 'active' : ''}`}
              >
                Em Andamento
              </button>
              <button
                onClick={() => setMonitorFilter('concluidos')}
                className={`filter-chip-modern ${monitorFilter === 'concluidos' ? 'active' : ''}`}
              >
                Concluídas
              </button>
              <button
                onClick={() => setMonitorFilter('nao_iniciados')}
                className={`filter-chip-modern ${monitorFilter === 'nao_iniciados' ? 'active' : ''}`}
              >
                <AlertTriangle size={14} /> Não Iniciadas
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setIsSwapModalOpen(true)}
                disabled={isHistoricalEncounter || grupos.length < 2}
                className="btn-secondary"
                title={isHistoricalEncounter ? 'Encontro encerrado' : 'Mover encontristas entre duplas'}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <ArrowLeftRight size={18} /> Trocar entre Duplas
              </button>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                disabled={isHistoricalEncounter}
                title={isHistoricalEncounter ? 'Encontro encerrado' : 'Montar nova dupla'}
                className="btn-primary visitacao-create-duo-button"
                style={{ padding: '0.6rem 1.25rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Plus size={20} /> Montar Nova Dupla
              </button>
            </div>
          </div>

          {/* DUOS GRID */}
          <div className="duo-grid">
            {monitoramentoGrupos.length === 0 ? (
              <div className="card" style={{ gridColumn: '1 / -1', padding: '4rem', textAlign: 'center', opacity: 0.5 }}>
                <Monitor size={48} style={{ marginBottom: '1rem' }} />
                <p>Nenhuma dupla encontrada para este filtro.</p>
              </div>
            ) : (
              monitoramentoGrupos.map(g => (
                <div key={g.id} className="card duo-monitor-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div className="duo-card-content">
                    <div className="duo-card-header">
                      <div className="duo-card-main">
                        <button
                          type="button"
                          onClick={() => g.foto_url ? setPhotoPreviewGroup(g) : openGroupPhotoPicker(g)}
                          disabled={uploadingGroupId === g.id || (isHistoricalEncounter && !g.foto_url)}
                          title={g.foto_url ? 'Ver foto da dupla' : isHistoricalEncounter ? 'Encontro encerrado' : 'Adicionar foto da dupla'}
                          aria-label={g.foto_url ? `Ver foto da dupla ${g.nome}` : `Adicionar foto à dupla ${g.nome}`}
                          className="duo-photo-button"
                        >
                          {uploadingGroupId === g.id ? (
                            <Loader size={18} className="animate-spin" />
                          ) : g.foto_url ? (
                            <img src={g.foto_url} alt={`Foto ${g.nome}`} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <Camera size={18} />
                          )}
                        </button>
                        <div className="duo-card-identity">
                          <h4>{g.nome}</h4>
                          <div style={{ display: 'flex', gap: '4px', marginTop: '2px', flexWrap: 'wrap', overflow: 'hidden' }}>
                            {g.visitantes.map(v => (
                              <span key={v.id} style={{ fontSize: '0.7rem', opacity: 0.6 }}>
                                {v.participacoes?.pessoas?.nome_completo?.split(' ')[0]}
                                {g.visitantes.indexOf(v) < g.visitantes.length - 1 ? ' • ' : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="duo-card-meta">
                        <span style={{
                          fontSize: '0.7rem', fontWeight: 800, padding: '3px 8px', borderRadius: '8px',
                          background: g.progresso === 100 ? '#10b98120' : g.progresso > 0 ? '#3b82f620' : '#6b728020',
                          color: g.progresso === 100 ? '#10b981' : g.progresso > 0 ? '#3b82f6' : '#6b7280'
                        }}>
                          {g.progresso === 100 ? 'CONCLUÍDO' : g.progresso > 0 ? 'EM ANDAMENTO' : 'PENDENTE'}
                        </span>
                        {!isHistoricalEncounter && (
                          <div className="duo-card-direct-actions" aria-label={`Ações da dupla ${g.nome}`}>
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => {
                                setEditingName(g.id);
                                setTempName(g.nome || '');
                              }}
                              aria-label={`Renomear dupla ${g.nome}`}
                              title="Renomear dupla"
                            >
                              <Edit2 size={17} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn text-danger"
                              onClick={() => handleDeleteGroup(g.id)}
                              disabled={isLoadingDeleteImpact}
                              aria-label={`Dissolver dupla ${g.nome}`}
                              title="Dissolver dupla"
                            >
                              {isLoadingDeleteImpact ? <Loader size={17} className="animate-spin" /> : <Trash2 size={17} />}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {editingName === g.id && (
                      <div className="duo-name-editor">
                        <label htmlFor={`duo-name-${g.id}`}>Nome da dupla</label>
                        <input
                          id={`duo-name-${g.id}`}
                          className="form-input"
                          value={tempName}
                          onChange={e => setTempName(e.target.value)}
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleRenameGroup();
                            if (e.key === 'Escape') setEditingName(null);
                          }}
                        />
                        <div className="duo-name-editor__actions">
                          <button type="button" onClick={() => setEditingName(null)} className="btn-secondary btn-sm">
                            Cancelar
                          </button>
                          <button type="button" onClick={handleRenameGroup} className="btn-primary btn-sm" disabled={!tempName.trim()}>
                            <Check size={16} /> Salvar
                          </button>
                        </div>
                      </div>
                    )}

                    <div style={{ marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.8rem' }}>
                        <span style={{ opacity: 0.7, fontWeight: 600 }}>Status da Dupla</span>
                        <span style={{ fontWeight: 800 }}>{Math.round(g.progresso)}%</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: 'var(--secondary-bg)', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${g.progresso}%`, height: '100%',
                          background: g.progresso === 100 ? '#10b981' : 'var(--primary-color)',
                          borderRadius: '99px', transition: 'width 0.5s ease'
                        }} />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                      <div style={{ background: 'var(--secondary-bg)', padding: '0.75rem', borderRadius: '10px', textAlign: 'center' }}>
                        <p style={{ margin: 0, fontSize: '0.65rem', opacity: 0.5, fontWeight: 700, textTransform: 'uppercase' }}>Visitados</p>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '1.1rem', fontWeight: 800, color: '#10b981' }}>{g.stats.realizadas}</p>
                      </div>
                      <div style={{ background: 'var(--secondary-bg)', padding: '0.75rem', borderRadius: '10px', textAlign: 'center' }}>
                        <p style={{ margin: 0, fontSize: '0.65rem', opacity: 0.5, fontWeight: 700, textTransform: 'uppercase' }}>Ausentes</p>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '1.1rem', fontWeight: 800, color: '#f59e0b' }}>{g.stats.ausentes}</p>
                      </div>
                      <div style={{ background: 'var(--secondary-bg)', padding: '0.75rem', borderRadius: '10px', textAlign: 'center' }}>
                        <p style={{ margin: 0, fontSize: '0.65rem', opacity: 0.5, fontWeight: 700, textTransform: 'uppercase' }}>Total</p>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '1.1rem', fontWeight: 800 }}>{g.stats.total}</p>
                      </div>
                    </div>
                  </div>
                  <div style={{
                    borderTop: '1px solid var(--border-color)', padding: '0.75rem 1.25rem',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'rgba(0,0,0,0.01)', gap: '0.5rem', flexWrap: 'wrap'
                  }}>
                    {g.stats.canceladas > 0 ? (
                      <button
                        onClick={() => setSelectedDuoForCanceled(g)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          color: '#ef4444',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {g.stats.canceladas} desistente(s)
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.75rem', opacity: 0.5, fontStyle: 'italic' }}>
                        Nenhuma desistência
                      </span>
                    )}
                    <button
                      onClick={() => setSelectedDuoForDetails(g)}
                      style={{
                        background: 'none', border: 'none', color: 'var(--primary-color)',
                        fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '4px'
                      }}
                    >
                      Ver Participantes <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* DUO DETAILS MODAL */}
          <Modal
            isOpen={!!selectedDuoForDetails}
            onClose={() => setSelectedDuoForDetails(null)}
            title={`Participantes: ${selectedDuoForDetails?.nome}`}
            maxWidth="800px"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {selectedDuoForDetails?.visitantes.map((v) => (
                  <div key={v.id} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    background: 'var(--primary-color)10', padding: '6px 12px',
                    borderRadius: '99px', fontSize: '0.85rem', color: 'var(--primary-color)',
                    fontWeight: 600
                  }}>
                    <Shield size={14} />
                    Visitante: {v.participacoes?.pessoas?.nome_completo}
                    {!isHistoricalEncounter && (
                      <button
                        type="button"
                        className="icon-btn"
                        title="Substituir visitante"
                        aria-label={`Substituir ${v.participacoes?.pessoas?.nome_completo || 'visitante'}`}
                        onClick={() => {
                          setReplacementParticipationId('');
                          setReplacementTarget({
                            grupoId: selectedDuoForDetails.id,
                            grupoNome: selectedDuoForDetails.nome || 'Dupla',
                            vinculoId: v.id,
                            visitanteNome: v.participacoes?.pessoas?.nome_completo || 'Visitante'
                          });
                          setSelectedDuoForDetails(null);
                        }}
                        style={{ marginLeft: '2px', padding: '2px' }}
                      >
                        <ArrowLeftRight size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {selectedDuoForDetails?.membrosVisita.length === 0 ? (
                  <p style={{ textAlign: 'center', opacity: 0.5, padding: '2rem' }}>Nenhum encontrista vinculado a esta dupla.</p>
                ) : (
                  selectedDuoForDetails?.membrosVisita.map((m) => (
                    <div key={m.id} className="card modal-participant-card" style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                        <div style={{ flex: 1 }}>
                          <h5 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{m.participacoes?.pessoas?.nome_completo}</h5>
                          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', opacity: 0.7, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MapPin size={12} /> {m.participacoes?.pessoas?.bairro}
                          </p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                          {getStatusBadge(m.status)}
                          {m.participacoes?.pessoas?.telefone && (
                            <a
                              href={`https://wa.me/55${m.participacoes.pessoas.telefone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                color: '#25D366', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 700
                              }}
                            >
                              <WhatsappLogo size={16} weight="fill" />
                              {formatPhone(m.participacoes.pessoas.telefone)}
                            </a>
                          )}
                        </div>
                      </div>
                      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {m.participacoes?.pessoas?.telefone_pai && (
                          <a
                            href={`https://wa.me/55${m.participacoes.pessoas.telefone_pai.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: '0.75rem', opacity: 0.8, color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <WhatsappLogo size={14} weight="fill" color="#25D366" />
                            Pai: {formatPhone(m.participacoes.pessoas.telefone_pai)}
                          </a>
                        )}
                        {m.participacoes?.pessoas?.telefone_mae && (
                          <a
                            href={`https://wa.me/55${m.participacoes.pessoas.telefone_mae.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: '0.75rem', opacity: 0.8, color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <WhatsappLogo size={14} weight="fill" color="#25D366" />
                            Mãe: {formatPhone(m.participacoes.pessoas.telefone_mae)}
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  onClick={() => {
                    if (!selectedDuoForDetails) return;
                    setSelectedGrupoId(selectedDuoForDetails.id);
                    setVincularSubTab('lista');
                    setActiveTab('vincular');
                    setSelectedDuoForDetails(null);
                  }}
                  className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Link2 size={18} /> {isHistoricalEncounter ? 'Ver Vínculos' : 'Gerenciar Vínculos'}
                </button>
              </div>
            </div>
          </Modal>

          <Modal
            isOpen={!!selectedDuoForCanceled}
            onClose={() => setSelectedDuoForCanceled(null)}
            title={`Desistentes: ${selectedDuoForCanceled?.nome}`}
            maxWidth="720px"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {selectedDuoForCanceled?.desistentes?.length === 0 ? (
                <p style={{ textAlign: 'center', opacity: 0.5, padding: '2rem' }}>Nenhuma desistência registrada para esta dupla.</p>
              ) : (
                selectedDuoForCanceled?.desistentes?.map((cancelado: ParticipacaoCancelada) => {
                  const pessoa = cancelado.pessoas;
                  const dataCancelamento = formatCancelamentoDate(cancelado.data_cancelamento);

                  return (
                    <div key={cancelado.id} className="card modal-participant-card" style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                        <div style={{ flex: 1 }}>
                          <h5 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{pessoa?.nome_completo || 'Nome não informado'}</h5>
                          {pessoa?.bairro && (
                            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', opacity: 0.7, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <MapPin size={12} /> {pessoa.bairro}
                            </p>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                          {getStatusBadge('cancelada')}
                          {pessoa?.telefone && (
                            <a
                              href={`https://wa.me/55${pessoa.telefone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                color: '#25D366', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 700
                              }}
                            >
                              <WhatsappLogo size={16} weight="fill" />
                              {formatPhone(pessoa.telefone)}
                            </a>
                          )}
                        </div>
                      </div>

                      {(cancelado.motivo_cancelamento || cancelado.observacoes || dataCancelamento) && (
                        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {cancelado.motivo_cancelamento && (
                            <div style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
                              <strong>Motivo:</strong> {cancelado.motivo_cancelamento}
                            </div>
                          )}
                          {cancelado.observacoes && (
                            <div style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
                              <strong>Observação:</strong> {cancelado.observacoes}
                            </div>
                          )}
                          {dataCancelamento && (
                            <span style={{ fontSize: '0.75rem', opacity: 0.65 }}>
                              Desistiu em {dataCancelamento}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Modal>

          <Modal
            isOpen={!!photoPreviewGroup}
            onClose={() => setPhotoPreviewGroup(null)}
            title={`Foto: ${photoPreviewGroup?.nome || 'Dupla'}`}
            maxWidth="720px"
          >
            {photoPreviewGroup?.foto_url && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <img
                  src={photoPreviewGroup.foto_url}
                  alt={`Foto da dupla ${photoPreviewGroup.nome}`}
                  style={{ width: '100%', maxHeight: '62vh', objectFit: 'contain', borderRadius: '12px', background: 'var(--secondary-bg)' }}
                />
                {!isHistoricalEncounter && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button type="button" className="btn-secondary" onClick={() => openGroupPhotoPicker(photoPreviewGroup)}>
                      <ImagePlus size={16} /> Trocar foto
                    </button>
                    <button type="button" className="btn-danger-solid" onClick={() => setPhotoDeleteTarget(photoPreviewGroup)}>
                      <Trash2 size={16} /> Excluir foto
                    </button>
                  </div>
                )}
              </div>
            )}
          </Modal>

          <Modal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            title="Nova Dupla de Visitação"
          >
            <div className="flex-col gap-6">
              <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.7 }}>
                Escolha dois membros da equipe de visitação para formar uma nova dupla.
              </p>

              <div className="form-group">
                <label className="form-label">Primeiro Visitante</label>
                <LiveSearchSelect<InscricaoEnriched>
                  value={selectedPessoa1}
                  onChange={(val) => setSelectedPessoa1(val)}
                  fetchData={async (search) => {
                    const q = normalizeString(search);
                    return visitantesDisponiveis
                      .filter(v => v.id !== selectedPessoa2)
                      .filter(v => normalizeString(v.pessoas?.nome_completo || '').includes(q));
                  }}
                  getOptionLabel={(p) => p.pessoas?.nome_completo || ''}
                  getOptionValue={(p) => p.id}
                  placeholder="Selecione o primeiro visitante..."
                  initialOptions={visitantesDisponiveis.filter(v => v.id !== selectedPessoa2)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Segundo Visitante</label>
                <LiveSearchSelect<InscricaoEnriched>
                  value={selectedPessoa2}
                  onChange={(val) => setSelectedPessoa2(val)}
                  fetchData={async (search) => {
                    const q = normalizeString(search);
                    return visitantesDisponiveis
                      .filter(v => v.id !== selectedPessoa1)
                      .filter(v => normalizeString(v.pessoas?.nome_completo || '').includes(q));
                  }}
                  getOptionLabel={(p) => p.pessoas?.nome_completo || ''}
                  getOptionValue={(p) => p.id}
                  placeholder="Selecione o segundo visitante..."
                  initialOptions={visitantesDisponiveis.filter(v => v.id !== selectedPessoa1)}
                />
              </div>

              <div className="form-actions" style={{ marginTop: '1rem', borderTop: 'none', paddingTop: 0 }}>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="btn-secondary"
                  disabled={isLoading}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateGroup}
                  disabled={isLoading || !selectedPessoa1 || !selectedPessoa2}
                  className="btn-primary"
                  style={{ minWidth: '140px' }}
                >
                  {isLoading ? <Loader className="animate-spin" /> : 'Criar Dupla'}
                </button>
              </div>
            </div>
          </Modal>

          <style>{`
                .duo-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(min(100%, 350px), 1fr));
                    gap: 1.25rem;
                }
                .filter-chip-modern {
                    padding: 0.5rem 1rem;
                    border-radius: 12px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    border: 1px solid var(--border-color);
                    background: var(--card-bg);
                    color: var(--text-color);
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .filter-chip-modern:hover {
                    border-color: var(--primary-color);
                    background: var(--primary-color)05;
                }
                .filter-chip-modern.active {
                    background: var(--primary-color);
                    color: white;
                    border-color: var(--primary-color);
                    box-shadow: 0 4px 12px rgba(var(--primary-rgb), 0.2);
                }
                .duo-monitor-card {
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    border: 1px solid var(--border-color);
                    min-width: 0;
                    overflow: hidden;
                }
                .duo-monitor-card * {
                    min-width: 0;
                }
                .duo-monitor-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 12px 24px rgba(0,0,0,0.08);
                    border-color: rgba(var(--primary-rgb), 0.2);
                }
                .duo-card-content {
                    padding: 1.25rem;
                    overflow: hidden;
                }
                .duo-card-header,
                .duo-card-main,
                .duo-card-meta {
                    display: flex;
                    align-items: flex-start;
                }
                .duo-card-header {
                    justify-content: space-between;
                    gap: 0.75rem;
                    margin-bottom: 1rem;
                }
                .duo-card-main {
                    align-items: center;
                    flex: 1;
                    gap: 0.75rem;
                }
                .duo-photo-button {
                    align-items: center;
                    background: var(--primary-color)15;
                    border: 1px solid transparent;
                    border-radius: 12px;
                    color: var(--primary-color);
                    cursor: pointer;
                    display: flex;
                    flex: 0 0 52px;
                    font-weight: 700;
                    height: 52px;
                    justify-content: center;
                    overflow: hidden;
                    padding: 0;
                    transition: border-color 0.2s ease, box-shadow 0.2s ease;
                    width: 52px;
                }
                .duo-photo-button:hover,
                .duo-photo-button:focus-visible {
                    border-color: var(--primary-color);
                    box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.14);
                }
                .duo-photo-button:disabled {
                    cursor: default;
                    opacity: 0.65;
                }
                .duo-card-identity {
                    flex: 1;
                    min-width: 0;
                }
                .duo-card-identity h4 {
                    font-size: 1rem;
                    font-weight: 700;
                    margin: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .duo-card-meta {
                    align-items: flex-end;
                    flex: 0 0 auto;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                .duo-card-direct-actions {
                    display: flex;
                    gap: 0.4rem;
                }
                .duo-card-direct-actions .icon-btn {
                    height: 40px;
                    width: 40px;
                }
                .duo-name-editor {
                    background: var(--secondary-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    display: grid;
                    gap: 0.65rem;
                    margin: -0.25rem 0 1.25rem;
                    padding: 0.85rem;
                }
                .duo-name-editor label {
                    font-size: 0.78rem;
                    font-weight: 700;
                }
                .duo-name-editor .form-input {
                    font-size: 0.95rem;
                    min-height: 44px;
                    width: 100%;
                }
                .duo-name-editor__actions {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    justify-content: flex-end;
                }
                .duo-name-editor__actions button {
                    align-items: center;
                    display: inline-flex;
                    justify-content: center;
                    min-height: 40px;
                }
                @media (max-width: 430px) {
                    .duo-card-content {
                        padding: 1rem;
                    }
                    .duo-name-editor__actions button {
                        flex: 1;
                    }
                }
                .modal-participant-card {
                    background: var(--card-bg);
                    border: 1px solid color-mix(in srgb, var(--border-color) 78%, var(--primary-color) 22%);
                    box-shadow: 0 8px 22px -14px rgba(15, 23, 42, 0.32), 0 2px 8px -4px rgba(15, 23, 42, 0.14);
                }
                .dark .modal-participant-card {
                    box-shadow: 0 10px 24px -12px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.02);
                }
            `}</style>
        </div>
      )}

      {activeTab === 'vincular' && (
        <div className="vincular-container">
          {/* Sidebar / Duo Selector */}
          <aside className={`vincular-sidebar ${isSidebarOpen ? 'open' : ''}`}>
            <div className="card" style={{ padding: '0.5rem', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={16} /> Duplas
                </h3>
                <button className="mobile-only icon-btn" onClick={() => setIsSidebarOpen(false)}>
                  <X size={18} />
                </button>
              </div>
              <div style={{ padding: '0.5rem', flex: 1, overflowY: 'auto', minHeight: 0 }}>
                {grupos.map(g => (
                  <div
                    key={g.id}
                    onClick={() => { setSelectedGrupoId(g.id); setSearchParticipant(''); setIsSidebarOpen(false); }}
                    className={`vincular-sidebar-item ${selectedGrupoId === g.id ? 'active' : ''}`}
                  >
                    <span className="sidebar-item-name">{g.nome}</span>
                    <span className="sidebar-item-count">
                      {vinculos.filter(v => v.grupo_id === g.id && !v.visitante).length}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* Main Content Area */}
          <div className="vincular-main">
            {/* Mobile Duo Selector Trigger */}
            <div className="mobile-only duo-selector-card card">
              <div>
                <span className="duo-selector-label">Dupla Selecionada</span>
                <p className="duo-selector-name">{currentGrupo?.nome || 'Nenhuma'}</p>
              </div>
              <button className="btn-secondary-sm" onClick={() => setIsSidebarOpen(true)}>
                Trocar Dupla
              </button>
            </div>

            <div className="card overflow-hidden">
              {/* Internal Sub-Tabs */}
              <div className="sub-tabs-container">
                <button
                  onClick={() => setVincularSubTab('lista')}
                  className={`sub-tab-btn ${vincularSubTab === 'lista' ? 'active' : ''}`}
                >
                  <List size={16} /> Lista
                </button>
                <button
                  onClick={() => setVincularSubTab('buscar')}
                  className={`sub-tab-btn ${vincularSubTab === 'buscar' ? 'active' : ''}`}
                >
                  <SearchIcon size={16} /> Buscar
                </button>
                <button
                  onClick={() => setVincularSubTab('mapa')}
                  className={`sub-tab-btn ${vincularSubTab === 'mapa' ? 'active' : ''}`}
                >
                  <MapPin size={16} /> Mapa
                </button>
                <div style={{ marginLeft: 'auto' }}>
                  <button
                    onClick={() => setIsSwapModalOpen(true)}
                    disabled={isHistoricalEncounter || grupos.length < 2}
                    title={isHistoricalEncounter ? 'Encontro encerrado' : 'Mover encontristas entre duplas'}
                    className="btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 1rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600 }}
                  >
                    <ArrowLeftRight size={16} /> Trocar entre Duplas
                  </button>
                </div>
              </div>

              <div className="vincular-scroll-content">
                {vincularSubTab === 'lista' && (
                  <div className="flex-col gap-6">
                    <div className="flex gap-4 items-center flex-wrap">
                      <div className="search-bar-container">
                        <div className="search-bar" style={{ flex: 1, marginBottom: 0, width: '100%' }}>
                          <SearchIcon size={18} style={{ opacity: 0.5 }} />
                          <input className="search-input" placeholder="Filtrar por nome..." value={listParticipantSearch} onChange={e => setListParticipantSearch(e.target.value)} />
                        </div>
                        {listParticipantSearch && (
                          <button className="btn-clear-input" onClick={() => setListParticipantSearch('')}>
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      <div className="search-bar-container">
                        <div className="search-bar" style={{ flex: 1, marginBottom: 0, width: '100%' }}>
                          <MapPin size={18} style={{ opacity: 0.5 }} />
                          <input className="search-input" placeholder="Filtrar por bairro..." value={neighborhoodFilter} onChange={e => setNeighborhoodFilter(e.target.value)} />
                        </div>
                        {neighborhoodFilter && (
                          <button className="btn-clear-input" onClick={() => setNeighborhoodFilter('')}>
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    <ParticipantFilterChips
                      value={participantFilterMode}
                      onChange={setParticipantFilterMode}
                      count={filteredParticipants.length}
                    />

                    <div className="link-cards-grid">
                      {filteredParticipants.map(p => {
                          const vinculo = vinculos.find(v => v.participacao_id === p.id && !v.visitante);
                          const mapsUrl = p.pessoas ? buildGoogleMapsStopUrl({ ...p.pessoas, id: p.id }) : null;
                          const isCurrentGroup = vinculo?.grupo_id === selectedGrupoId;
                          const isOtherGroup = Boolean(vinculo?.grupo_id && !isCurrentGroup);
                          return (
                            <div key={p.id} className={`participant-link-row ${isCurrentGroup ? 'selected' : ''} ${isOtherGroup ? 'busy' : ''}`}>
                              <div className="item-link-card-info" style={{ flex: 1 }}>
                                <h4 className="item-link-card-name">{p.pessoas?.nome_completo}</h4>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <span className="item-link-card-address">
                                    {p.pessoas?.endereco}{p.pessoas?.numero ? `, ${p.pessoas.numero}` : ''} - {p.pessoas?.bairro || 'Sem Bairro'}
                                  </span>
                                  <a
                                    href={mapsUrl || undefined}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover-opacity"
                                    title="Abrir no Google Maps"
                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none' }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink size={12} /> Ver no Mapa
                                  </a>
                                </div>
                              </div>

                              <span className={`participant-link-status ${isCurrentGroup ? 'current' : isOtherGroup ? 'busy' : 'available'}`}>
                                {isCurrentGroup
                                  ? currentGrupo?.nome || 'Dupla selecionada'
                                  : isOtherGroup
                                    ? vinculo?.visita_grupos?.nome || 'Outra dupla'
                                    : 'Disponível'}
                              </span>
                              <div className="item-link-card-actions">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleEditAddress(p); }}
                                  disabled={isHistoricalEncounter}
                                  className="participant-row-action"
                                  title={isHistoricalEncounter ? 'Encontro encerrado' : 'Editar Endereço'}
                                >
                                  <Edit2 size={16} /> <span>Editar</span>
                                </button>
                                {!vinculo?.grupo_id ? (
                                  <button
                                    onClick={() => handleVincular(p.id)}
                                    disabled={isLoading || !selectedGrupoId || isHistoricalEncounter}
                                    className="participant-row-action primary"
                                    title={selectedGrupoId ? 'Vincular' : 'Selecione uma Dupla'}
                                  >
                                    <Link2 size={16} /> <span>Vincular</span>
                                  </button>
                                ) : (
                                  vinculo.grupo_id === selectedGrupoId ? (
                                    <button
                                      onClick={() => handleDesvincular(vinculo.id)}
                                      disabled={isLoading || isHistoricalEncounter}
                                      className="participant-row-action danger"
                                      title="Desvincular"
                                    >
                                      <Link2OffIcon size={16} /> <span>Desvincular</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => setMoveParticipantTarget({
                                        vinculoId: vinculo.id,
                                        pessoaNome: p.pessoas?.nome_completo || 'Encontrista',
                                        sourceGrupoId: vinculo.grupo_id!,
                                        sourceGrupoNome: vinculo.visita_grupos?.nome || 'Outra dupla',
                                      })}
                                      disabled={isLoading || !selectedGrupoId || isHistoricalEncounter}
                                      className="participant-row-action primary"
                                      title="Alterar para a dupla selecionada"
                                    >
                                      <ArrowLeftRight size={16} /> <span>Alterar dupla</span>
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                          );
                        })
                      }
                    </div>
                  </div>
                )}

                {vincularSubTab === 'buscar' && (
                  <div className="flex-col gap-6">
                    <div className="participant-search-panel">
                      <div className="participant-search-heading">
                        <div>
                          <strong>Buscar encontrista</strong>
                          <span>Nome, e-mail ou telefone</span>
                        </div>
                        <span>Dupla: <strong>{currentGrupo?.nome}</strong></span>
                      </div>
                      <div className="search-bar-container" style={{ width: '100%' }}>
                        <div className="search-bar" style={{ width: '100%', marginBottom: 0 }}>
                          <SearchIcon size={18} />
                          <input
                            autoFocus
                            className="search-input"
                            placeholder="Digite nome, e-mail ou telefone..."
                            value={searchParticipant}
                            onChange={e => setSearchParticipant(e.target.value)}
                          />
                        </div>
                        {searchParticipant && (
                          <button className="btn-clear-input" onClick={() => setSearchParticipant('')}>
                            <X size={20} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="link-cards-grid">
                      {!searchParticipant.trim() && (
                        <div className="empty-state compact">
                          <SearchIcon size={24} />
                          <span>Digite para localizar um encontrista.</span>
                        </div>
                      )}
                      {searchParticipant.trim() && searchResults.length === 0 && (
                        <div className="empty-state compact">
                          <SearchIcon size={24} />
                          <span>Nenhum encontrista encontrado.</span>
                        </div>
                      )}
                      {searchResults
                        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
                        .map(item => (
                          <div key={item.id} className={`participant-link-row ${item.status === 'in_this_group' ? 'selected' : ''} ${item.status === 'in_other_group' ? 'busy' : ''}`}>
                            <div className="item-link-card-info" style={{ flex: 1 }}>
                              <span className="item-link-card-name">{item.nome}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <span className="item-link-card-address" style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                                  {(() => {
                                    const p = participantes.find(p => p.id === item.id);
                                    return p ? `${p.pessoas?.endereco || ''}${p.pessoas?.numero ? `, ${p.pessoas.numero}` : ''}${p.pessoas?.bairro ? ` - ${p.pessoas.bairro}` : ''}` : '';
                                  })()}
                                </span>
                                {(() => {
                                  const p = participantes.find(p => p.id === item.id);
                                  if (!p?.pessoas?.endereco) return null;
                                  const mapsUrl = buildGoogleMapsStopUrl({ ...p.pessoas, id: p.id });
                                  return (
                                    <a
                                      href={mapsUrl || undefined}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary hover-opacity"
                                      title="Abrir no Google Maps"
                                      style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', fontWeight: 600, textDecoration: 'none' }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <ExternalLink size={12} /> Maps
                                    </a>
                                  );
                                })()}
                              </div>
                            </div>
                            <span className={`participant-link-status ${item.status === 'in_this_group' ? 'current' : item.status === 'in_other_group' ? 'busy' : 'available'}`}>
                              {item.status === 'in_this_group'
                                ? item.grupoNome
                                : item.status === 'in_other_group'
                                  ? item.grupoNome
                                  : 'Disponível'}
                            </span>
                            <div className="item-link-card-actions">
                              {(() => {
                                const p = participantes.find(p => p.id === item.id);
                                return p && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleEditAddress(p); }}
                                    disabled={isHistoricalEncounter}
                                    className="participant-row-action"
                                    title={isHistoricalEncounter ? 'Encontro encerrado' : 'Editar Endereço'}
                                  >
                                    <Edit2 size={16} /> <span>Editar</span>
                                  </button>
                                );
                              })()}
                              {item.status === 'available' && (
                                <button onClick={() => handleVincular(item.id)} disabled={isLoading || !selectedGrupoId || isHistoricalEncounter} className="participant-row-action primary">
                                  <Link2 size={16} /> <span>Vincular</span>
                                </button>
                              )}
                              {item.status === 'in_this_group' && item.vinculoId && (
                                <button onClick={() => handleDesvincular(item.vinculoId!)} disabled={isLoading || isHistoricalEncounter} className="participant-row-action danger">
                                  <Link2OffIcon size={16} /> <span>Desvincular</span>
                                </button>
                              )}
                              {item.status === 'in_other_group' && item.vinculoId && item.grupoId && (
                                <button
                                  onClick={() => setMoveParticipantTarget({
                                    vinculoId: item.vinculoId!,
                                    pessoaNome: item.nome || 'Encontrista',
                                    sourceGrupoId: item.grupoId!,
                                    sourceGrupoNome: item.grupoNome || 'Outra dupla',
                                  })}
                                  disabled={isLoading || !selectedGrupoId || isHistoricalEncounter}
                                  className="participant-row-action primary"
                                  title="Alterar para a dupla selecionada"
                                >
                                  <ArrowLeftRight size={16} /> <span>Alterar dupla</span>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {vincularSubTab === 'mapa' && (
                  <EncontristaMap
                    participantes={participantes}
                    vinculos={vinculos}
                    selectedGrupoId={selectedGrupoId}
                    onVincular={handleVincular}
                    onDesvincular={handleDesvincular}
                    onEditAddress={isHistoricalEncounter ? undefined : handleEditAddress}
                    readOnly={isHistoricalEncounter}
                    onRefresh={loadData}
                    onShowUnmappedClick={() => {
                      setParticipantFilterMode('unmapped');
                      setVincularSubTab('lista');
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!pendingRename}
        title="Confirmar alteração do nome"
        message={pendingRename && (
          <div>
            <p style={{ marginTop: 0 }}>
              Alterar <strong>{pendingRename.oldName || 'Dupla sem nome'}</strong> para{' '}
              <strong>{pendingRename.newName}</strong>?
            </p>
            <p style={{ marginBottom: 0, fontSize: '0.9rem', opacity: 0.75 }}>
              O novo nome será exibido na Visitação, Secretaria, Recepção, Compras,
              Ligação, presenças e etiquetas. Ele será considerado personalizado.
            </p>
          </div>
        )}
        confirmText="Alterar nome"
        onConfirm={confirmRenameGroup}
        onCancel={() => setPendingRename(null)}
        isLoading={isLoading}
      />

      <ConfirmDialog
        isOpen={!!photoDeleteTarget}
        title="Excluir foto da dupla?"
        message={photoDeleteTarget && (
          <p style={{ margin: 0 }}>
            A foto da dupla <strong>{photoDeleteTarget.nome || 'sem nome'}</strong> será removida.
          </p>
        )}
        confirmText="Excluir foto"
        onConfirm={handleDeleteGroupPhoto}
        onCancel={() => setPhotoDeleteTarget(null)}
        isLoading={uploadingGroupId === photoDeleteTarget?.id}
        isDestructive
      />

      <ConfirmDialog
        isOpen={!!moveParticipantTarget}
        title="Alterar dupla?"
        message={moveParticipantTarget && (
          <p style={{ margin: 0 }}>
            Alterar <strong>{moveParticipantTarget.pessoaNome}</strong> da dupla{' '}
            <strong>{moveParticipantTarget.sourceGrupoNome}</strong> para{' '}
            <strong>{currentGrupo?.nome || 'a dupla selecionada'}</strong>?
          </p>
        )}
        confirmText="Alterar dupla"
        onConfirm={confirmMoveParticipant}
        onCancel={() => setMoveParticipantTarget(null)}
        isLoading={isLoading}
      />

      <Modal
        isOpen={!!replacementTarget}
        onClose={() => {
          if (isLoading) return;
          setReplacementTarget(null);
          setReplacementParticipationId('');
        }}
        title="Substituir visitante"
        maxWidth="560px"
      >
        <div className="flex-col gap-4">
          <p style={{ margin: 0 }}>
            Substituir <strong>{replacementTarget?.visitanteNome}</strong> na dupla{' '}
            <strong>{replacementTarget?.grupoNome}</strong>.
          </p>

          <div className="form-group">
            <label className="form-label">Novo visitante</label>
            <LiveSearchSelect<InscricaoEnriched>
              value={replacementParticipationId}
              onChange={setReplacementParticipationId}
              fetchData={async (search) => {
                const query = normalizeString(search);
                return visitantesDisponiveis.filter(item =>
                  normalizeString(item.pessoas?.nome_completo || '').includes(query)
                );
              }}
              getOptionLabel={item => item.pessoas?.nome_completo || ''}
              getOptionValue={item => item.id}
              placeholder="Selecione o substituto..."
              initialOptions={visitantesDisponiveis}
            />
          </div>

          {replacementCandidate && (
            <div className="card" style={{ padding: '1rem', background: 'var(--warning-bg, rgba(245, 158, 11, 0.08))' }}>
              <strong>Novo nome: {replacementGeneratedName}</strong>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', opacity: 0.78 }}>
                {replacementTarget?.visitanteNome} perderá o acesso aos participantes desta dupla e{' '}
                {replacementCandidate.pessoas?.nome_completo} passará a ter acesso. Um nome personalizado
                anteriormente será substituído pelo nome gerado acima.
              </p>
            </div>
          )}

          <div className="form-actions" style={{ borderTop: 'none', paddingTop: 0 }}>
            <button
              type="button"
              className="btn-secondary"
              disabled={isLoading}
              onClick={() => {
                setReplacementTarget(null);
                setReplacementParticipationId('');
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={isLoading || !replacementParticipationId}
              onClick={confirmVisitorReplacement}
            >
              {isLoading ? <Loader size={18} className="animate-spin" /> : 'Confirmar substituição'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!deleteImpact}
        onClose={() => {
          if (isLoading) return;
          setDeleteImpact(null);
          setDeleteConfirmation('');
        }}
        title="Dissolver dupla de visitação"
        maxWidth="620px"
      >
        {deleteImpact && (
          <div className="flex-col gap-4">
            <div className="card" style={{ padding: '1rem', borderColor: 'rgba(239, 68, 68, 0.45)' }}>
              <strong>{deleteImpact.nome || 'Dupla sem nome'}</strong>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.88rem', opacity: 0.78 }}>
                A dupla será excluída, mas o histórico dos encontristas será preservado.
              </p>
            </div>

            <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.75 }}>
              <li>
                {deleteImpact.visitantes_total} visitante(s) serão liberados
                {deleteImpact.visitantes.length > 0
                  ? `: ${deleteImpact.visitantes.map(item => item.nome).join(', ')}`
                  : ''}.
              </li>
              <li>{deleteImpact.encontristas_total} encontrista(s) ficarão pendentes de nova dupla.</li>
              {deleteImpact.realizadas_total > 0 && <li>{deleteImpact.realizadas_total} visita(s) realizada(s) serão preservadas.</li>}
              {deleteImpact.ausentes_total > 0 && <li>{deleteImpact.ausentes_total} ausência(s) serão preservadas.</li>}
              {deleteImpact.fotos_familia_total > 0 && <li>{deleteImpact.fotos_familia_total} foto(s) de família serão preservadas.</li>}
              {deleteImpact.intencoes_camiseta_total > 0 && <li>{deleteImpact.intencoes_camiseta_total} intenção(ões) de camiseta serão preservadas.</li>}
              {deleteImpact.presencas_total > 0 && <li>{deleteImpact.presencas_total} presença(s) deixarão de apontar para esta dupla.</li>}
              {deleteImpact.desistentes_total > 0 && <li>{deleteImpact.desistentes_total} desistente(s) perderão a referência da dupla original.</li>}
              {deleteImpact.foto_url && <li>A foto própria da dupla será removida.</li>}
            </ul>

            {deleteHasOperationalImpact && (
              <div className="form-group">
                <label className="form-label" htmlFor="delete-duo-confirmation">
                  Para confirmar, digite exatamente <strong>{deleteConfirmationPhrase}</strong>
                </label>
                <input
                  id="delete-duo-confirmation"
                  className="form-input"
                  value={deleteConfirmation}
                  onChange={event => setDeleteConfirmation(event.target.value)}
                  autoComplete="off"
                />
              </div>
            )}

            <div className="form-actions" style={{ borderTop: 'none', paddingTop: 0 }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={isLoading}
                onClick={() => {
                  setDeleteImpact(null);
                  setDeleteConfirmation('');
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-danger-solid"
                disabled={isLoading || (deleteHasOperationalImpact && deleteConfirmation.trim() !== deleteConfirmationPhrase)}
                onClick={confirmDeleteGroup}
              >
                {isLoading ? <Loader size={18} className="animate-spin" /> : 'Dissolver dupla'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal de Edição de Endereço ── */}
      <Modal
        isOpen={!!editingAddressPessoa}
        onClose={() => !isLoading && setEditingAddressPessoa(null)}
        title={`Editar Endereço: ${editingAddressPessoa?.pessoas?.nome_completo}`}
        maxWidth="600px"
      >
        <div className="flex-col gap-4">
          <FormRow>
            <FormField
              label="Rua / Logradouro"
              value={addressForm.endereco}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleAddressFieldChange('endereco', e.target.value)}
              placeholder="Ex: Rua Major Claudiano"
              colSpan={9}
              required
            />
            <FormField
              label="Número"
              value={addressForm.numero}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleAddressFieldChange('numero', e.target.value)}
              placeholder="Ex: 123"
              colSpan={3}
            />
          </FormRow>

          <FormRow>
            <FormField
              label="Complemento"
              value={addressForm.complemento}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleAddressFieldChange('complemento', e.target.value)}
              placeholder="Ex: Apt 12, Bloco B, Chácara Sto Antonio..."
              colSpan={12}
            />
          </FormRow>

          <FormRow>
            <FormField
              label="Bairro"
              value={addressForm.bairro}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleAddressFieldChange('bairro', e.target.value)}
              placeholder="Ex: Centro"
              colSpan={6}
            />
            <FormField
              label="CEP"
              value={addressForm.cep}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleAddressFieldChange('cep', formatCEP(e.target.value))}
              onBlur={handleCEPBlur}
              placeholder="Ex: 14400-000"
              maxLength={9}
              colSpan={6}
            />
          </FormRow>

          <FormRow>
            <FormField
              label="Cidade"
              value={addressForm.cidade}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleAddressFieldChange('cidade', e.target.value)}
              colSpan={9}
            />
            <FormField
              label="Estado"
              value={addressForm.estado}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleAddressFieldChange('estado', e.target.value.toUpperCase())}
              maxLength={2}
              colSpan={3}
            />
          </FormRow>

          <AddressGeolocationControls
            address={addressForm}
            value={addressForm}
            onChange={(geolocation) => setAddressForm(prev => ({ ...prev, ...geolocation }))}
            disabled={isLoading}
          />

          <div className="form-actions" style={{ marginTop: '1rem', borderTop: 'none', paddingTop: 0 }}>
            <button
              onClick={() => setEditingAddressPessoa(null)}
              className="btn-secondary"
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveAddress}
              disabled={isLoading || !hasRegionalAddress(addressForm)}
              className="btn-primary"
              style={{ minWidth: '140px' }}
            >
              {isLoading ? <Loader size={18} className="animate-spin" /> : 'Salvar endereço'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal de Troca entre Duplas ── */}
      <TrocaDuplasModal
        isOpen={isSwapModalOpen}
        onClose={() => setIsSwapModalOpen(false)}
        grupos={grupos}
        vinculos={vinculos}
        onSuccess={loadData}
      />
      <MobileFileUploadButton
        triggerRef={photoPickerTriggerRef}
        className="duo-photo-upload-trigger"
        hideTrigger
        label={photoTargetGroup?.foto_url ? 'Trocar foto da dupla' : 'Adicionar foto da dupla'}
        sheetDescription="Escolha se deseja tirar uma foto agora ou selecionar uma imagem existente."
        galleryLabel="Escolher da galeria"
        multiple={false}
        accept="image/*"
        disabled={isHistoricalEncounter}
        onFiles={handleGroupPhotoSelected}
      />
    </>
  );
}
