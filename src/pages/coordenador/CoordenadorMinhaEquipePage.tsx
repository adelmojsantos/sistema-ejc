import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AlertCircle,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  Loader,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Shield,
  Users,
  X,
  UserX,
  Upload,
  Eye,
  Shirt as ShirtIcon,
  Baby,
  Car,
  ClipboardCheck,
  Copy,
  QrCode,
  LayoutGrid,
  ArrowRight,
  ExternalLink,
  KeyRound,
  Camera
} from 'lucide-react';
import { RecepcaoDadosModal } from '../../components/coordenador/RecepcaoDadosModal';
import { RecreacaoDadosModal } from '../../components/coordenador/RecreacaoDadosModal';
import { BulkShirtOrderModal } from '../../components/coordenador/BulkShirtOrderModal';
import { TeamShirtSummaryModal } from '../../components/coordenador/TeamShirtSummaryModal';
import { TeamTaxaSummaryModal } from '../../components/coordenador/TeamTaxaSummaryModal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PesquisaSatisfacaoShareModal } from '../../components/pesquisa/PesquisaSatisfacaoShareModal';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { equipeService } from '../../services/equipeService';
import type { InscricaoEnriched } from '../../types/inscricao';
import type { Equipe } from '../../types/equipe';
import { useEncontros } from '../../contexts/EncontroContext';
import { PessoaForm } from '../../components/pessoa/PessoaForm';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { camisetaService } from '../../services/camisetaService';
import { pesquisaSatisfacaoService } from '../../services/pesquisaSatisfacaoService';
import type { PesquisaSatisfacaoStatus } from '../../types/pesquisaSatisfacao';
import { exportConfigService } from '../../services/exportConfigService';
import { inscricaoService } from '../../services/inscricaoService';
import { pessoaService } from '../../services/pessoaService';
import { validatePessoaForConfirmation } from '../../utils/pessoaValidation';
import type { CamisetaModelo, CamisetaPedido, CamisetaTamanho } from '../../types/camiseta';
import type { Pessoa, PessoaFormData } from '../../types/pessoa';
import type { RecepcaoDados } from '../../types/recepcao';
import type { RecreacaoDados } from '../../types/recreacao';
import { formatBRL } from '../../utils/currencyUtils';
import { formatChildAge } from '../../utils/ageUtils';
import { PixPaymentInfo } from '../../components/financeiro/PixPaymentInfo';
import { PaymentProofGalleryModal } from '../../components/compras/PaymentProofGalleryModal';
import { EquipeMapaModal } from '../../components/coordenador/EquipeMapaModal';
import { Modal } from '../../components/ui/Modal';
import { GroupedDropdown } from '../../components/ui/GroupedDropdown';
import { EncontreiroFotoModal, type EncontreiroFotoTarget } from '../../components/coordenador/EncontreiroFotoModal';
import './CoordenadorMinhaEquipePage.css';
import { getInitials } from '../../components/equipe/teamMemberCard';
import '../../components/equipe/TeamMemberCard.css';
import { Minus, Plus } from 'phosphor-react';
import { buildPublicFormUrl } from '../../utils/publicFormUrl';

interface EquipeMember {
  id: string;
  pessoa_id: string;
  coordenador: boolean;
  participante: boolean;
  dados_confirmados: boolean;
  pago_taxa: boolean;
  pago_camiseta: boolean;
  foto_url: string | null;
  foto_posicao_y: number | null;
  pessoas: Pessoa;
  recepcao_dados: RecepcaoDados | null;
  recreacao_dados: RecreacaoDados[];
  recreacao_dados_secundario?: RecreacaoDados[];
}

type PixTipo = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';
type EquipeAcesso = 'verde' | 'amarela' | 'vermelha';

interface CamisetaTeamSummary {
  modelo_id: string;
  modelo_nome: string;
  tamanhos: Record<string, number>;
  total: number;
  valor_unitario: number;
  valor_total: number;
}

interface UserParticipacaoEquipe {
  nome?: string | null;
  acesso_plenario?: EquipeAcesso | null;
}

function formatTelefone(tel: string | null | undefined) {
  if (!tel) return '—';
  const d = tel.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel;
}

function isPixTipo(value: string | null | undefined): value is PixTipo {
  return value === 'cpf' || value === 'cnpj' || value === 'email' || value === 'telefone' || value === 'aleatoria';
}

