import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { pessoaService } from '../../services/pessoaService';
import { Header } from '../../components/Header';
import { PessoaForm } from '../../components/pessoa/PessoaForm';
import type { PessoaFormData, Pessoa } from '../../types/pessoa';
import {
  Users, Loader, ChevronLeft, Shield, Pencil, Download, FileText, FileSpreadsheet,
  Phone, Mail, MapPin, User, CheckCircle, AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { inscricaoService } from '../../services/inscricaoService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface EquipeMember {
  id: string;
  pessoa_id: string;
  coordenador: boolean;
  participante: boolean;
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
  const { userParticipacao, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState<EquipeMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [equipeNome, setEquipeNome] = useState('');
  const [editingPessoa, setEditingPessoa] = useState<Pessoa | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const loadMembers = useCallback(async () => {
    if (!userParticipacao) {
      setLoading(false);
      return;
    }

    try {
      // Get the equipe name
      if (userParticipacao.equipes?.nome) {
        setEquipeNome(userParticipacao.equipes.nome);
      }

      // Find all members with the same equipe_id in the same encontro
      const { data, error } = await supabase
        .from('participacoes')
        .select(`
          id,
          pessoa_id,
          coordenador,
          participante,
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

      // Type the data correctly so 'pessoas' is seen as a single object (Pessoa), not an array
      const typedData = (data as unknown as EquipeMember[]) || [];

      const sortedData = typedData.sort((a, b) => {
        // First sort: coordinators first
        if (a.coordenador && !b.coordenador) return -1;
        if (!a.coordenador && b.coordenador) return 1;

        // Second sort: alphabetical string comparison using localeCompare
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
      await pessoaService.atualizar(editingPessoa.id, data);
      toast.success('Dados atualizados com sucesso!');
      setEditingPessoa(null);
      // Reload members
      setLoading(true);
      await loadMembers();
    } catch {
      toast.error('Erro ao salvar alterações.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmData = async () => {
    if (!userParticipacao) return;

    setIsConfirming(true);
    try {
      await inscricaoService.confirmarDados(userParticipacao.id);
      toast.success('Dados da equipe confirmados com sucesso!');
      await refreshProfile();
    } catch (error) {
      console.error('Erro ao confirmar dados:', error);
      toast.error('Erro ao confirmar dados da equipe.');
    } finally {
      setIsConfirming(false);
    }
  };

  // ─── Export helpers ────────────────────────────────────────────
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

  const handleExportPDF = () => {
    const data = getExportData();
    if (data.length === 0) {
      toast.error('Nenhum registro para exportar.');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const title = `Equipe: ${equipeNome || 'Minha Equipe'}`;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, 18);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} • Total: ${data.length} membro(s)`, 14, 24);
    doc.setTextColor(0);

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
      startY: 30,
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

  const handleExportExcel = () => {
    const data = getExportData();
    if (data.length === 0) {
      toast.error('Nenhum registro para exportar.');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [
      { wch: 5 },   // #
      { wch: 35 },  // Nome
      { wch: 18 },  // Telefone
      { wch: 28 },  // E-mail
      { wch: 14 },  // Nasc
      { wch: 20 },  // Comunidade
      { wch: 35 },  // Endereço
      { wch: 16 },  // Cidade
      { wch: 14 },  // Função
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Equipe');

    const fileName = `equipe_${equipeNome?.replace(/\s+/g, '_') || 'minha_equipe'}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success('Excel exportado com sucesso!');
    setShowExportMenu(false);
  };

  // ─── Render ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="app-shell">
        <Header />
        <main className="main-content container">
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
            <Loader className="animate-spin" size={32} />
          </div>
        </main>
      </div>
    );
  }

  // Edit mode
  if (editingPessoa) {
    return (
      <div className="app-shell">
        <Header />
        <main className="main-content container">
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
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Header />
      <main className="main-content container">
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
            {/* Confirmation status for coordinators */}
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

            {/* Export Button */}
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

          {/* Confirmation Status Card */}
          {userParticipacao?.coordenador && (
            <div className="card animate-fade-in" style={{
              marginBottom: '1.5rem',
              padding: '1.25rem',
              background: userParticipacao.dados_confirmados ? 'rgba(16, 185, 129, 0.05)' : 'rgba(245, 158, 11, 0.05)',
              border: `1px solid ${userParticipacao.dados_confirmados ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
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
                  backgroundColor: userParticipacao.dados_confirmados ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: userParticipacao.dados_confirmados ? '#10b981' : '#f59e0b',
                }}>
                  {userParticipacao.dados_confirmados ? <CheckCircle size={22} /> : <AlertCircle size={22} />}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                    {userParticipacao.dados_confirmados ? 'Dados Confirmados' : 'Confirmação Pendente'}
                  </h3>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
                    {userParticipacao.dados_confirmados
                      ? `Confirmado em ${formatDate(userParticipacao.confirmado_em?.split('T')[0])} às ${userParticipacao.confirmado_em?.split('T')[1].slice(0, 5)}`
                      : 'Por favor, revise os dados de todos os membros e confirme abaixo.'}
                  </p>
                </div>
              </div>

              {!userParticipacao.dados_confirmados && (
                <button
                  onClick={handleConfirmData}
                  disabled={isConfirming || members.length === 0}
                  className="btn-primary show-mobile-full-width"
                  style={{
                    fontSize: '0.85rem',
                    padding: '0.6rem 1.25rem',
                    backgroundColor: '#10b981',
                    borderColor: '#10b981',
                  }}
                >
                  {isConfirming ? <Loader className="animate-spin" size={16} /> : 'Confirmar todos os dados'}
                </button>
              )}
            </div>
          )}

          {/* Stats */}
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

          {/* No participation */}
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
                    {/* Avatar */}
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
                      background: m.coordenador ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'var(--primary-color)',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: '1rem',
                    }}>
                      {getInitials(p.nome_completo)}
                    </div>

                    {/* Info */}
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

                      {/* Contact details */}
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

                    {/* Edit button */}
                    <button
                      onClick={() => setEditingPessoa(p)}
                      className="icon-btn"
                      title="Editar dados"
                      aria-label={`Editar ${p.nome_completo}`}
                      style={{ flexShrink: 0, marginTop: '0.25rem' }}
                    >
                      <Pencil size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
      </main>

      {/* Close export menu on click outside */}
      {showExportMenu && (
        <div
          onClick={() => setShowExportMenu(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 98 }}
        />
      )}
    </div>
  );
}
