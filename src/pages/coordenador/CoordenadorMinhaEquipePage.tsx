import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AlertCircle,
  Check,
  CheckCircle,
  ChevronLeft,
  DollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  Loader,
  Mail, MapPin,
  Pencil,
  Phone,
  Shield,
  Users,
  X,
  Car,
  ShirtIcon
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { RecepcaoDadosModal } from '../../components/coordenador/RecepcaoDadosModal';
import { PessoaForm } from '../../components/pessoa/PessoaForm';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { camisetaService } from '../../services/camisetaService';
import { equipeService } from '../../services/equipeService';
import { exportConfigService } from '../../services/exportConfigService';
import { inscricaoService } from '../../services/inscricaoService';
import { pessoaService } from '../../services/pessoaService';
import type { CamisetaModelo, CamisetaPedido } from '../../types/camiseta';
import type { Pessoa, PessoaFormData } from '../../types/pessoa';
import type { RecepcaoDados } from '../../types/recepcao';
import { formatBRL } from '../../utils/currencyUtils';

interface EquipeMember {
  id: string;
  pessoa_id: string;
  coordenador: boolean;
  participante: boolean;
  dados_confirmados: boolean;
  pago_taxa: boolean;
  pessoas: Pessoa;
  recepcao_dados: RecepcaoDados | null;
}

function formatTelefone(tel: string | null | undefined) {
  if (!tel) return '—';
  const d = tel.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel;
}

