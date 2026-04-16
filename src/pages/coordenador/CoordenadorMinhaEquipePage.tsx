import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { pessoaService } from '../../services/pessoaService';
import { PessoaForm } from '../../components/pessoa/PessoaForm';
import type { PessoaFormData, Pessoa } from '../../types/pessoa';
import {
  Users, Loader, ChevronLeft, Shield, Pencil, Download, FileText, FileSpreadsheet,
  Phone, Mail, MapPin, User, CheckCircle, AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { inscricaoService } from '../../services/inscricaoService';
import { equipeService } from '../../services/equipeService';
import { exportConfigService } from '../../services/exportConfigService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface EquipeMember {
  id: string;
  pessoa_id: string;
  coordenador: boolean;
  participante: boolean;
  dados_confirmados: boolean;
  pessoas: Pessoa;
}

function formatTelefone(tel: string | null | undefined) {
  if (!tel) return '—';
  const d = tel.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel;
}

function formatDate(date: string | null | undefined) {
  if (!date) return '—';
  try {
    const d = new Date(date + 'T00:00:00');
    return d.toLocaleDateString('pt-BR');
  } catch {
    return date;
  }
}

function getInitials(name: string | null | undefined) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('');
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
          )
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
  }, [userParticipacao]);

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
    return members.map((m, idx) => {
      const p = m.pessoas;
      const endereco = [p.endereco, p.numero ? `nº ${p.numero}` : '', p.bairro].filter(Boolean).join(', ');
      return {
        '#': idx + 1,
        'Nome Completo': p.nome_completo || '—',
        'Telefone': formatTelefone(p.telefone),
        'E-mail': p.email || '—',
        'Data de Nascimento': formatDate(p.data_nascimento),
        'Comunidade': p.comunidade || '—',
        'Endereço': endereco || '—',
        'Cidade': p.cidade || '—',
        'Função': m.coordenador ? 'Coordenador' : 'Membro',
      };
    });
  };

  const handleExportPDF = async () => {
    const data = getExportData();
    if (data.length === 0) {
      toast.error('Nenhum registro para exportar.');
      return;
    }
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
      if (config.imagem_esq_base64) {
        try { doc.addImage(config.imagem_esq_base64, 'PNG', 14, 10, 30, 30); } catch { /* ignore */ }
      }
      if (config.imagem_dir_base64) {
        try { doc.addImage(config.imagem_dir_base64, 'PNG', 253, 10, 30, 30); } catch { /* ignore */ }
      }
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(config.titulo || '', 148.5, 18, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(config.subtitulo || '', 148.5, 24, { align: 'center' });
      doc.text(config.tema || '', 148.5, 30, { align: 'center' });
      if (config.observacoes) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.text(config.observacoes, 148.5, 38, { align: 'center' });
        startY = 58;
      } else {
        startY = 52;
      }
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      const title = `Equipe: ${equipeNome || 'Minha Equipe'}`;
      doc.text(title, 14, startY - 6);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} • Total: ${data.length} membro(s)`, 14, startY + 2);
      doc.setTextColor(0);
      startY += 8;
    } else {
      const title = `Equipe: ${equipeNome || 'Minha Equipe'}`;
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(title, 14, 18);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} • Total: ${data.length} membro(s)`, 14, 24);
      doc.setTextColor(0);
    }
    const columns = ['#', 'Nome Completo', 'Telefone', 'E-mail', 'Nasc.', 'Comunidade', 'Endereço', 'Cidade', 'Função'];
    const rows = data.map(d => [
      d['#'],
      d['Nome Completo'],
      d['Telefone'],
      d['E-mail'],
      d['Data de Nascimento'],
      d['Comunidade'],
      d['Endereço'],
      d['Cidade'],
      d['Função'],
    ]);
    autoTable(doc, {
      head: [columns],
      body: rows,
      startY: startY,
      styles: {
        fontSize: 7.5,
        cellPadding: 2.5,
        lineColor: [220, 220, 220],
        lineWidth: 0.25,
      },
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250],
      },
      margin: { left: 14, right: 14 },
    });
    const fileName = `equipe_${equipeNome?.replace(/\s+/g, '_') || 'minha_equipe'}.pdf`;
    doc.save(fileName);
    toast.success('PDF exportado com sucesso!');
    setShowExportMenu(false);
  };

  const handleExportExcel = async () => {
    const data = getExportData();
    if (data.length === 0) {
      toast.error('Nenhum registro para exportar.');
      return;
    }
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
        [config.titulo],
        [config.subtitulo],
        [config.tema],
        [config.observacoes || ''],
        [`Equipe: ${equipeNome || 'Minha Equipe'} - Gerado em: ${new Date().toLocaleDateString('pt-BR')}`]
      ], { origin: 'A1' });
      XLSX.utils.sheet_add_json(ws, data, { origin: 'A6', skipHeader: false });
    } else {
      XLSX.utils.sheet_add_json(ws, data, { origin: 'A1', skipHeader: false });
    }
    ws['!cols'] = [
      { wch: 5 }, { wch: 35 }, { wch: 18 }, { wch: 28 }, { wch: 14 }, { wch: 20 }, { wch: 35 }, { wch: 16 }, { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Equipe');
    const fileName = `equipe_${equipeNome?.replace(/\s+/g, '_') || 'minha_equipe'}.xlsx`;
    XLSX.writeFile(wb, fileName);
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {members.map((m) => {
            const p = m.pessoas;
            const address = [p.endereco, p.numero ? `nº ${p.numero}` : '', p.bairro, p.cidade].filter(Boolean).join(', ');
            return (
              <div
                key={m.id}
                className="card"
                style={{
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  borderLeft: m.coordenador ? '3px solid #f59e0b' : '3px solid transparent',
                }}
              >
                <div style={{
                  width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
                  background: m.coordenador ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'var(--primary-color)',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '1rem',
                }}>
                  {getInitials(p.nome_completo)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>{p.nome_completo}</h3>
                    {m.coordenador && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                        padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
                        backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b',
                      }}>
                        <Shield size={10} /> Coordenador
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.5rem', fontSize: '0.85rem', opacity: 0.7 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Phone size={13} /> {formatTelefone(p.telefone)}
                    </span>
                    {p.email && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Mail size={13} /> {p.email}
                      </span>
                    )}
                    {p.data_nascimento && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <User size={13} /> {formatDate(p.data_nascimento)}
                      </span>
                    )}
                    {address && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <MapPin size={13} /> {address}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, marginTop: '0.25rem' }}>
                  {!m.dados_confirmados && (
                    <button
                      onClick={() => handleConfirmOneMember(m.id)}
                      className="icon-btn"
                      title="Confirmar integrante"
                      style={{ color: 'var(--success-color, #10b981)' }}
                    >
                      <CheckCircle size={18} />
                    </button>
                  )}
                  {m.dados_confirmados && (
                    <div
                      className="status-badge status-badge--success"
                      title="Dados confirmados"
                      style={{
                        padding: '0.25rem 0.6rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        color: '#10b981',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        border: '1px solid rgba(16, 185, 129, 0.2)'
                      }}
                    >
                      <CheckCircle size={14} />
                      Confirmado
                    </div>
                  )}
                  <button
                    onClick={() => setEditingPessoa(p)}
                    className="icon-btn"
                    title="Editar dados"
                    aria-label={`Editar ${p.nome_completo}`}
                  >
                    <Pencil size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showExportMenu && (
        <div
          onClick={() => setShowExportMenu(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 98 }}
        />
      )}
    </>
  );
}