export function CoordenadorMinhaEquipePage() {
  const { user, userParticipacao: ownParticipacao, hasPermission, hasExactPermission } = useAuth();
  const { encontroAtivo } = useEncontros();

  // Suporte: desenvolvedores escolhem a equipe do encontro ativo.
  // A autorização de leitura e escrita continua no banco (RLS/RPCs).
  const isDeveloper = hasExactPermission('modulo_diagnosticos');
  const [devEquipes, setDevEquipes] = useState<Equipe[]>([]);
  const [devEquipeId, setDevEquipeId] = useState('');

  useEffect(() => {
    if (!isDeveloper) return;
    let cancelled = false;
    equipeService.listar()
      .then(equipes => {
        if (cancelled) return;
        setDevEquipes(equipes);
        setDevEquipeId(current => current || ownParticipacao?.equipe_id || equipes[0]?.id || '');
      })
      .catch(() => toast.error('Não foi possível carregar as equipes.'));
    return () => { cancelled = true; };
  }, [isDeveloper, ownParticipacao?.equipe_id]);

  const devEquipe = devEquipes.find(equipe => equipe.id === devEquipeId) ?? null;

  const userParticipacao = useMemo<InscricaoEnriched | null>(() => {
    if (!isDeveloper || !devEquipe || !encontroAtivo) return ownParticipacao;
    if (ownParticipacao?.equipe_id === devEquipe.id && ownParticipacao.encontro_id === encontroAtivo.id) {
      return ownParticipacao;
    }
    // Visualização de outra equipe: sem papel de coordenador (oculta ações exclusivas).
    return {
      id: ownParticipacao?.id ?? '',
      pessoa_id: ownParticipacao?.pessoa_id ?? '',
      encontro_id: encontroAtivo.id,
      data_inscricao: null,
      participante: false,
      equipe_id: devEquipe.id,
      coordenador: false,
      dados_confirmados: null,
      confirmado_em: null,
      pago_taxa: null,
      equipes: { nome: devEquipe.nome },
    };
  }, [isDeveloper, devEquipe, encontroAtivo, ownParticipacao]);
  const navigate = useNavigate();
  const [members, setMembers] = useState<EquipeMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [equipeNome, setEquipeNome] = useState('');
  const [equipeAcesso, setEquipeAcesso] = useState<EquipeAcesso>('verde');
  const [liberaAcessoIntegrantes, setLiberaAcessoIntegrantes] = useState(false);
  const [editingPessoa, setEditingPessoa] = useState<Pessoa | null>(null);
  const [isLoadingPessoaEdit, setIsLoadingPessoaEdit] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EquipeMember | null>(null);
  const [fotoTarget, setFotoTarget] = useState<EncontreiroFotoTarget | null>(null);
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [shirtModalMemberId, setShirtModalMemberId] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [teamConfirmation, setTeamConfirmation] = useState<{ confirmado_por: string; confirmado_em: string; profiles?: { email?: string } | null } | null>(null);
  const [valorTaxa, setValorTaxa] = useState(0);
  const [pedidosCamisetas, setPedidosCamisetas] = useState<CamisetaPedido[]>([]);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [addingShirtToMemberId, setAddingShirtToMemberId] = useState<string | null>(null);
  const [modelosCamiseta, setModelosCamiseta] = useState<CamisetaModelo[]>([]);
  const [tamanhosCamiseta, setTamanhosCamiseta] = useState<CamisetaTamanho[]>([]);
  const [newShirtData, setNewShirtData] = useState({ modelo_id: '', tamanho: 'G', quantidade: 1 });
  const [isExporting, setIsExporting] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'confirmed' | 'pending' | 'noPhoto'>('all');
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [isFinalizingTeam, setIsFinalizingTeam] = useState(false);
  const [isUploadingProof, setIsUploadingProof] = useState<string | null>(null); // 'taxas' | 'camisetas' | null
  const [comprovanteUrl, setComprovanteUrl] = useState<string | null>(null);
  const [comprovantesTaxasUrls, setComprovantesTaxasUrls] = useState<string[]>([]);
  const [showBulkShirtModal, setShowBulkShirtModal] = useState(false);
  const [showShirtSummaryModal, setShowShirtSummaryModal] = useState(false);
  const [showTaxaSummaryModal, setShowTaxaSummaryModal] = useState(false);
  const [showTeamMapModal, setShowTeamMapModal] = useState(false);
  const [comprovanteCamisetasUrl, setComprovanteCamisetasUrl] = useState<string | null>(null);
  const [comprovantesCamisetasUrls, setComprovantesCamisetasUrls] = useState<string[]>([]);
  const [proofGallery, setProofGallery] = useState<{ title: string; tipo: 'taxas' | 'camisetas'; urls: string[] } | null>(null);
  const [pixTaxa, setPixTaxa] = useState<{
    chave: string | null;
    tipo: PixTipo | null;
    qrCodeUrl: string | null;
  }>({ chave: null, tipo: null, qrCodeUrl: null });

  const teamShirtSummary = useMemo(() => {
    const memberIds = new Set(members.map(m => m.id));
    const teamPedidos = pedidosCamisetas.filter(p => memberIds.has(p.participacao_id));
    
    const summaryMap = new Map<string, CamisetaTeamSummary>();
    
    teamPedidos.forEach(p => {
      const modId = p.modelo_id;
      if (!summaryMap.has(modId)) {
        const modeloEncontro = modelosCamiseta.find(m => m.id === modId);
        summaryMap.set(modId, {
          modelo_id: modId,
          modelo_nome: p.camiseta_modelos?.nome || 'Desconhecido',
          tamanhos: {},
          total: 0,
          valor_unitario: modeloEncontro?.valor || 0,
          valor_total: 0
        });
      }
      
      const modSummary = summaryMap.get(modId)!;
      const tam = p.tamanho;
      modSummary.tamanhos[tam] = (modSummary.tamanhos[tam] || 0) + (p.quantidade || 1);
      modSummary.total += (p.quantidade || 1);
      const modeloEncontro = modelosCamiseta.find(m => m.id === modId);
      modSummary.valor_total += (modeloEncontro?.valor || 0) * (p.quantidade || 1);
    });
    
    return Array.from(summaryMap.values());
  }, [members, modelosCamiseta, pedidosCamisetas]);

  const [pixCamisetas, setPixCamisetas] = useState<{
    chave: string | null;
    tipo: PixTipo | null;
    qrCodeUrl: string | null;
  }>({ chave: null, tipo: null, qrCodeUrl: null });

  const [recepcaoParticipacaoId, setRecepcaoParticipacaoId] = useState<string | null>(null);
  const [recepcaoParticipanteNome, setRecepcaoParticipanteNome] = useState('');
  const [recreacaoParticipacaoId, setRecreacaoParticipacaoId] = useState<string | null>(null);
  const [recreacaoParticipanteNome, setRecreacaoParticipanteNome] = useState('');
  const [avaliacaoResumo, setAvaliacaoResumo] = useState<{
    totalPerguntas: number;
    status: PesquisaSatisfacaoStatus;
    enviadoEm: string | null;
    liberada: boolean;
    publicada: boolean;
    totalParticipantes: number;
    totalEnviados: number;
  } | null>(null);
  const [isLoadingAvaliacao, setIsLoadingAvaliacao] = useState(false);
  const [isPesquisaShareOpen, setIsPesquisaShareOpen] = useState(false);
  const [publicFormPublished, setPublicFormPublished] = useState(false);
  const [publicFormLinkCopied, setPublicFormLinkCopied] = useState(false);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 768;
  const isAdmin = hasPermission('modulo_admin');
  // UX apenas: a autorização definitiva fica na RPC definir_foto_encontreiro.
  const canManagePhotos = isAdmin
    || hasPermission('modulo_secretaria')
    || hasPermission('modulo_cadastros')
    || Boolean(userParticipacao?.coordenador);
  const pesquisaPublicLink = useMemo(() => {
    if (!userParticipacao?.encontro_id) return '';
    return `${window.location.origin}/pesquisa-satisfacao?encontro=${userParticipacao.encontro_id}`;
  }, [userParticipacao?.encontro_id]);

  const loadAvaliacao = useCallback(async () => {
    if (!userParticipacao?.encontro_id || !userParticipacao?.equipe_id || !userParticipacao.coordenador) {
      setAvaliacaoResumo(null);
      return;
    }

    setIsLoadingAvaliacao(true);
    try {
      const [envio, resumoEquipe, perguntas, config] = await Promise.all([
        pesquisaSatisfacaoService.obterEnvioPorParticipacao(userParticipacao.encontro_id, userParticipacao.id),
        pesquisaSatisfacaoService.listarResumoEquipe(userParticipacao.encontro_id, userParticipacao.equipe_id),
        pesquisaSatisfacaoService.listarPerguntas(userParticipacao.encontro_id),
        pesquisaSatisfacaoService.obterConfig(userParticipacao.encontro_id),
      ]);

      const liberada = isAdmin || config.publicada;

      setAvaliacaoResumo({
        totalPerguntas: perguntas.length,
        status: envio?.status ?? 'pendente',
        enviadoEm: envio?.enviado_em ?? null,
        liberada,
        publicada: config.publicada,
        totalParticipantes: resumoEquipe.totalParticipantes,
        totalEnviados: resumoEquipe.totalEnviados,
      });
    } catch (error) {
      console.error('Erro ao carregar avaliação:', error);
      toast.error('Erro ao carregar avaliação do encontro.');
    } finally {
      setIsLoadingAvaliacao(false);
    }
  }, [isAdmin, userParticipacao?.coordenador, userParticipacao?.encontro_id, userParticipacao?.equipe_id, userParticipacao?.id]);

  const loadPedidos = useCallback(async () => {
    if (!userParticipacao?.encontro_id) return;
    try {
      const [pedidos, modelosRaw, tamanhos] = await Promise.all([
        camisetaService.listarPedidosPorEncontro(userParticipacao.encontro_id),
        camisetaService.listarModelos(userParticipacao.encontro_id),
        camisetaService.listarTamanhos()
      ]);
      // Filtra apenas os modelos que estão ativos especificamente para este encontro
      const modelos = modelosRaw.filter((m) => m.esta_ativo_no_encontro !== false);
      setPedidosCamisetas(pedidos);
      setModelosCamiseta(modelos);
      setTamanhosCamiseta(tamanhos);
      if (modelos.length > 0) {
        const availableSizes = tamanhos.filter(t => !t.modelo_id || t.modelo_id === modelos[0].id);
        const defaultSize = availableSizes.length > 0 ? availableSizes[0].sigla : '';
        setNewShirtData(prev => ({ ...prev, modelo_id: modelos[0].id, tamanho: defaultSize }));
      }
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
    }
  }, [userParticipacao?.encontro_id]);

  const loadMembers = useCallback(async () => {
    if (!userParticipacao) {
      setPublicFormPublished(false);
      setLoading(false);
      return;
    }

    try {
      if (userParticipacao.equipes?.nome) {
        setEquipeNome(userParticipacao.equipes.nome);
        const equipeParticipacao = userParticipacao.equipes as UserParticipacaoEquipe;
        const precisaEquipeCompleta = !equipeParticipacao.acesso_plenario || Boolean(userParticipacao.coordenador);
        const equipeFull = precisaEquipeCompleta && userParticipacao.equipe_id
          ? await equipeService.buscarPorId(userParticipacao.equipe_id)
          : null;
        const acessoPlenario = equipeParticipacao.acesso_plenario ?? equipeFull?.acesso_plenario;
        if (acessoPlenario) {
          setEquipeAcesso(acessoPlenario);
        }
        setLiberaAcessoIntegrantes(Boolean(userParticipacao.coordenador) && equipeFull?.libera_acesso_integrantes === true);
      }

      if (userParticipacao?.encontro_id && userParticipacao?.equipe_id) {
        const conf = await equipeService.obterConfirmacao(userParticipacao.equipe_id, userParticipacao.encontro_id);
        if (conf) {
          setTeamConfirmation(conf);
          const taxasUrls = equipeService.normalizeComprovantes(conf.comprovante_taxas_url, conf.comprovantes_taxas_urls);
          const camisetasUrls = equipeService.normalizeComprovantes(conf.comprovante_camisetas_url, conf.comprovantes_camisetas_urls);
          setComprovantesTaxasUrls(taxasUrls);
          setComprovanteUrl(taxasUrls[taxasUrls.length - 1] || null);
          setComprovantesCamisetasUrls(camisetasUrls);
          setComprovanteCamisetasUrl(camisetasUrls[camisetasUrls.length - 1] || null);
        }
      }

      // Get encounter fee and PIX info
      setPublicFormPublished(false);
      const { data: encData } = await supabase
        .from('encontros')
        .select('valor_taxa, pix_taxa_chave, pix_taxa_tipo, pix_taxa_qrcode_url, pix_camisetas_chave, pix_camisetas_tipo, pix_camisetas_qrcode_url, formulario_publico_ativo')
        .eq('id', userParticipacao.encontro_id)
        .single();

      if (encData) {
        setPublicFormPublished(Boolean(encData.formulario_publico_ativo));
        setValorTaxa(encData.valor_taxa || 0);
        setPixTaxa({
          chave: encData.pix_taxa_chave,
          tipo: isPixTipo(encData.pix_taxa_tipo) ? encData.pix_taxa_tipo : null,
          qrCodeUrl: encData.pix_taxa_qrcode_url
        });
        setPixCamisetas({
          chave: encData.pix_camisetas_chave,
          tipo: isPixTipo(encData.pix_camisetas_tipo) ? encData.pix_camisetas_tipo : null,
          qrCodeUrl: encData.pix_camisetas_qrcode_url
        });
      }

      loadPedidos();

      const data = await inscricaoService.listarPorEquipeEEncontro(userParticipacao.equipe_id!, userParticipacao.encontro_id);

      const typedData = (data as unknown as EquipeMember[]) || [];

      const sortedData = typedData.sort((a, b) => {
        if (a.coordenador && !b.coordenador) return -1;
        if (!a.coordenador && b.coordenador) return 1;
        const nomeA = a.pessoas?.nome_completo || '';
        const nomeB = b.pessoas?.nome_completo || '';
        return nomeA.localeCompare(nomeB);
      });
      setMembers(sortedData);
      return sortedData;
    } catch (error) {
      console.error('Erro ao buscar membros da equipe:', error);
      toast.error('Erro ao carregar membros da equipe.');
      return [];
    } finally {
      setLoading(false);
    }
  }, [userParticipacao, loadPedidos]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    loadAvaliacao();
  }, [loadAvaliacao]);

  const handleDeleteMember = async () => {
    if (!deleteTarget) return;
    setIsConfirmingDelete(true);
    try {
      await inscricaoService.desvincularDoEncontro(deleteTarget.id);
      setMembers(prev => prev.filter(m => m.id !== deleteTarget.id));
      toast.success('Integrante desvinculado com sucesso!');
      setDeleteTarget(null);
    } catch (error) {
      console.error('Erro ao desvincular:', error);
      toast.error('Erro ao desvincular integrante.');
    } finally {
      setIsConfirmingDelete(false);
    }
  };

  const handleCopyPublicFormLink = async () => {
    if (!userParticipacao?.coordenador || !userParticipacao.encontro_id || !publicFormPublished) return;

    const url = buildPublicFormUrl(userParticipacao.encontro_id);
    try {
      await navigator.clipboard.writeText(url);
      setPublicFormLinkCopied(true);
      toast.success('Link de Recepção e Recreação copiado.');
      window.setTimeout(() => setPublicFormLinkCopied(false), 2000);
    } catch (error) {
      console.error('Erro ao copiar link dos formulários públicos:', error);
      toast.error('Não foi possível copiar o link.');
    }
  };

  const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>, tipo: 'taxas' | 'camisetas') => {
    const file = e.target.files?.[0];
    if (!file || !userParticipacao?.equipe_id || !userParticipacao?.encontro_id || !user) return;

    // Validar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('O arquivo deve ter no máximo 5MB');
      return;
    }

    setIsUploadingProof(tipo);
    let uploadedReference: string | null = null;
    try {
      const url = await equipeService.uploadComprovante(userParticipacao.equipe_id, userParticipacao.encontro_id, file, tipo);
      uploadedReference = url;
      const urls = await equipeService.atualizarComprovante(userParticipacao.equipe_id, userParticipacao.encontro_id, url, user.id, tipo);
      uploadedReference = null;

      if (tipo === 'taxas') {
        setComprovantesTaxasUrls(urls);
        setComprovanteUrl(url);
      } else {
        setComprovantesCamisetasUrls(urls);
        setComprovanteCamisetasUrl(url);
      }

      toast.success(`Comprovante de ${tipo} enviado com sucesso!`);

      // Atualiza o estado da confirmação se necessário
      const conf = await equipeService.obterConfirmacao(userParticipacao.equipe_id, userParticipacao.encontro_id);
      if (conf) setTeamConfirmation(conf);
    } catch (error) {
      if (uploadedReference) {
        await equipeService.removerArquivoComprovante(uploadedReference).catch((storageError) => {
          console.error('Erro ao desfazer upload do comprovante:', storageError);
        });
      }
      console.error('Erro ao enviar comprovante:', error);
      toast.error('Erro ao enviar comprovante');
    } finally {
      setIsUploadingProof(null);
      e.target.value = '';
    }
  };

  const handleDeleteProof = async (url: string) => {
    if (!proofGallery || !userParticipacao?.equipe_id || !userParticipacao?.encontro_id) return;

    try {
      const nextUrls = await equipeService.removerComprovante(
        userParticipacao.equipe_id,
        userParticipacao.encontro_id,
        url,
        proofGallery.tipo
      );
      const latestUrl = nextUrls[nextUrls.length - 1] || null;

      if (proofGallery.tipo === 'taxas') {
        setComprovantesTaxasUrls(nextUrls);
        setComprovanteUrl(latestUrl);
      } else {
        setComprovantesCamisetasUrls(nextUrls);
        setComprovanteCamisetasUrl(latestUrl);
      }

      if (nextUrls.length === 0) {
        setProofGallery(null);
      } else {
        setProofGallery(current => current ? { ...current, urls: nextUrls } : null);
      }
      toast.success('Comprovante excluído com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir comprovante:', error);
      toast.error('Erro ao excluir comprovante.');
      throw error;
    }
  };

  const handleEditSubmit = async (data: PessoaFormData, shouldConfirm: boolean) => {
    if (!editingPessoa) return;
    setIsSaving(true);
    try {
      const member = members.find(m => m.pessoa_id === editingPessoa.id);
      await pessoaService.atualizar(editingPessoa.id, data);

      if (member && shouldConfirm) {
        await inscricaoService.confirmarDados(member.id);
        toast.success('Dados salvos e confirmados com sucesso!');
      } else {
        toast.success('Dados salvos com sucesso!');
      }

      setEditingPessoa(null);
      const updatedMembers = await loadMembers();
      if (shouldConfirm && updatedMembers) {
        checkAllMembersConfirmed(updatedMembers);
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar alterações.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenPessoaEdit = async (pessoaId: string) => {
    setIsLoadingPessoaEdit(true);
    try {
      setEditingPessoa(await pessoaService.buscarPorId(pessoaId));
    } catch (error) {
      console.error('Erro ao carregar dados completos da pessoa:', error);
      toast.error('Não foi possível carregar os dados completos para edição.');
    } finally {
      setIsLoadingPessoaEdit(false);
    }
  };

  const checkAllMembersConfirmed = (currentMembers: EquipeMember[]) => {
    if (currentMembers.length === 0) return;
    const allConfirmed = currentMembers.every(m => m.dados_confirmados);
    if (allConfirmed && !teamConfirmation) {
      setShowFinalizeModal(true);
    }
  };

  const handleFinalizeTeam = async () => {
    if (!userParticipacao?.equipe_id || !userParticipacao?.encontro_id || !user?.id) return;

    setIsFinalizingTeam(true);
    try {
      await equipeService.confirmarEquipe(
        userParticipacao.equipe_id,
        userParticipacao.encontro_id,
        user.id
      );
      toast.success('Equipe finalizada com sucesso!');
      setShowFinalizeModal(false);
      // Reload to update confirmation badge
      await loadMembers();
    } catch (error) {
      console.error('Erro ao finalizar equipe:', error);
      toast.error('Erro ao finalizar equipe.');
    } finally {
      setIsFinalizingTeam(false);
    }
  };

  const handleConfirmOneMember = async (memberId: string) => {
    const member = members.find(m => m.id === memberId);
    if (member?.pessoas) {
      const validation = validatePessoaForConfirmation(member.pessoas);
      if (!validation.isValid) {
        toast.error(`Para confirmar, preencha os seguintes campos: ${validation.missingFields.join(', ')}`, {
          duration: 5000,
          icon: '⚠️'
        });
        return;
      }
    }

    try {
      await inscricaoService.confirmarDados(memberId);
      toast.success('Integrante confirmado!');
      const updatedMembers = members.map(m => m.id === memberId ? { ...m, dados_confirmados: true } : m);
      setMembers(updatedMembers);

      // Check if team is now complete
      checkAllMembersConfirmed(updatedMembers);
    } catch {
      toast.error('Erro ao confirmar integrante.');
    }
  };

  const handleTogglePayment = async (member: EquipeMember) => {
    const newStatus = !member.pago_taxa;
    try {
      // Optimistic update
      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, pago_taxa: newStatus } : m));

      await inscricaoService.alterarStatusPagamento(member.id, newStatus);
      toast.success(newStatus ? 'Pagamento confirmado!' : 'Pagamento removido!');
    } catch {
      // Rollback
      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, pago_taxa: !newStatus } : m));
      toast.error('Erro ao atualizar status de pagamento.');
    }
  };

  const handleToggleShirtPayment = async (member: EquipeMember) => {
    const newStatus = !member.pago_camiseta;
    try {
      // Optimistic update
      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, pago_camiseta: newStatus } : m));

      await inscricaoService.alterarStatusPagamentoCamiseta(member.id, newStatus);
      toast.success(newStatus ? 'Pagamento das camisetas confirmado!' : 'Pagamento das camisetas removido!');
    } catch {
      // Rollback
      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, pago_camiseta: !newStatus } : m));
      toast.error('Erro ao atualizar status de pagamento das camisetas.');
    }
  };

  const handleAddShirt = async (participacaoId: string) => {
    if (!newShirtData.modelo_id) {
      toast.error('Selecione um modelo de camiseta.');
      return;
    }
    if (!newShirtData.quantidade || newShirtData.quantidade < 1) {
      toast.error('A quantidade deve ser pelo menos 1.');
      return;
    }
    setIsSaving(true);
    try {
      await camisetaService.criarPedido({
        participacao_id: participacaoId,
        modelo_id: newShirtData.modelo_id,
        tamanho: newShirtData.tamanho,
        quantidade: newShirtData.quantidade
      });
      toast.success('Pedido de camiseta adicionado!');
      setAddingShirtToMemberId(null);
      await loadPedidos();
    } catch (error) {
      console.error('Erro ao adicionar camiseta:', error);
      toast.error('Erro ao adicionar pedido de camiseta.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteShirt = async (pedidoId: string) => {
    try {
      await camisetaService.excluirPedido(pedidoId);
      toast.success('Pedido removido!');
      await loadPedidos();
    } catch (error) {
      console.error('Erro ao remover pedido:', error);
      toast.error('Erro ao remover pedido de camiseta.');
    }
  };

  const handleConfirmData = async () => {
    if (!userParticipacao || !userParticipacao.equipe_id) return;
    const allConfirmed = members.length > 0 && members.every(m => m.dados_confirmados);
    if (!allConfirmed) {
      toast.error('Todos os integrantes devem ser confirmados individualmente antes da finalização.');
      return;
    }
    setIsConfirming(true);
    try {
      if (!user) throw new Error('Usuário não autenticado');
      await equipeService.confirmarEquipe(userParticipacao.equipe_id, userParticipacao.encontro_id, user.id);
      toast.success('Equipe finalizada com sucesso!');
      const conf = await equipeService.obterConfirmacao(userParticipacao.equipe_id, userParticipacao.encontro_id);
      setTeamConfirmation(conf);
    } catch (error) {
      console.error('Erro ao finalizar equipe:', error);
      toast.error('Erro ao finalizar equipe.');
    } finally {
      setIsConfirming(false);
    }
  };

  const getExportData = () => {
    // Pegar combinações únicas de modelo e tamanho para as colunas
    const shirtCombinations = Array.from(new Set(pedidosCamisetas.map(p => `${p.camiseta_modelos?.nome} ${p.tamanho}`))).sort();

    const rows = members.map((m, idx) => {
      const p = m.pessoas;
      const memberOrders = pedidosCamisetas.filter(pc => pc.participacao_id === m.id);

      const row: Record<string, string | number> = {
        '#': idx + 1,
        'Nome Completo': p.nome_completo || '—',
        'Função': m.coordenador ? 'Coordenador' : 'Encontreiro(a)',
        'Nascimento': p.data_nascimento ? new Date(p.data_nascimento).toLocaleDateString('pt-BR') : '—',
        'Email': p.email || '—',
        'Telefone': formatTelefone(p.telefone),
        'Endereço': p.endereco || '—',
        'Número': p.numero || '—',
        'Bairro': p.bairro || '—',
        'Cidade': p.cidade || '—',
      };

      // Adicionar colunas dinâmicas de camisetas
      shirtCombinations.forEach(comb => {
        const order = memberOrders.find(o => `${o.camiseta_modelos?.nome} ${o.tamanho}` === comb);
        row[comb] = order ? order.quantidade : 0;
      });

      return row;
    });

    return { rows, shirtCombinations };
  };

  const displayedMembers = useMemo(() => {
    return members.filter(m => {
      if (activeFilter === 'confirmed') return m.dados_confirmados;
      if (activeFilter === 'pending') return !m.dados_confirmados;
      if (activeFilter === 'noPhoto') return !m.foto_url;
      return true;
    });
  }, [members, activeFilter]);

  // Rótulos de grupo da lista (Coordenação / Integrantes).
  const memberGroupStats = useMemo(() => {
    const integrantes = displayedMembers.filter(m => !m.coordenador);
    return {
      integrantes: integrantes.length,
      pendentes: integrantes.filter(m => !m.dados_confirmados).length,
    };
  }, [displayedMembers]);

  const toggleMemberDetails = (memberId: string) => {
    setExpandedMemberId(current => (current === memberId ? null : memberId));
  };

  const handleExportPDF = async () => {
    const { rows, shirtCombinations } = getExportData();
    if (rows.length === 0) return;

    setIsExporting(true);
    try {
      let config = null;
      try {
        config = await exportConfigService.obter(userParticipacao!.encontro_id);
      } catch (e) {
        console.warn('Config de exportação não encontrada', e);
      }
      const hasConfig = config && config.config_telas && config.config_telas['CoordenadorMinhaEquipe'];
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      let startY = 30;

      if (hasConfig && config) {
        if (config.imagem_esq_base64) { try { doc.addImage(config.imagem_esq_base64, 'PNG', 14, 10, 30, 30); } catch { console.warn('Erro imagem esq'); } }
        if (config.imagem_dir_base64) { try { doc.addImage(config.imagem_dir_base64, 'PNG', 253, 10, 30, 30); } catch { console.warn('Erro imagem dir'); } }
        doc.setFontSize(14).setFont('helvetica', 'bold').text(config.titulo || '', 148.5, 18, { align: 'center' });
        doc.setFontSize(10).setFont('helvetica', 'normal').text(config.subtitulo || '', 148.5, 24, { align: 'center' });
        doc.text(config.tema || '', 148.5, 30, { align: 'center' });
        startY = config.observacoes ? 58 : 52;
        doc.setFontSize(11).setFont('helvetica', 'bold').text(`Equipe: ${equipeNome || 'Minha Equipe'}`, 14, startY - 6);
      } else {
        doc.setFontSize(16).setFont('helvetica', 'bold').text(`Equipe: ${equipeNome || 'Minha Equipe'}`, 14, 18);
        startY = 28;
      }

      const columns = [
        '#', 'Nome Completo', 'Função', 'Nascimento', 'Email', 'Telefone',
        'Endereço', 'Número', 'Bairro', 'Cidade',
        ...shirtCombinations
      ];
      const dataRows = rows.map(r => columns.map(c => r[c]));

      autoTable(doc, {
        head: [columns],
        body: dataRows,
        startY: startY,
        styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
        columnStyles: {
          0: { cellWidth: 10 }, // #
          1: { cellWidth: 60 }, // Nome
          2: { cellWidth: 25 }, // Função
        },
        headStyles: { fillColor: [37, 99, 235], textColor: 255 },
      });

      doc.save(`equipe_${equipeNome?.replace(/\s+/g, '_') || 'minha_equipe'}.pdf`);
      toast.success('PDF exportado com sucesso!');
      setShowExportMenu(false);
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast.error('Erro ao gerar PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    const { rows } = getExportData();
    if (rows.length === 0) return;
    const exportRows = rows;

    setIsExporting(true);
    try {
      let config = null;
      try {
        config = await exportConfigService.obter(userParticipacao!.encontro_id);
      } catch (e) {
        console.warn('Config de exportação não encontrada', e);
      }
      const hasConfig = config && config.config_telas && config.config_telas['CoordenadorMinhaEquipe'];
      const ws = XLSX.utils.json_to_sheet([]);

      if (hasConfig && config) {
        XLSX.utils.sheet_add_aoa(ws, [
          [config.titulo], [config.subtitulo], [config.tema], [config.observacoes || ''],
          [`${equipeNome || 'Minha Equipe'}`]
        ], { origin: 'A1' });
        XLSX.utils.sheet_add_json(ws, exportRows, { origin: 'A6', skipHeader: false });
      } else {
        XLSX.utils.sheet_add_json(ws, exportRows, { origin: 'A1', skipHeader: false });
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Equipe');
      XLSX.writeFile(wb, `equipe_${equipeNome?.replace(/\s+/g, '_') || 'minha_equipe'}.xlsx`);
      toast.success('Excel exportado com sucesso!');
      setShowExportMenu(false);
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      toast.error('Erro ao gerar Excel.');
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <Loader className="animate-spin" size={32} />
      </div>
    );
  }

  if (editingPessoa) {
    return (
      <>
        <div className="page-header" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={() => setEditingPessoa(null)} className="icon-btn" aria-label="Voltar">
              <ChevronLeft size={20} />
            </button>
            <div>
              <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Editando Membro
              </p>
              <h1 className="page-title text-gradient" style={{ margin: 0, fontSize: '1.5rem' }}>
                {editingPessoa.nome_completo}
              </h1>
            </div>
          </div>
        </div>

        <div className="card animate-fade-in">
          <PessoaForm
            initialData={editingPessoa}
            onSubmit={handleEditSubmit}
            onCancel={() => setEditingPessoa(null)}
            isLoading={isSaving}
            isConfirmationContext={true}
            hideConfirmAction={!!teamConfirmation}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0, flex: '1 1 280px' }}>
          <button onClick={() => navigate('/dashboard')} className="icon-btn" aria-label="Voltar">
            <ChevronLeft size={20} />
          </button>
          <div>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Equipe
            </p>
            <h1 className="page-title text-gradient" style={{ margin: 0, fontSize: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {equipeNome || 'Minha Equipe'}
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: equipeAcesso === 'verde' ? '#10b981' : equipeAcesso === 'amarela' ? '#f59e0b' : '#dc2626',
                  color: '#ffffff',
                  WebkitTextFillColor: '#ffffff',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  boxShadow: `0 2px 4px ${equipeAcesso === 'verde' ? 'rgba(16, 185, 129, 0.3)' : equipeAcesso === 'amarela' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(220, 38, 38, 0.3)'}`
                }}
              >
                {equipeAcesso === 'verde' ? 'Verde' : equipeAcesso === 'amarela' ? 'Amarelo' : 'Vermelho'}
              </span>
            </h1>
          </div>
        </div>

        <div className="team-header-actions" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
          {userParticipacao?.coordenador && publicFormPublished && (
            <button
              type="button"
              onClick={() => void handleCopyPublicFormLink()}
              className="btn-secondary flex items-center gap-2"
              style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', width: isMobile ? '100%' : 'auto' }}
              title="Copiar o link publicado para cadastro de veículos e crianças"
            >
              {publicFormLinkCopied ? <Check size={16} /> : <Copy size={16} />}
              <span>{publicFormLinkCopied ? 'Link copiado' : 'Link Recepção e Recreação'}</span>
            </button>
          )}
          {members.length > 0 && (
            <button
              onClick={() => setShowTeamMapModal(true)}
              className="btn-secondary flex items-center gap-2"
              style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
              title="Visualizar integrantes com endereço geolocalizado"
            >
              <MapPin size={16} />
              <span>Mapa da equipe</span>
            </button>
          )}

          {userParticipacao?.coordenador && liberaAcessoIntegrantes && (
            <button
              type="button"
              onClick={() => navigate('/coordenador/minha-equipe/acessos')}
              className="btn-secondary flex items-center gap-2"
              style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
              title="Liberar o acesso ao sistema para os integrantes da equipe"
            >
              <KeyRound size={16} />
              <span>Liberar acessos</span>
            </button>
          )}

          {userParticipacao?.coordenador && (
            <button
              onClick={() => setShowBulkShirtModal(true)}
              className="btn-primary flex items-center gap-2"
              style={{
                fontSize: '0.85rem',
                padding: '0.5rem 1rem',
                backgroundColor: 'var(--primary-color)',
                borderColor: 'var(--primary-color)',
              }}
            >
              <ShirtIcon size={16} />
              <span>Pedir camiseta</span>
            </button>
          )}

          {members.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="btn-primary flex items-center gap-2"
                style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
              >
                <Download size={16} />
                <span>Exportar</span>
              </button>

              {showExportMenu && (
                <>
                  <div
                    onClick={() => setShowExportMenu(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '110%',
                      zIndex: 100,
                      backgroundColor: 'var(--card-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                      minWidth: '220px',
                      overflow: 'hidden',
                      animation: 'fadeInUp 0.2s ease',
                    }}
                  >
                    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', opacity: 0.5, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Exportar como
                    </div>
                    <button
                      onClick={handleExportPDF}
                      disabled={isExporting}
                      style={{
                        width: '100%', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
                        border: 'none', background: 'none', cursor: isExporting ? 'not-allowed' : 'pointer', color: 'var(--text-color)', fontSize: '0.9rem',
                        transition: 'background-color 0.15s', borderBottom: '1px solid var(--border-color)',
                        opacity: isExporting ? 0.6 : 1
                      }}
                      onMouseEnter={e => !isExporting && (e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb, 0, 0, 254), 0.06)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '8px',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444',
                      }}>
                        {isExporting ? <Loader className="animate-spin" size={18} /> : <FileText size={18} />}
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{isExporting ? 'Gerando...' : 'PDF'}</div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{isExporting ? 'Aguarde um momento' : 'Documento formatado'}</div>
                      </div>
                    </button>
                    <button
                      onClick={handleExportExcel}
                      disabled={isExporting}
                      style={{
                        width: '100%', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
                        border: 'none', background: 'none', cursor: isExporting ? 'not-allowed' : 'pointer', color: 'var(--text-color)', fontSize: '0.9rem',
                        transition: 'background-color 0.15s',
                        opacity: isExporting ? 0.6 : 1
                      }}
                      onMouseEnter={e => !isExporting && (e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb, 0, 0, 254), 0.06)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '8px',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981',
                      }}>
                        {isExporting ? <Loader className="animate-spin" size={18} /> : <FileSpreadsheet size={18} />}
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{isExporting ? 'Gerando...' : 'Excel'}</div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{isExporting ? 'Aguarde um momento' : 'Planilha editável'}</div>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {userParticipacao?.coordenador && (
        <div className="card animate-fade-in" style={{
          marginBottom: '1.5rem',
          padding: '1.25rem',
          background: teamConfirmation ? 'rgba(37, 99, 235, 0.05)' : (members.every(m => m.dados_confirmados) && members.length > 0 ? 'rgba(16, 185, 129, 0.05)' : 'rgba(245, 158, 11, 0.05)'),
          border: `1px solid ${teamConfirmation ? 'rgba(37, 99, 235, 0.2)' : (members.every(m => m.dados_confirmados) && members.length > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)')}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: teamConfirmation ? 'rgba(37, 99, 235, 0.1)' : (members.every(m => m.dados_confirmados) && members.length > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)'),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: teamConfirmation ? 'var(--primary-color)' : (members.every(m => m.dados_confirmados) && members.length > 0 ? '#10b981' : '#f59e0b'),
            }}>
              {teamConfirmation ? <Shield size={22} /> : (members.every(m => m.dados_confirmados) && members.length > 0 ? <CheckCircle size={22} /> : <AlertCircle size={22} />)}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                {teamConfirmation ? 'Equipe Finalizada' : (members.every(m => m.dados_confirmados) && members.length > 0 ? 'Pronto para Confirmar os Dados' : 'Confirmação de Dados Pendente')}
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
                {teamConfirmation
                  ? `Finalizado por ${members.find(m => m.pessoas.email === teamConfirmation.profiles?.email)?.pessoas.nome_completo || teamConfirmation.profiles?.email || 'Coordenador'} em ${teamConfirmation.confirmado_em ? new Date(teamConfirmation.confirmado_em).toLocaleString('pt-BR') : '—'}`
                  : (members.every(m => m.dados_confirmados) && members.length > 0
                    ? 'Todos os dados cadastrais dos integrantes foram revisados. Você pode confirmar e finalizar a equipe agora.'
                    : `Confirme os dados cadastrais de cada integrante. Faltam ${members.filter(m => !m.dados_confirmados).length} integrantes.`)}
              </p>
            </div>
          </div>
          {!teamConfirmation && (
            <button
              onClick={handleConfirmData}
              disabled={isConfirming || members.length === 0 || !members.every(m => m.dados_confirmados)}
              className="btn-primary show-mobile-full-width"
              style={{
                fontSize: '0.85rem',
                padding: '0.6rem 1.25rem',
                backgroundColor: members.every(m => m.dados_confirmados) && members.length > 0 ? '#10b981' : '#cbd5e1',
                borderColor: members.every(m => m.dados_confirmados) && members.length > 0 ? '#10b981' : '#cbd5e1',
                cursor: members.every(m => m.dados_confirmados) && members.length > 0 ? 'pointer' : 'not-allowed'
              }}
            >
              {isConfirming ? <Loader className="animate-spin" size={16} /> : 'Confirmar dados da equipe'}
            </button>
          )}
        </div>
      )}


      {userParticipacao?.coordenador && avaliacaoResumo && avaliacaoResumo.totalPerguntas > 0 && avaliacaoResumo.liberada && (
        <div className="card animate-fade-in" style={{
          marginBottom: '1.5rem',
          padding: isMobile ? '1rem' : '1.25rem',
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
            marginBottom: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: avaliacaoResumo.status === 'enviado' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(var(--primary-rgb), 0.1)',
                color: avaliacaoResumo.status === 'enviado' ? '#10b981' : 'var(--primary-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {isLoadingAvaliacao ? <Loader className="animate-spin" size={20} /> : <ClipboardCheck size={22} />}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                  Pesquisa de Satisfação
                </h3>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', opacity: 0.68, lineHeight: 1.45 }}>
                  {avaliacaoResumo.status === 'enviado'
                    ? `Enviada em ${avaliacaoResumo.enviadoEm ? new Date(avaliacaoResumo.enviadoEm).toLocaleString('pt-BR') : 'data não informada'}.`
                    : `Liberada para sua equipe. ${avaliacaoResumo.totalEnviados} de ${avaliacaoResumo.totalParticipantes} respostas enviadas.`}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                padding: '0.35rem 0.7rem',
                borderRadius: '999px',
                backgroundColor: avaliacaoResumo.status === 'enviado' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(var(--primary-rgb), 0.08)',
                color: avaliacaoResumo.status === 'enviado' ? '#10b981' : 'var(--primary-color)'
              }}>
                {avaliacaoResumo.status === 'enviado' ? 'Enviada' : avaliacaoResumo.status === 'rascunho' ? 'Rascunho' : 'Pendente'}
              </span>
              {avaliacaoResumo.publicada && (
                <button
                  type="button"
                  className="btn-secondary show-mobile-full-width"
                  onClick={() => setIsPesquisaShareOpen(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                    minHeight: '40px',
                    lineHeight: 1,
                    whiteSpace: 'nowrap'
                  }}
                >
                  <QrCode size={16} />
                  Link da pesquisa
                </button>
              )}
              <button
                type="button"
                className="btn-primary show-mobile-full-width"
                onClick={() => navigate('/coordenador/minha-equipe/avaliacao')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  minHeight: '40px',
                  lineHeight: 1,
                  whiteSpace: 'nowrap'
                }}
              >
                {avaliacaoResumo.status === 'enviado' ? <Eye size={16} /> : <ArrowRight size={16} />}
                {avaliacaoResumo.status === 'enviado'
                  ? 'Ver pesquisa'
                  : avaliacaoResumo.status === 'rascunho'
                    ? 'Continuar pesquisa'
                    : 'Iniciar pesquisa'}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Seção de Comprovantes */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: '1rem',
        marginBottom: '1.5rem',
        marginTop: '1.5rem'
      }}>
        {/* Card 1: Taxas */}
        <div className="card animate-fade-in" style={{
          padding: '1.25rem',
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: comprovanteUrl ? 'rgba(16, 185, 129, 0.1)' : 'rgba(var(--primary-rgb), 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: comprovanteUrl ? '#10b981' : 'var(--primary-color)',
              flexShrink: 0
            }}>
              <FileText size={22} />
            </div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, flex: 1 }}>Taxas da Equipe</h3>
            <button 
              onClick={() => setShowTaxaSummaryModal(true)}
              className="btn-text" 
              style={{ fontSize: '0.75rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
            >
              <LayoutGrid size={14} />
              <span>Resumo</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.2rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                {members.filter(m => m.pago_taxa).length}/{members.length} pagas
              </span>
              <span style={{ width: '3px', height: '3px', borderRadius: '50%', backgroundColor: 'currentColor', opacity: 0.3 }}></span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                {formatBRL(members.filter(m => m.pago_taxa).length * valorTaxa)}/{formatBRL(members.length * valorTaxa)}
              </span>
            </div>
          </div>

          {comprovantesTaxasUrls.length > 0 && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setProofGallery({ title: 'Comprovantes de taxas', tipo: 'taxas', urls: comprovantesTaxasUrls })}
              style={{ fontSize: '0.75rem', padding: '0.45rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center' }}
            >
              <Eye size={14} />
              <span>Ver comprovantes ({comprovantesTaxasUrls.length})</span>
            </button>
          )}

          <div style={{ margin: '0.25rem 0' }}>
            <PixPaymentInfo
              chave={pixTaxa.chave}
              tipo={pixTaxa.tipo}
              qrCodeUrl={pixTaxa.qrCodeUrl}
              variant="compact"
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <label className={`btn ${comprovanteUrl ? 'btn-secondary' : 'btn-primary'}`} style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem', cursor: isUploadingProof === 'taxas' ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, justifyContent: 'center', margin: 0 }}>
              {isUploadingProof === 'taxas' ? <Loader className="animate-spin" size={14} /> : <Upload size={14} />}
              <span>{comprovanteUrl ? 'Adicionar Comprovante' : 'Enviar Comprovante'}</span>
              <input type="file" onChange={(e) => handleUploadProof(e, 'taxas')} accept="image/*,.pdf" style={{ display: 'none' }} disabled={isUploadingProof === 'taxas'} />
            </label>
          </div>
        </div>

        {/* Card 2: Camisetas */}
        <div className="card animate-fade-in" style={{
          padding: '1.25rem',
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: comprovanteCamisetasUrl ? 'rgba(var(--accent-rgb), 0.1)' : 'rgba(var(--primary-rgb), 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: comprovanteCamisetasUrl ? 'var(--accent-color)' : 'var(--primary-color)',
            }}>
              <ShirtIcon size={22} />
            </div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, flex: 1 }}>Camisetas da Equipe</h3>
            <button 
              onClick={() => setShowShirtSummaryModal(true)}
              className="btn-text" 
              style={{ fontSize: '0.75rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
            >
              <LayoutGrid size={14} />
              <span>Resumo</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.2rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                {(() => {
                  const memberIds = new Set(members.map(m => m.id));
                  const teamPedidos = pedidosCamisetas.filter(p => memberIds.has(p.participacao_id));
                  const total = teamPedidos.reduce((acc, curr) => acc + (curr.quantidade || 1), 0);
                  return `${total} ${total === 1 ? 'camiseta' : 'camisetas'}`;
                })()}
              </span>
              <span style={{ width: '3px', height: '3px', borderRadius: '50%', backgroundColor: 'currentColor', opacity: 0.3 }}></span>
              <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                {(() => {
                  const membersWithShirts = members.filter(m => {
                    const memberOrders = pedidosCamisetas.filter(pc => pc.participacao_id === m.id);
                    return memberOrders.length > 0;
                  });
                  const paidMembersWithShirts = membersWithShirts.filter(m => m.pago_camiseta);
                  return `${paidMembersWithShirts.length}/${membersWithShirts.length} pagas`;
                })()}
              </span>
              <span style={{ width: '3px', height: '3px', borderRadius: '50%', backgroundColor: 'currentColor', opacity: 0.3 }}></span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                {(() => {
                  const memberIds = new Set(members.map(m => m.id));
                  const teamPedidos = pedidosCamisetas.filter(p => memberIds.has(p.participacao_id));
                  
                  const total = teamPedidos.reduce((acc, curr) => {
                    const modeloEncontro = modelosCamiseta.find(m => m.id === curr.modelo_id);
                    return acc + ((modeloEncontro?.valor || 0) * (curr.quantidade || 1));
                  }, 0);

                  const paidMembersIds = new Set(members.filter(m => m.pago_camiseta).map(m => m.id));
                  const paidTeamPedidos = teamPedidos.filter(p => paidMembersIds.has(p.participacao_id));

                  const totalPago = paidTeamPedidos.reduce((acc, curr) => {
                    const modeloEncontro = modelosCamiseta.find(m => m.id === curr.modelo_id);
                    return acc + ((modeloEncontro?.valor || 0) * (curr.quantidade || 1));
                  }, 0);

                  return `${formatBRL(totalPago)}/${formatBRL(total)}`;
                })()}
              </span>
            </div>
          </div>

          {comprovantesCamisetasUrls.length > 0 && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setProofGallery({ title: 'Comprovantes de camisetas', tipo: 'camisetas', urls: comprovantesCamisetasUrls })}
              style={{ fontSize: '0.75rem', padding: '0.45rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'center' }}
            >
              <Eye size={14} />
              <span>Ver comprovantes ({comprovantesCamisetasUrls.length})</span>
            </button>
          )}


          <div style={{ margin: '0.25rem 0' }}>
            <PixPaymentInfo
              chave={pixCamisetas.chave}
              tipo={pixCamisetas.tipo}
              qrCodeUrl={pixCamisetas.qrCodeUrl}
              variant="compact"
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <label className={`btn ${comprovanteCamisetasUrl ? 'btn-secondary' : 'btn-primary'}`} style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem', cursor: isUploadingProof === 'camisetas' ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, justifyContent: 'center', margin: 0 }}>
              {isUploadingProof === 'camisetas' ? <Loader className="animate-spin" size={14} /> : <Upload size={14} />}
              <span>{comprovanteCamisetasUrl ? 'Adicionar Comprovante' : 'Enviar Comprovante'}</span>
              <input type="file" onChange={(e) => handleUploadProof(e, 'camisetas')} accept="image/*,.pdf" style={{ display: 'none' }} disabled={isUploadingProof === 'camisetas'} />
            </label>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div
          onClick={() => setActiveFilter('all')}
          className="card"
          style={{
            padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer',
            border: activeFilter === 'all' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
            transform: activeFilter === 'all' ? 'translateY(-2px)' : 'none',
            transition: 'all 0.2s',
            flexWrap: 'wrap',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '100px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              backgroundColor: 'rgba(37, 99, 235, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)',
            }}>
              <Users size={20} />
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>{members.length}</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: 600, textTransform: 'uppercase' }}>Total</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: 'var(--primary-color)', fontSize: '0.65rem', fontWeight: 700, opacity: 0.7, marginLeft: 'auto', padding: '0.25rem 0' }}>
            <span>FILTRAR</span>
            <ChevronRight size={10} />
          </div>
        </div>

        <div
          onClick={() => setActiveFilter('confirmed')}
          className="card"
          style={{
            padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer',
            border: activeFilter === 'confirmed' ? '2px solid #10b981' : '1px solid var(--border-color)',
            transform: activeFilter === 'confirmed' ? 'translateY(-2px)' : 'none',
            transition: 'all 0.2s',
            flexWrap: 'wrap',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '100px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981',
            }}>
              <CheckCircle size={20} />
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>{members.filter(m => m.dados_confirmados).length}</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: 600, textTransform: 'uppercase' }}>Confirmados</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#10b981', fontSize: '0.65rem', fontWeight: 700, opacity: 0.7, marginLeft: 'auto', padding: '0.25rem 0' }}>
            <span>FILTRAR</span>
            <ChevronRight size={10} />
          </div>
        </div>

        <div
          onClick={() => setActiveFilter('pending')}
          className="card"
          style={{
            padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer',
            border: activeFilter === 'pending' ? '2px solid #f59e0b' : '1px solid var(--border-color)',
            transform: activeFilter === 'pending' ? 'translateY(-2px)' : 'none',
            transition: 'all 0.2s',
            flexWrap: 'wrap',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '100px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              backgroundColor: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b',
            }}>
              <AlertCircle size={20} />
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>{members.filter(m => !m.dados_confirmados).length}</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: 600, textTransform: 'uppercase' }}>Pendentes</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#f59e0b', fontSize: '0.65rem', fontWeight: 700, opacity: 0.7, marginLeft: 'auto', padding: '0.25rem 0' }}>
            <span>FILTRAR</span>
            <ChevronRight size={10} />
          </div>
        </div>
      </div>

      {isDeveloper && (
        <div className="card team-dev-selector">
          <div className="team-dev-selector__info">
            <Shield size={18} />
            <span><strong>Modo desenvolvedor:</strong> visualizar a equipe</span>
          </div>
          <div className="team-dev-selector__field">
            <GroupedDropdown
              ariaLabel="Equipe exibida"
              value={devEquipeId}
              onChange={setDevEquipeId}
              placeholder="Selecione a equipe"
              items={devEquipes.map(equipe => ({ value: equipe.id, label: equipe.nome || 'Sem nome' }))}
            />
          </div>
        </div>
      )}

      {canManagePhotos && members.length > 0 && (() => {
        const comFoto = members.filter(m => m.foto_url).length;
        const semFoto = members.length - comFoto;
        return (
          <div className="card team-photo-status">
            <div className="team-photo-status-info">
              <Camera size={18} />
              <span>
                <strong>Fotos para o Quadrante:</strong> {comFoto}/{members.length}
                {semFoto > 0 ? ` · ${semFoto} sem foto` : ' · todos com foto'}
              </span>
            </div>
            {semFoto > 0 && (
              <button
                type="button"
                className="btn-secondary team-photo-status-filter"
                onClick={() => setActiveFilter(activeFilter === 'noPhoto' ? 'all' : 'noPhoto')}
                aria-pressed={activeFilter === 'noPhoto'}
              >
                {activeFilter === 'noPhoto' ? 'Mostrar todos' : 'Mostrar sem foto'}
              </button>
            )}
          </div>
        );
      })()}

      {!userParticipacao ? (
        <div className="card empty-state">
          <Users size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
          <p>Você não possui uma participação ativa neste encontro.</p>
        </div>
      ) : members.length === 0 ? (
        <div className="card empty-state">
          <Users size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
          <p>Nenhum membro encontrado na sua equipe.</p>
        </div>
      ) : (
        <div className="secretaria-team-member-list">
          {displayedMembers.map((m: EquipeMember, index: number) => {
            const p = m.pessoas;
            const address = [p.endereco, p.numero, p.bairro, p.cidade, p.estado]
              .map(v => v?.trim())
              .filter(Boolean)
              .join(', ');
            const hasMapAddress = Boolean(p.endereco?.trim() && p.cidade?.trim());
            const mapsUrl = hasMapAddress
              ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                [p.endereco, p.numero, p.bairro, p.cidade, p.estado, 'Brasil']
                  .map(v => v?.trim())
                  .filter(Boolean)
                  .join(', ')
              )}`
              : null;
            const memberOrders = pedidosCamisetas.filter(pc => pc.participacao_id === m.id);
            const shirtsTotal = memberOrders.reduce((total, order) => {
              const modelo = modelosCamiseta.find(mod => mod.id === order.modelo_id);
              return total + (modelo?.valor || 0) * (order.quantidade || 1);
            }, 0);
            const criancas = [...(m.recreacao_dados || []), ...(m.recreacao_dados_secundario || [])];
            const isExpanded = expandedMemberId === m.id;
            const previous = displayedMembers[index - 1];
            const showCoordinationLabel = m.coordenador && index === 0;
            const showMembersLabel = !m.coordenador && (!previous || previous.coordenador);
            const avatarClassName = `secretaria-team-member-photo secretaria-team-member-photo--${m.coordenador ? 'coordenacao' : 'integrante'}`;
            const avatarContent = (
              <>
                {m.foto_url ? (
                  <img
                    src={m.foto_url}
                    alt=""
                    loading="lazy"
                    style={{ objectPosition: `center ${m.foto_posicao_y ?? 50}%` }}
                  />
                ) : (
                  <span className="secretaria-team-member-photo__initials">{getInitials(p.nome_completo)}</span>
                )}
              </>
            );

            return (
              <Fragment key={m.id}>
              {showCoordinationLabel && (
                <div className="secretaria-team-member-group-label">
                  <span>Coordenação</span>
                </div>
              )}
              {showMembersLabel && (
                <div className="secretaria-team-member-group-label">
                  <span>Integrantes ({memberGroupStats.integrantes})</span>
                  {memberGroupStats.pendentes > 0 && (
                    <small>
                      {memberGroupStats.pendentes} {memberGroupStats.pendentes === 1 ? 'pendente' : 'pendentes'}
                    </small>
                  )}
                </div>
              )}
              <div
                className={`card animate-fade-in secretaria-team-member-card${isExpanded ? ' secretaria-team-member-card--expanded' : ''}${m.dados_confirmados ? '' : ' secretaria-team-member-card--pending'}`}
              >
                <div
                  className="secretaria-team-member-card__header"
                  onClick={() => toggleMemberDetails(m.id)}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      toggleMemberDetails(m.id);
                    }
                  }}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}
                >
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flex: 1, minWidth: 0 }}>
                    {canManagePhotos ? (
                      <button
                        type="button"
                        className={avatarClassName}
                        onClick={event => {
                          event.stopPropagation();
                          setFotoTarget({
                            id: m.id,
                            nome: p.nome_completo,
                            foto_url: m.foto_url,
                            foto_posicao_y: m.foto_posicao_y,
                          });
                        }}
                        onKeyDown={event => event.stopPropagation()}
                        title={m.foto_url ? 'Alterar foto' : 'Adicionar foto'}
                        aria-label={`${m.foto_url ? 'Alterar' : 'Adicionar'} foto de ${p.nome_completo}`}
                      >
                        {avatarContent}
                        <span className="secretaria-team-member-photo__badge" aria-hidden="true"><Camera size={10} /></span>
                      </button>
                    ) : (
                      <span className={avatarClassName} style={{ cursor: 'default' }}>{avatarContent}</span>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{p.nome_completo}</h3>
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', fontSize: '0.85rem', opacity: 0.7, flexWrap: 'wrap', minWidth: 0 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <Phone size={14} style={{ flexShrink: 0 }} /> {formatTelefone(p.telefone)}
                        </span>
                        {!p.email && !address ? (
                          <span className="secretaria-team-member-card__contact-extra is-missing">
                            E-mail e endereço ainda não informados
                          </span>
                        ) : (
                          <>
                            {p.email && (
                              <span className="secretaria-team-member-card__contact-extra" title={p.email}>
                                <Mail size={14} /> {p.email}
                              </span>
                            )}
                            {address && (
                              <span className="secretaria-team-member-card__contact-extra secretaria-team-member-card__contact-extra--address">
                                <MapPin size={14} />
                                <span className="secretaria-team-member-card__address-label" title={address}>{address}</span>
                                {mapsUrl && (
                                  <a
                                    href={mapsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="secretaria-team-member-card__maps-link"
                                    onClick={event => event.stopPropagation()}
                                    title="Abrir endereço no Google Maps"
                                  >
                                    <ExternalLink size={13} /> Maps
                                  </a>
                                )}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    className="secretaria-team-member-card__actions secretaria-team-member-card__actions--no-summary"
                    onClick={event => event.stopPropagation()}
                    onKeyDown={event => event.stopPropagation()}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}
                  >
                    {m.dados_confirmados ? (
                      <span className="secretaria-team-member-card__confirmed-badge">
                        <Check size={16} aria-hidden="true" />
                        Confirmado
                      </span>
                    ) : (
                      <>
                        <span className="secretaria-team-member-card__pending-badge">
                          <AlertCircle size={16} aria-hidden="true" />
                          Pendente
                        </span>
                        <button
                          type="button"
                          onClick={() => handleConfirmOneMember(m.id)}
                          className="secretaria-team-member-card__confirm-action"
                          title="Confirmar dados do integrante"
                        >
                          <Check size={18} style={{ flexShrink: 0 }} />
                          <span>Confirmar dados</span>
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(m)}
                      className="secretaria-team-member-card__desktop-action secretaria-team-member-card__desktop-action--remove"
                      title="Desvincular integrante"
                    >
                      <UserX size={16} />
                      <span>Desvincular</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleOpenPessoaEdit(p.id)}
                      disabled={isLoadingPessoaEdit}
                      className="secretaria-team-member-card__desktop-action secretaria-team-member-card__desktop-action--edit"
                      title="Editar dados do integrante"
                    >
                      <Pencil size={16} />
                      <span>Editar dados</span>
                    </button>
                    <button
                      type="button"
                      className="btn-icon secretaria-team-member-card__toggle"
                      onClick={() => toggleMemberDetails(m.id)}
                      aria-label={isExpanded ? 'Ocultar detalhes do integrante' : 'Exibir detalhes do integrante'}
                      aria-expanded={isExpanded}
                    >
                      <span className="secretaria-team-member-card__toggle-label">
                        {isExpanded ? 'Menos detalhes' : 'Mais detalhes'}
                      </span>
                      <span className="secretaria-team-member-card__chevron" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="secretaria-team-member-card__details">
                  <div className="secretaria-team-member-card__contact-details">
                    {p.email && (
                      <span title={p.email}>
                        <Mail size={14} /> {p.email}
                      </span>
                    )}
                    <span>
                      <MapPin size={14} />
                      {address || 'Endereço não informado'}
                    </span>
                    {mapsUrl && (
                      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="secretaria-team-member-card__maps-link">
                        <ExternalLink size={14} /> Abrir no Google Maps
                      </a>
                    )}
                  </div>

                  <div className="secretaria-team-member-card__mobile-actions">
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(m)}
                      className="btn-secondary secretaria-team-member-card__remove-action"
                    >
                      <UserX size={16} />
                      Desvincular
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleOpenPessoaEdit(p.id)}
                      disabled={isLoadingPessoaEdit}
                      className="btn-secondary secretaria-team-member-card__edit-action"
                    >
                      <Pencil size={16} />
                      Editar dados
                    </button>
                  </div>

                  <div className="secretaria-team-member-card__sections secretaria-team-member-card__sections--four">
                    {/* Taxa */}
                    <div className="secretaria-member-panel">
                      <span className="secretaria-member-panel__icon" aria-hidden="true"><DollarSign size={18} /></span>
                      <div className="secretaria-member-panel__body">
                        <strong>Taxa</strong>
                        <span>{formatBRL(valorTaxa)} · {m.pago_taxa ? 'Pago' : 'Pendente'}</span>
                      </div>
                      <div className="secretaria-member-panel__actions">
                        <button
                          type="button"
                          className={`secretaria-member-panel__action${m.pago_taxa ? ' is-paid' : ' is-add'}`}
                          onClick={() => handleTogglePayment(m)}
                          title={m.pago_taxa ? 'Desmarcar pagamento da taxa' : 'Marcar taxa como paga'}
                        >
                          {m.pago_taxa ? <CheckCircle size={14} /> : <DollarSign size={14} />}
                          <span className="secretaria-member-panel__label">{m.pago_taxa ? 'Pago' : 'Marcar pago'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Recepção */}
                    <div className={`secretaria-member-panel${m.recepcao_dados ? '' : ' is-empty'}`}>
                      <span className="secretaria-member-panel__icon" aria-hidden="true"><Car size={18} /></span>
                      <div className="secretaria-member-panel__body">
                        <strong>Recepção</strong>
                        {m.recepcao_dados ? (
                          <span>
                            {m.recepcao_dados.veiculo_tipo === 'moto' ? 'Moto' : 'Carro'} · {[m.recepcao_dados.veiculo_modelo, m.recepcao_dados.veiculo_cor].filter(Boolean).join(' ')}
                            {m.recepcao_dados.veiculo_placa ? ` · ${m.recepcao_dados.veiculo_placa}` : ''}
                          </span>
                        ) : (
                          <span>Não cadastrado</span>
                        )}
                      </div>
                      <div className="secretaria-member-panel__actions">
                        <button
                          type="button"
                          className={`secretaria-member-panel__action${m.recepcao_dados ? '' : ' is-add'}`}
                          onClick={() => {
                            setRecepcaoParticipacaoId(m.id);
                            setRecepcaoParticipanteNome(p.nome_completo || '');
                          }}
                          title={m.recepcao_dados ? 'Editar recepção' : 'Cadastrar recepção'}
                        >
                          {m.recepcao_dados ? <Pencil size={14} /> : <Plus size={14} />}
                          <span className="secretaria-member-panel__label">{m.recepcao_dados ? 'Editar' : 'Cadastrar'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Recreação */}
                    <div className={`secretaria-member-panel${criancas.length > 0 ? '' : ' is-empty'}`}>
                      <span className="secretaria-member-panel__icon" aria-hidden="true"><Baby size={18} /></span>
                      <div className="secretaria-member-panel__body">
                        <strong>
                          Recreação
                          {criancas.length > 0 && ` · ${criancas.length} ${criancas.length === 1 ? 'criança' : 'crianças'}`}
                        </strong>
                        <span>
                          {criancas.length > 0
                            ? criancas.map(c => `${c.nome_crianca}, ${formatChildAge(c.data_nascimento, c.idade)}`).join(' · ')
                            : 'Não cadastrado'}
                        </span>
                      </div>
                      <div className="secretaria-member-panel__actions">
                        <button
                          type="button"
                          className={`secretaria-member-panel__action${criancas.length > 0 ? '' : ' is-add'}`}
                          onClick={() => {
                            setRecreacaoParticipacaoId(m.id);
                            setRecreacaoParticipanteNome(p.nome_completo || '');
                          }}
                          title={criancas.length > 0 ? 'Editar recreação' : 'Cadastrar recreação'}
                        >
                          {criancas.length > 0 ? <Pencil size={14} /> : <Plus size={14} />}
                          <span className="secretaria-member-panel__label">{criancas.length > 0 ? 'Editar' : 'Cadastrar'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Camisetas: resumo; pedidos e formulário ficam na janela "Editar" */}
                    <div className={`secretaria-member-panel${memberOrders.length > 0 ? '' : ' is-empty'}`}>
                      <span className="secretaria-member-panel__icon" aria-hidden="true"><ShirtIcon size={18} /></span>
                      <div className="secretaria-member-panel__body">
                        <strong>
                          Camisetas
                          {memberOrders.length > 0 && ` · ${memberOrders.length} ${memberOrders.length === 1 ? 'pedido' : 'pedidos'}`}
                        </strong>
                        <span>
                          {memberOrders.length > 0
                            ? `${formatBRL(shirtsTotal)} · ${m.pago_camiseta ? 'Pago' : 'Pendente'}`
                            : 'Nenhum pedido'}
                        </span>
                      </div>
                      <div className="secretaria-member-panel__actions">
                        {memberOrders.length > 0 && (
                          <button
                            type="button"
                            className={`secretaria-member-panel__action${m.pago_camiseta ? ' is-paid' : ' is-add'}`}
                            onClick={() => handleToggleShirtPayment(m)}
                            title={m.pago_camiseta ? 'Desmarcar pagamento das camisetas' : 'Marcar camisetas como pagas'}
                          >
                            {m.pago_camiseta ? <CheckCircle size={14} /> : <DollarSign size={14} />}
                            <span className="secretaria-member-panel__label">{m.pago_camiseta ? 'Pago' : 'Marcar pago'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className={`secretaria-member-panel__action${memberOrders.length > 0 ? '' : ' is-add'}`}
                          onClick={() => {
                            setShirtModalMemberId(m.id);
                            setAddingShirtToMemberId(memberOrders.length > 0 ? null : m.id);
                          }}
                          title={memberOrders.length > 0 ? 'Editar pedidos de camiseta' : 'Solicitar camiseta'}
                        >
                          {memberOrders.length > 0 ? <Pencil size={14} /> : <Plus size={14} />}
                          <span className="secretaria-member-panel__label">{memberOrders.length > 0 ? 'Editar' : 'Solicitar'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              </Fragment>
            );
          })}
        </div>
      )}



      {(() => {
        const m = members.find(member => member.id === shirtModalMemberId);
        if (!m) return null;
        const memberOrders = pedidosCamisetas.filter(pc => pc.participacao_id === m.id);
        const shirtsTotal = memberOrders.reduce((total, order) => {
          const modelo = modelosCamiseta.find(mod => mod.id === order.modelo_id);
          return total + (modelo?.valor || 0) * (order.quantidade || 1);
        }, 0);
        const closeShirtModal = () => {
          setShirtModalMemberId(null);
          setAddingShirtToMemberId(null);
        };

        return (
          <Modal isOpen onClose={closeShirtModal} title={`Camisetas · ${m.pessoas.nome_completo}`} maxWidth="520px">
            <div className="team-shirt-modal">
              <div className="team-shirt-modal__header">
                <span>Pedidos</span>
                {addingShirtToMemberId !== m.id && (
                  <button
                    type="button"
                    className="secretaria-member-panel__action is-add"
                    onClick={() => setAddingShirtToMemberId(m.id)}
                  >
                    <Plus size={14} />
                    Adicionar
                  </button>
                )}
              </div>

              {addingShirtToMemberId === m.id && (
                      <div className="animate-fade-in" style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.6rem',
                        padding: '0.75rem',
                        backgroundColor: 'rgba(0,0,0,0.03)',
                        borderRadius: '10px'
                      }}>
                        <div style={{
                          display: 'flex',
                          gap: '0.75rem',
                          alignItems: 'flex-end',
                          flexWrap: 'nowrap',
                          marginBottom: '1rem'
                        }}>
                          <div style={{ flex: '2', minWidth: '0' }}>
                            <label style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.5, marginBottom: '0.3rem', display: 'block' }}>Modelo</label>
                            <GroupedDropdown
                              className="team-shirt-dropdown"
                              ariaLabel="Modelo da camiseta"
                              value={newShirtData.modelo_id}
                              onChange={newModelId => {
                                const availableSizes = tamanhosCamiseta.filter(t => !t.modelo_id || t.modelo_id === newModelId);
                                const newSize = availableSizes.some(t => t.sigla === newShirtData.tamanho) ? newShirtData.tamanho : (availableSizes[0]?.sigla || '');
                                setNewShirtData({ ...newShirtData, modelo_id: newModelId, tamanho: newSize });
                              }}
                              items={modelosCamiseta.map(mod => ({ value: mod.id, label: mod.nome }))}
                            />
                          </div>

                          <div style={{ flex: 1, flexShrink: 1 }}>
                            <label style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.5, marginBottom: '0.3rem', display: 'block', textAlign: 'left' }}>Tamanho</label>
                            <GroupedDropdown
                              className="team-shirt-dropdown"
                              ariaLabel="Tamanho da camiseta"
                              value={newShirtData.tamanho}
                              onChange={tamanho => setNewShirtData({ ...newShirtData, tamanho })}
                              items={tamanhosCamiseta
                                .filter(t => !t.modelo_id || t.modelo_id === newShirtData.modelo_id)
                                .map(t => ({ value: t.sigla, label: t.sigla }))}
                            />
                          </div>

                          <div style={{ flex: 1, flexShrink: 1 }}>
                            <label style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.5, marginBottom: '0.3rem', display: 'block', textAlign: 'left' }}>Quantidade</label>
                            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', height: '44px', padding: '2px' }}>
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setNewShirtData(prev => ({ ...prev, quantidade: Math.max(0, prev.quantidade - 1) })); }}
                                style={{
                                  minWidth: '40px', height: '100%', border: 'none', background: 'none',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  cursor: 'pointer', color: 'var(--primary-color)',
                                  transition: 'all 0.2s',
                                  flexShrink: 1,
                                  padding: 0,
                                  outline: 'none',
                                }}
                                disabled={newShirtData.quantidade === 1}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                <Minus size={16} strokeWidth={1.5} color='var(--text-color)' />
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={newShirtData.quantidade || ''}
                                onChange={e => setNewShirtData({ ...newShirtData, quantidade: parseInt(e.target.value) })}
                                className="form-input no-spinner"
                                style={{
                                  flex: 1, padding: '0', border: 'none', background: 'transparent',
                                  fontSize: '0.9rem', textAlign: 'center', fontWeight: 500,
                                  color: 'var(--text-color)',
                                  appearance: 'none', margin: 0,
                                  boxShadow: 'none',
                                }}
                              />
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setNewShirtData(prev => ({ ...prev, quantidade: prev.quantidade + 1 })); }}
                                style={{
                                  minWidth: '40px', height: '100%', border: 'none', background: 'none',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  cursor: 'pointer', color: 'var(--primary-color)',
                                  transition: 'all 0.2s',
                                  flexShrink: 1,
                                  padding: 0,
                                  outline: 'none',
                                }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                <Plus size={16} strokeWidth={1.5} color='var(--text-color)' />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Price Info */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.65rem 0.85rem',
                          backgroundColor: 'rgba(var(--primary-rgb), 0.05)',
                          borderRadius: '10px',
                          border: '1px dashed var(--border-color)',
                          marginBottom: '0.75rem'
                        }}>
                          {(() => {
                            const model = modelosCamiseta.find(m => m.id === newShirtData.modelo_id);
                            const unitPrice = model?.valor || 0;
                            const totalPrice = unitPrice * newShirtData.quantidade;

                            return (
                              <>
                                <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                                  Unit.: <span style={{ fontWeight: 700 }}>{unitPrice > 0 ? formatBRL(unitPrice) : 'Valor a confirmar'}</span>
                                </div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary-color)' }}>
                                  Total: {unitPrice > 0 ? formatBRL(totalPrice) : 'Valor a confirmar'}
                                </div>
                              </>
                            );
                          })()}
                        </div>

                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          <button type="button" onClick={() => setAddingShirtToMemberId(null)} className="btn-secondary" style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}>Cancelar</button>
                          <button onClick={() => handleAddShirt(m.id)} disabled={isSaving} className="btn-primary" style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}>Salvar</button>
                        </div>
                      </div>
              )}

              {memberOrders.length === 0 ? (
                <p className="team-shirt-modal__empty">Nenhum pedido.</p>
              ) : (
                  <ul className="secretaria-member-panel__list">
                    {memberOrders.map(order => {
                      const modeloEncontro = modelosCamiseta.find(mod => mod.id === order.modelo_id);
                      const valor = (modeloEncontro?.valor || 0) * (order.quantidade || 1);
                      return (
                        <li key={order.id}>
                          <span className="secretaria-member-panel__list-main">
                            {order.camiseta_modelos?.nome} · {order.tamanho} · {order.quantidade}x
                          </span>
                          <span className="secretaria-member-panel__list-value">{formatBRL(valor)}</span>
                          <button
                            type="button"
                            className="secretaria-member-panel__icon-action secretaria-member-panel__icon-action--small"
                            onClick={() => handleDeleteShirt(order.id)}
                            title="Remover pedido"
                            aria-label={`Remover pedido ${order.camiseta_modelos?.nome ?? ''} ${order.tamanho}`}
                          >
                            <X size={13} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
              )}

              {memberOrders.length > 0 && (
                <div className="team-shirt-modal__summary">
                  <span>Total: <strong>{formatBRL(shirtsTotal)}</strong></span>
                  <button
                    type="button"
                    className={`secretaria-member-panel__action${m.pago_camiseta ? ' is-paid' : ' is-add'}`}
                    onClick={() => handleToggleShirtPayment(m)}
                  >
                    {m.pago_camiseta ? <CheckCircle size={14} /> : <DollarSign size={14} />}
                    {m.pago_camiseta ? 'Pago' : 'Marcar pago'}
                  </button>
                </div>
              )}
            </div>
          </Modal>
        );
      })()}

      <EncontreiroFotoModal
        target={fotoTarget}
        onClose={() => setFotoTarget(null)}
        onChange={(participacaoId, foto) => {
          setMembers(current => current.map(member => (
            member.id === participacaoId ? { ...member, ...foto } : member
          )));
          setFotoTarget(current => (current?.id === participacaoId ? { ...current, ...foto } : current));
        }}
      />

      <EquipeMapaModal
        isOpen={showTeamMapModal}
        onClose={() => setShowTeamMapModal(false)}
        equipeNome={equipeNome}
        members={members}
        onUpdated={async () => { await loadMembers(); }}
        onEditMember={(personId) => {
          setShowTeamMapModal(false);
          void handleOpenPessoaEdit(personId);
        }}
      />

      <PesquisaSatisfacaoShareModal
        isOpen={isPesquisaShareOpen && Boolean(avaliacaoResumo?.publicada)}
        onClose={() => setIsPesquisaShareOpen(false)}
        link={pesquisaPublicLink}
      />

      <BulkShirtOrderModal
        isOpen={showBulkShirtModal}
        onClose={() => setShowBulkShirtModal(false)}
        members={members}
        modelos={modelosCamiseta}
        tamanhos={tamanhosCamiseta}
        onSuccess={loadPedidos}
      />

      <TeamShirtSummaryModal
        isOpen={showShirtSummaryModal}
        onClose={() => setShowShirtSummaryModal(false)}
        resumo={teamShirtSummary}
        equipeNome={equipeNome}
      />

      <TeamTaxaSummaryModal
        isOpen={showTaxaSummaryModal}
        onClose={() => setShowTaxaSummaryModal(false)}
        members={members.map(m => ({
          id: m.id,
          nome: m.pessoas?.nome_completo || 'Sem nome',
          pago: !!m.pago_taxa,
          telefone: m.pessoas?.telefone || undefined
        }))}
        equipeNome={equipeNome}
        valorTaxa={valorTaxa}
      />

      {proofGallery && (
        <PaymentProofGalleryModal
          title={proofGallery.title}
          entityName={equipeNome}
          urls={proofGallery.urls}
          onClose={() => setProofGallery(null)}
          onDelete={handleDeleteProof}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Desvincular Integrante"
        message={`Deseja realmente remover ${deleteTarget?.pessoas?.nome_completo} desta equipe e do encontro?`}
        onConfirm={handleDeleteMember}
        onCancel={() => setDeleteTarget(null)}
        confirmText="Desvincular"
        isDestructive={true}
        isLoading={isConfirmingDelete}
      />

      <ConfirmDialog
        isOpen={showFinalizeModal}
        title="Finalizar Confirmação da Equipe"
        message={`Todos os integrantes desta equipe foram confirmados! Deseja finalizar a confirmação da equipe "${equipeNome}" agora?`}
        onConfirm={handleFinalizeTeam}
        onCancel={() => setShowFinalizeModal(false)}
        confirmText="Finalizar Equipe"
        isLoading={isFinalizingTeam}
      />

      <RecepcaoDadosModal
        isOpen={!!recepcaoParticipacaoId}
        onClose={() => {
          setRecepcaoParticipacaoId(null);
          loadMembers();
        }}
        participacaoId={recepcaoParticipacaoId || ''}
        participanteNome={recepcaoParticipanteNome}
        equipeNome={equipeNome}
      />

      <RecreacaoDadosModal
        isOpen={!!recreacaoParticipacaoId}
        onClose={() => {
          setRecreacaoParticipacaoId(null);
          loadMembers();
        }}
        participacaoId={recreacaoParticipacaoId || ''}
        participanteNome={recreacaoParticipanteNome}
        encontroId={userParticipacao?.encontro_id || ''}
      />
    </>
  );
}