export function CoordenadorMinhaEquipePage() {
  const { user, userParticipacao } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState<EquipeMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [equipeNome, setEquipeNome] = useState('');
  const [editingPessoa, setEditingPessoa] = useState<Pessoa | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [teamConfirmation, setTeamConfirmation] = useState<{ confirmado_por: string; confirmado_em: string; profiles?: { email?: string } | null } | null>(null);
  const [valorTaxa, setValorTaxa] = useState(0);
  const [pedidosCamisetas, setPedidosCamisetas] = useState<CamisetaPedido[]>([]);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [addingShirtToMemberId, setAddingShirtToMemberId] = useState<string | null>(null);
  const [modelosCamiseta, setModelosCamiseta] = useState<CamisetaModelo[]>([]);
  const [newShirtData, setNewShirtData] = useState({ modelo_id: '', tamanho: 'G', quantidade: 1 });
  const [recepcaoParticipacaoId, setRecepcaoParticipacaoId] = useState<string | null>(null);
  const [recepcaoParticipanteNome, setRecepcaoParticipanteNome] = useState<string>('');

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 768;

  const loadPedidos = useCallback(async () => {
    if (!userParticipacao?.encontro_id) return;
    try {
      const [pedidos, modelos] = await Promise.all([
        camisetaService.listarPedidosPorEncontro(userParticipacao.encontro_id),
        camisetaService.listarModelos()
      ]);
      setPedidosCamisetas(pedidos);
      setModelosCamiseta(modelos);
      if (modelos.length > 0) {
        setNewShirtData(prev => ({ ...prev, modelo_id: modelos[0].id }));
      }
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
    }
  }, [userParticipacao?.encontro_id]);

  const loadMembers = useCallback(async () => {
    if (!userParticipacao) {
      setLoading(false);
      return;
    }

    try {
      if (userParticipacao.equipes?.nome) {
        setEquipeNome(userParticipacao.equipes.nome);
      }

      const conf = await equipeService.obterConfirmacao(userParticipacao.equipe_id!, userParticipacao.encontro_id);
      setTeamConfirmation(conf);

      // Get encounter fee
      const { data: encData } = await supabase.from('encontros').select('valor_taxa').eq('id', userParticipacao.encontro_id).single();
      if (encData) setValorTaxa(encData.valor_taxa || 0);

      loadPedidos();

      const { data, error } = await supabase
        .from('participacoes')
        .select(`
          id,
          pessoa_id,
          coordenador,
          participante,
          dados_confirmados,
          pessoas (
            id,
            nome_completo,
            cpf,
            email,
            telefone,
            comunidade,
            data_nascimento,
            nome_pai,
            nome_mae,
            endereco,
            numero,
            bairro,
            cidade,
            telefone_pai,
            telefone_mae,
            outros_contatos,
            fez_ejc_outra_paroquia,
            qual_paroquia_ejc,
            qr_code_token,
            created_at
          ),
          pago_taxa,
          recepcao_dados(*)
        `)
        .eq('encontro_id', userParticipacao.encontro_id)
        .eq('equipe_id', userParticipacao.equipe_id!);

      if (error) throw error;

      const typedData = (data as unknown as EquipeMember[]) || [];

      const sortedData = typedData.sort((a, b) => {
        if (a.coordenador && !b.coordenador) return -1;
        if (!a.coordenador && b.coordenador) return 1;
        const nomeA = a.pessoas?.nome_completo || '';
        const nomeB = b.pessoas?.nome_completo || '';
        return nomeA.localeCompare(nomeB);
      });
      setMembers(sortedData);
    } catch (error) {
      console.error('Erro ao buscar membros da equipe:', error);
      toast.error('Erro ao carregar membros da equipe.');
    } finally {
      setLoading(false);
    }
  }, [userParticipacao, loadPedidos]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleEditSubmit = async (data: PessoaFormData) => {
    if (!editingPessoa) return;
    setIsSaving(true);
    try {
      const member = members.find(m => m.pessoa_id === editingPessoa.id);
      await pessoaService.atualizar(editingPessoa.id, data);
      if (member) {
        await inscricaoService.confirmarDados(member.id);
      }
      toast.success('Dados salvos e confirmados com sucesso!');
      setEditingPessoa(null);
      setLoading(true);
      await loadMembers();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar alterações.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmOneMember = async (memberId: string) => {
    try {
      await inscricaoService.confirmarDados(memberId);
      toast.success('Integrante confirmado!');
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, dados_confirmados: true } : m));
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

  const handleAddShirt = async (participacaoId: string) => {
    if (!newShirtData.modelo_id) {
      toast.error('Selecione um modelo de camiseta.');
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
        'Função': m.coordenador ? 'Coordenador' : 'Membro',
        'Taxa': m.pago_taxa ? 'Paga' : 'Pendente',
      };

      // Adicionar colunas dinâmicas de camisetas
      shirtCombinations.forEach(comb => {
        const order = memberOrders.find(o => `${o.camiseta_modelos?.nome} ${o.tamanho}` === comb);
        row[comb] = order ? order.quantidade : 0;
      });

      row['Telefone'] = formatTelefone(p.telefone);
      row['Comunidade'] = p.comunidade || '—';

      return row;
    });

    // Linha de totais
    const totals: Record<string, string | number> = {
      '#': 'TOTAL',
      'Nome Completo': '',
      'Função': '',
      'Taxa': members.filter(m => m.pago_taxa).length,
    };
    shirtCombinations.forEach(comb => {
      totals[comb] = pedidosCamisetas
        .filter(p => `${p.camiseta_modelos?.nome} ${p.tamanho}` === comb && members.some(m => m.id === p.participacao_id))
        .reduce((acc, p) => acc + p.quantidade, 0);
    });

    return { rows, shirtCombinations, totals };
  };

  const handleExportPDF = async () => {
    const { rows, shirtCombinations, totals } = getExportData();
    if (rows.length === 0) return;

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

    const columns = ['#', 'Nome Completo', 'Função', 'Taxa', ...shirtCombinations];
    const dataRows = [...rows, totals].map(r => columns.map(c => r[c]));

    autoTable(doc, {
      head: [columns],
      body: dataRows,
      startY: startY,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
      didParseCell: (data) => {
        if (data.row.index === rows.length) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 244, 255];
        }
      }
    });

    doc.save(`equipe_${equipeNome?.replace(/\s+/g, '_') || 'minha_equipe'}.pdf`);
    toast.success('PDF exportado com sucesso!');
    setShowExportMenu(false);
  };

  const handleExportExcel = async () => {
    const { rows, totals } = getExportData();
    if (rows.length === 0) return;
    const exportRows = [...rows, totals];

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
        [`Equipe: ${equipeNome || 'Minha Equipe'} - Gerado em: ${new Date().toLocaleDateString('pt-BR')}`]
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
          />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate('/dashboard')} className="icon-btn" aria-label="Voltar">
            <ChevronLeft size={20} />
          </button>
          <div>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Equipe
            </p>
            <h1 className="page-title text-gradient" style={{ margin: 0, fontSize: '1.75rem' }}>
              {equipeNome || 'Minha Equipe'}
            </h1>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {userParticipacao?.coordenador && !userParticipacao.dados_confirmados && (
            <button
              onClick={handleConfirmData}
              disabled={isConfirming || members.length === 0}
              className="btn-primary flex items-center gap-2"
              style={{
                fontSize: '0.85rem',
                padding: '0.5rem 1rem',
                backgroundColor: 'var(--success-color, #10b981)',
                borderColor: 'var(--success-color, #10b981)',
              }}
            >
              {isConfirming ? <Loader className="animate-spin" size={16} /> : <CheckCircle size={16} />}
              <span>Confirmar Dados</span>
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
                <span className="hide-mobile">Exportar</span>
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
                      style={{
                        width: '100%', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
                        border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-color)', fontSize: '0.9rem',
                        transition: 'background-color 0.15s', borderBottom: '1px solid var(--border-color)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb, 0, 0, 254), 0.06)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '8px',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444',
                      }}>
                        <FileText size={18} />
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>PDF</div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>Documento formatado</div>
                      </div>
                    </button>
                    <button
                      onClick={handleExportExcel}
                      style={{
                        width: '100%', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
                        border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-color)', fontSize: '0.9rem',
                        transition: 'background-color 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb, 0, 0, 254), 0.06)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '8px',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981',
                      }}>
                        <FileSpreadsheet size={18} />
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Excel</div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>Planilha editável</div>
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
                {teamConfirmation ? 'Equipe Finalizada' : (members.every(m => m.dados_confirmados) && members.length > 0 ? 'Pronto para Finalizar' : 'Confirmação Pendente')}
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
                {teamConfirmation
                  ? `Finalizado por ${members.find(m => m.pessoas.email === teamConfirmation.profiles?.email)?.pessoas.nome_completo || teamConfirmation.profiles?.email || 'Coordenador'} em ${teamConfirmation.confirmado_em ? new Date(teamConfirmation.confirmado_em).toLocaleString('pt-BR') : '—'}`
                  : (members.every(m => m.dados_confirmados) && members.length > 0
                    ? 'Todos os integrantes foram confirmados. Você pode finalizar a equipe agora.'
                    : `Faltam ${members.filter(m => !m.dados_confirmados).length} integrantes para serem confirmados individualmente.`)}
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
              {isConfirming ? <Loader className="animate-spin" size={16} /> : 'Finalizar Confirmação da Equipe'}
            </button>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div className="card" style={{ flex: '1 1 140px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            backgroundColor: 'rgba(37, 99, 235, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)',
          }}>
            <Users size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>{members.length}</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: 600, textTransform: 'uppercase' }}>Membros</div>
          </div>
        </div>
        <div className="card" style={{ flex: '1 1 140px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            backgroundColor: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b',
          }}>
            <Shield size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>{members.filter(m => m.coordenador).length}</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: 600, textTransform: 'uppercase' }}>Coordenadores</div>
          </div>
        </div>
      </div>

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {members.map((m) => {
            const p = m.pessoas;
            const address = [p.endereco, p.numero, p.bairro, p.cidade, p.estado]
              .map(v => v?.trim())
              .filter(Boolean)
              .join(', ');
            const memberOrders = pedidosCamisetas.filter(pc => pc.participacao_id === m.id);

            return (
              <div
                key={m.id}
                className="card animate-fade-in"
                style={{
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.5rem',
                  position: 'relative',
                  borderLeft: m.coordenador ? '4px solid #f59e0b' : '1px solid var(--border-color)',
                }}
              >
                {/* Header: Basic Info and Right-side Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flex: 1, minWidth: 0 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>{p.nome_completo}</h3>
                        {m.coordenador && (
                          <span className="badge badge-primary" style={{ fontSize: '0.65rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: 'none' }}>
                            COORDENADOR
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', opacity: 0.8, fontSize: '0.85rem', width: '100%' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', rowGap: '0.3rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Phone size={16} style={{ color: 'var(--primary-color)', opacity: 0.8 }} />
                            {formatTelefone(p.telefone)}
                          </span>
                          {p.email && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', letterSpacing: '0.05rem' }}>
                              <Mail size={16} style={{ color: 'var(--primary-color)', opacity: 0.8 }} />
                              {p.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {m.dados_confirmados ? (
                      <span className="badge badge-success" style={{
                        fontSize: '0.65rem',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        color: '#10b981',
                        border: 'none',
                        padding: '0.5rem 0.75rem',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        <CheckCircle size={14} style={{ marginRight: '4px' }} /> CONFIRMADO
                      </span>
                    ) : (
                      <button
                        onClick={() => handleConfirmOneMember(m.id)}
                        className="btn-icon"
                        title="Confirmar integrante"
                        style={{
                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                          color: '#10b981',
                          padding: '0.5rem',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '32px',
                          height: '32px'
                        }}
                      >
                        <Check size={18} />
                      </button>
                    )}
                    <button
                      onClick={() => setEditingPessoa(p)}
                      className="btn-icon"
                      style={{
                        backgroundColor: 'rgba(0,0,0,0.05)',
                        padding: '0.5rem',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '32px',
                        height: '32px'
                      }}
                      title="Editar Dados"
                    >
                      <Pencil size={18} />
                    </button>
                  </div>
                </div>

                {/* Full-width Address */}
                {address && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    width: '100%',
                    opacity: 0.8,
                    fontSize: '0.85rem',
                    marginTop: '-0.85rem'
                  }}>
                    <MapPin size={16} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--primary-color)', opacity: 0.8 }} />
                    <span style={{ flex: 1, lineHeight: '1.5', letterSpacing: '0.05rem' }}>{address}</span>
                  </div>
                )}

                {/* Body: 3-column Grid (Taxa, Camisetas, Recepção) */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '0.6fr 1.4fr 1.4fr',
                  gap: '1.25rem',
                  paddingTop: '1.25rem',
                  borderTop: '1px solid var(--border-color)'
                }}>
                  {/* Taxa Section */}
                  <div style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'row' : 'column',
                    alignItems: isMobile ? 'center' : 'flex-start',
                    justifyContent: isMobile ? 'space-between' : 'flex-start',
                    gap: isMobile ? '1rem' : '0.75rem',
                    padding: '1rem',
                    backgroundColor: 'rgba(var(--primary-rgb, 37, 99, 235), 0.03)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    minHeight: isMobile ? 'auto' : '150px'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.5, letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                        Taxa
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: m.pago_taxa ? '#10b981' : 'var(--text-color)' }}>
                        {formatBRL(valorTaxa)}
                      </div>
                    </div>

                    <button
                      onClick={() => handleTogglePayment(m)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: isMobile ? '0.4rem 0.8rem' : '0.6rem 1rem',
                        width: isMobile ? 'auto' : '100%',
                        justifyContent: 'center',
                        borderRadius: '10px',
                        border: m.pago_taxa ? 'none' : '2px dashed var(--border-color)',
                        backgroundColor: m.pago_taxa ? '#10b981' : 'transparent',
                        color: m.pago_taxa ? '#fff' : 'var(--text-color)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        textTransform: 'uppercase'
                      }}
                    >
                      <DollarSign size={14} />
                      {m.pago_taxa ? 'Pago' : 'Marcar'}
                    </button>
                  </div>

                  {/* Camisetas Section */}
                  <div style={{
                    padding: '1rem',
                    backgroundColor: 'var(--secondary-bg)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    minHeight: '150px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.5, letterSpacing: '0.05em' }}>
                        Camisetas
                      </div>
                      {!addingShirtToMemberId && (
                        <button
                          onClick={() => setAddingShirtToMemberId(m.id)}
                          className="btn-text"
                          style={{
                            padding: '0 0.5rem',
                            fontSize: '0.6rem',
                            fontWeight: 600,
                            color: 'var(--primary-color)',
                            letterSpacing: '0.05em',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <ShirtIcon size={14} />
                            SOLICITAR
                          </div>
                        </button>
                      )}
                    </div>

                    {addingShirtToMemberId === m.id ? (
                      <div className="animate-fade-in" style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.6rem',
                        padding: '0.75rem',
                        backgroundColor: 'rgba(0,0,0,0.03)',
                        borderRadius: '10px'
                      }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <select
                            value={newShirtData.modelo_id}
                            onChange={e => setNewShirtData({ ...newShirtData, modelo_id: e.target.value })}
                            className="form-input"
                            style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }}
                          >
                            {modelosCamiseta.map(mod => (
                              <option key={mod.id} value={mod.id}>{mod.nome}</option>
                            ))}
                          </select>
                          <select
                            value={newShirtData.tamanho}
                            onChange={e => setNewShirtData({ ...newShirtData, tamanho: e.target.value })}
                            className="form-input"
                            style={{ width: '60px', padding: '0.4rem', fontSize: '0.8rem' }}
                          >
                            {['P', 'M', 'G', 'GG', 'XG'].map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          <button onClick={() => setAddingShirtToMemberId(null)} className="btn-text" style={{ fontSize: '0.75rem' }}>Canc.</button>
                          <button onClick={() => handleAddShirt(m.id)} disabled={isSaving} className="btn-primary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.75rem' }}>Salvar</button>
                        </div>
                      </div>
                    ) : memberOrders.length === 0 ? (
                      <div style={{ height: '32px', display: 'flex', alignItems: 'center', fontSize: '0.8rem', opacity: 0.4, fontStyle: 'italic' }}>
                        Nenhum pedido
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ textAlign: 'left', opacity: 0.5 }}>
                              <th style={{ padding: '0.35rem 0.25rem', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem' }}>Mod</th>
                              <th style={{ padding: '0.35rem 0.25rem', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem' }}>T</th>
                              <th style={{ padding: '0.35rem 0.25rem', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem' }}>Q</th>
                              <th style={{ width: '20px' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {memberOrders.map((order) => (
                              <tr key={order.id} style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                                <td style={{ padding: '0.4rem 0.25rem' }}>{order.camiseta_modelos?.nome}</td>
                                <td style={{ padding: '0.4rem 0.25rem' }}>{order.tamanho}</td>
                                <td style={{ padding: '0.4rem 0.25rem' }}>{order.quantidade}</td>
                                <td style={{ padding: '0.25rem', textAlign: 'right' }}>
                                  <button onClick={() => handleDeleteShirt(order.id)} style={{ background: 'none', border: 'none', color: '#ef4444', opacity: 0.4, cursor: 'pointer' }}><X size={12} /></button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Recepção Section */}
                  <div style={{
                    padding: '1rem',
                    backgroundColor: 'var(--surface-2)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    minHeight: '150px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', opacity: 0.5, letterSpacing: '0.05em' }}>
                        Recepção
                      </div>
                      <button
                        onClick={() => {
                          setRecepcaoParticipacaoId(m.id);
                          setRecepcaoParticipanteNome(p.nome_completo || '');
                        }}
                        className="btn-text"
                        style={{
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.6rem',
                          fontWeight: 600,
                          color: 'var(--primary-color)',
                          letterSpacing: '0.05em',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Car size={16} />
                          {m.recepcao_dados ? (
                            'EDITAR'
                          ) : (
                            'CADASTRAR'
                          )}
                        </div>
                      </button>
                    </div>

                    {!m.recepcao_dados ? (
                      <div style={{ height: '32px', display: 'flex', alignItems: 'center', fontSize: '0.8rem', opacity: 0.4, fontStyle: 'italic' }}>
                        Não cadastrado
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ textAlign: 'left', opacity: 0.5 }}>
                              <th style={{ padding: '0.35rem 0.25rem', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem' }}>Veículo</th>
                              <th style={{ padding: '0.35rem 0.25rem', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem' }}>Cor</th>
                              <th style={{ padding: '0.35rem 0.25rem', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem' }}>Placa</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                              <td style={{ padding: '0.4rem 0.25rem', fontWeight: 600 }}>{m.recepcao_dados.veiculo_modelo}</td>
                              <td style={{ padding: '0.4rem 0.25rem' }}>{m.recepcao_dados.veiculo_cor}</td>
                              <td style={{ padding: '0.4rem 0.25rem' }}>{m.recepcao_dados.veiculo_placa}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <RecepcaoDadosModal
        isOpen={!!recepcaoParticipacaoId}
        onClose={() => setRecepcaoParticipacaoId(null)}
        participacaoId={recepcaoParticipacaoId || ''}
        participanteNome={recepcaoParticipanteNome}
        equipeNome={equipeNome}
      />
    </>
  );
}
