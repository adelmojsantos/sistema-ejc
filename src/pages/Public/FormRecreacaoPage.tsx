import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExternalAccess } from '../../hooks/useExternalAccess';
import { recreacaoService } from '../../services/recreacaoService';
import { equipeService } from '../../services/equipeService';
import { inscricaoService } from '../../services/inscricaoService';
import { FormField } from '../../components/ui/FormField';
import { Loader, Baby, Car, CheckCircle, LogOut, Plus, Trash2, Pencil, Users } from 'lucide-react';
import logoEjc from '../../assets/logo-ejc.svg';
import { toast } from 'react-hot-toast';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import type { RecreacaoDados, RecreacaoDadosFormData } from '../../types/recreacao';
import type { Equipe } from '../../types/equipe';
import type { InscricaoEnriched } from '../../types/inscricao';

export default function FormRecreacaoPage() {
  const navigate = useNavigate();
  const { session, isAuthenticated, isSessionLoading, logout } = useExternalAccess();
  
  const [children, setChildren] = useState<RecreacaoDados[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const [allEquipes, setAllEquipes] = useState<Equipe[]>([]);
  const [allParticipantes, setAllParticipantes] = useState<InscricaoEnriched[]>([]);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<RecreacaoDadosFormData>({
    nome_crianca: '',
    idade: 0,
    outro_responsavel_id: '',
    observacoes: ''
  });

  useEffect(() => {
    if (!isSessionLoading && !isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, isSessionLoading, navigate]);

  const loadInitialData = async () => {
    if (!session?.encontro_id) return;
    
    try {
      const [equipes, participantes] = await Promise.all([
        equipeService.listar(),
        inscricaoService.listarPorEncontro(session.encontro_id)
      ]);
      setAllEquipes(equipes);
      setAllParticipantes(participantes);
      
      // Default team to current participant's team if not already set
      if (session.participacoes?.equipe_id) {
        setSelectedTeamId(session.participacoes.equipe_id);
      }
    } catch (error) {
      console.error('Erro ao carregar dados auxiliares:', error);
    }
  };

  const loadData = async () => {
    if (session?.participacao_id) {
      try {
        const data = await recreacaoService.listarPorResponsavel(session.participacao_id);
        setChildren(data);
      } catch (error) {
        console.error('Erro ao carregar crianças:', error);
        toast.error('Erro ao carregar dados.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    loadData();
    loadInitialData();
  }, [session]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.participacao_id) return;

    setIsSubmitting(true);
    try {
      await recreacaoService.salvar(session.participacao_id, formData, editingId || undefined);
      toast.success(editingId ? 'Dados atualizados!' : 'Criança cadastrada com sucesso!');
      await loadData();
      resetForm();
    } catch (error) {
      console.error('Erro ao salvar dados:', error);
      toast.error('Erro ao salvar os dados.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (child: RecreacaoDados) => {
    setFormData({
      nome_crianca: child.nome_crianca,
      idade: child.idade,
      outro_responsavel_id: child.outro_responsavel_id || '',
      observacoes: child.observacoes || ''
    });
    
    if (child.outro_responsavel?.equipe_id) {
      setSelectedTeamId(child.outro_responsavel.equipe_id);
    }
    
    setEditingId(child.id);
    setShowForm(true);
  };

  const handleDeleteClick = (id: string) => {
    setIdToDelete(id);
  };

  const confirmDelete = async () => {
    if (!idToDelete) return;
    setIsDeleting(true);
    try {
      await recreacaoService.excluir(idToDelete);
      toast.success('Cadastro removido.');
      await loadData();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast.error('Erro ao excluir.');
    } finally {
      setIsDeleting(false);
      setIdToDelete(null);
    }
  };

  const resetForm = () => {
    setFormData({
      nome_crianca: '',
      idade: 0,
      outro_responsavel_id: '',
      observacoes: ''
    });
    setSelectedTeamId(session?.participacoes?.equipe_id || '');
    setEditingId(null);
    setShowForm(false);
  };

  const filteredParticipantes = allParticipantes
    .filter(p => !selectedTeamId || p.equipe_id === selectedTeamId)
    .filter(p => p.id !== session?.participacao_id) // Don't list self as second responsible
    .sort((a, b) => (a.pessoas?.nome_completo || '').localeCompare(b.pessoas?.nome_completo || ''));

  if (isSessionLoading || isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-color)' }}>
        <Loader className="animate-spin" size={32} color="var(--primary-color)" />
      </div>
    );
  }

  if (session && !session.participacoes?.dados_confirmados) {
    return (
      <div className="fade-in" style={{ 
        minHeight: '100vh', 
        background: 'var(--bg-color)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '1.5rem'
      }}>
        <div className="card" style={{ maxWidth: '450px', width: '100%', textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ 
            width: '80px', height: '80px', borderRadius: '50%', 
            backgroundColor: 'rgba(245, 158, 11, 0.1)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#f59e0b', margin: '0 auto 1.5rem auto'
          }}>
            <Loader size={48} className="animate-pulse" />
          </div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>Aguardando Confirmação</h1>
          <p style={{ opacity: 0.7, marginBottom: '2rem' }}>
            Seus dados básicos ainda não foram confirmados pelo coordenador da sua equipe.<br/><br/>
            Por favor, <strong>solicite a confirmação</strong> para que você possa preencher este formulário.
          </p>
          <button 
            onClick={() => { logout(); navigate('/'); }} 
            className="btn-secondary"
            style={{ width: '100%' }}
          >
            Sair e Voltar
          </button>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="fade-in" style={{ 
        minHeight: '100vh', 
        background: 'var(--bg-color)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '1.5rem'
      }}>
        <div className="card" style={{ maxWidth: '450px', width: '100%', textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ 
            width: '80px', height: '80px', borderRadius: '50%', 
            backgroundColor: 'rgba(16, 185, 129, 0.1)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#10b981', margin: '0 auto 1.5rem auto'
          }}>
            <CheckCircle size={48} />
          </div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>Concluído!</h1>
          <p style={{ opacity: 0.7, marginBottom: '2rem' }}>
            Os dados de recreação foram registrados com sucesso.
          </p>
          <button 
            onClick={() => setIsSuccess(false)} 
            className="btn-primary"
            style={{ width: '100%', marginBottom: '0.75rem' }}
          >
            Gerenciar Crianças
          </button>
          <button 
            onClick={() => navigate('/formulario/recepcao')} 
            className="btn-secondary"
            style={{ width: '100%', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <Car size={18} />
            Preencher Recepção
          </button>
          <button 
            onClick={() => { logout(); navigate('/'); }} 
            className="btn-text"
            style={{ width: '100%', opacity: 0.6 }}
          >
            Sair e Finalizar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ paddingBottom: '3rem', minHeight: '100vh', background: 'var(--bg-color)' }}>
      {/* Header */}
      <div style={{ 
        padding: '1rem 1.5rem', 
        background: 'var(--card-bg)', 
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <img src={logoEjc} alt="Logo" className="public-logo-img" style={{ height: '32px', width: 'auto' }} />
          <div>
            <h2 style={{ fontSize: '1rem', margin: 0 }}>Recreação Infantil</h2>
            <p style={{ fontSize: '0.75rem', opacity: 0.5, margin: 0 }}>{session?.participacoes?.equipes?.nome}</p>
          </div>
        </div>
        <button onClick={logout} className="icon-btn" title="Sair">
          <LogOut size={18} />
        </button>
      </div>

      {/* Navigation Tabs - Pill Style */}
      <div style={{
        background: 'var(--card-bg)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'center',
        padding: '0.75rem 1rem'
      }}>
        <div style={{ 
          display: 'flex', 
          backgroundColor: 'rgba(var(--primary-rgb), 0.05)', 
          padding: '4px',
          borderRadius: '12px',
          gap: '4px',
          border: '1px solid var(--border-color)',
          width: '100%',
          maxWidth: '500px'
        }}>
          <button 
            onClick={() => navigate('/formulario/recepcao')}
            style={{
              flex: 1,
              padding: '0.6rem 0.5rem',
              borderRadius: '10px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-color)',
              opacity: 0.7,
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <Car size={16} />
            Recepção
          </button>
          <button 
            onClick={() => navigate('/formulario/recreacao')}
            style={{
              flex: 1,
              padding: '0.6rem 0.5rem',
              borderRadius: '10px',
              border: 'none',
              background: 'var(--primary-color)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(var(--primary-rgb), 0.2)'
            }}
          >
            <Baby size={16} />
            Recreação
          </button>
        </div>
      </div>

      <div className="container" style={{ maxWidth: '600px', marginTop: '2rem' }}>
        <div style={{ 
          padding: '1rem', 
          backgroundColor: 'rgba(var(--primary-rgb, 0, 0, 254), 0.04)', 
          borderRadius: '8px', 
          border: '1px solid var(--border-color)',
          marginBottom: '1rem',
          textAlign: 'center'
        }}>
          <p style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Olá, {session?.participacoes?.pessoas?.nome_completo}!</p>
        </div>
        {!showForm ? (
          <>
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', opacity: 0.8 }}>
                  <Baby size={24} color="var(--primary-color)" />
                  <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Crianças Cadastradas</h2>
                </div>
                <button 
                  onClick={() => setShowForm(true)} 
                  className="btn-primary"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus size={16} /> Adicionar
                </button>
              </div>

              {children.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', opacity: 0.5 }}>
                  <Users size={48} style={{ margin: '0 auto 1rem auto', display: 'block' }} />
                  <p>Nenhuma criança cadastrada ainda.</p>
                  <p style={{ fontSize: '0.875rem' }}>Clique em "Adicionar" para começar.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {children.map(child => (
                    <div key={child.id} style={{ 
                      padding: '1rem', 
                      borderRadius: '8px', 
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'rgba(255,255,255,0.02)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start'
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
                          <h3 style={{ fontSize: '1rem', margin: 0 }}>{child.nome_crianca}</h3>
                          {child.participacao_id !== session?.participacao_id && (
                            <span style={{ 
                              fontSize: '0.7rem', 
                              backgroundColor: 'rgba(var(--primary-rgb), 0.1)',
                              color: 'var(--primary-color)',
                              padding: '2px 8px',
                              borderRadius: '99px',
                              fontWeight: 600
                            }}>
                              Somente Leitura
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: '0.875rem', opacity: 0.6, margin: 0 }}>{child.idade} anos</p>
                        
                        {child.participacao_id !== session?.participacao_id && (
                          <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>
                              Resp. Primário: <strong>{child.participacoes?.pessoas?.nome_completo}</strong>
                            </span>
                            <span style={{ 
                              fontSize: '0.7rem', 
                              backgroundColor: 'var(--secondary-bg)',
                              color: 'var(--muted-text)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 600,
                              border: '1px solid var(--border-color)'
                            }}>
                              {child.participacoes?.equipes?.nome}
                            </span>
                          </div>
                        )}

                        {child.outro_responsavel && child.participacao_id === session?.participacao_id && (
                          <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>
                              2º Responsável: <strong>{child.outro_responsavel.pessoas?.nome_completo}</strong>
                            </span>
                            <span style={{ 
                              fontSize: '0.7rem', 
                              backgroundColor: 'rgba(var(--primary-rgb), 0.1)',
                              color: 'var(--primary-color)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 600
                            }}>
                              {child.outro_responsavel.equipes?.nome}
                            </span>
                          </div>
                        )}
                      </div>

                      {child.participacao_id === session?.participacao_id && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            onClick={() => handleEdit(child)}
                            className="icon-btn"
                            title="Editar"
                            style={{ color: 'var(--primary-color)' }}
                          >
                            <Pencil size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeleteClick(child.id)}
                            className="icon-btn"
                            title="Excluir"
                            style={{ color: '#ef4444' }}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  <div style={{ marginTop: '1rem' }}>
                    <button 
                      onClick={() => setIsSuccess(true)} 
                      className="btn-primary" 
                      style={{ width: '100%', height: '48px' }}
                    >
                      Finalizar Cadastro
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="card">
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Baby size={24} color="var(--primary-color)" />
              {editingId ? 'Editar Criança' : 'Cadastrar Criança'}
            </h2>

            <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <FormField
                label="Nome da Criança"
                required
                placeholder="Nome completo"
                value={formData.nome_crianca}
                onChange={e => setFormData({ ...formData, nome_crianca: e.target.value })}
              />

              <FormField
                label="Idade"
                type="number"
                required
                min={0}
                max={7}
                onInvalid={e => (e.target as HTMLInputElement).setCustomValidity('A idade máxima é 7 anos e 11 meses')}
                onInput={e => (e.target as HTMLInputElement).setCustomValidity('')}
                onBlur={e => {
                  const val = parseInt((e.target as HTMLInputElement).value);
                  if (val > 7) {
                    toast.error('Lembrando: a idade máxima para recreação é 7 anos e 11 meses.', {
                      icon: '🧒',
                      duration: 5000
                    });
                  }
                }}
                value={formData.idade.toString()}
                onChange={e => setFormData({ ...formData, idade: parseInt(e.target.value) || 0 })}
              />

              <div style={{ 
                padding: '1.25rem', 
                backgroundColor: 'rgba(var(--primary-rgb), 0.03)', 
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                <h3 style={{ fontSize: '0.875rem', margin: 0, opacity: 0.7 }}>Segundo Responsável (Opcional)</h3>
                
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Equipe</label>
                  <select 
                    className="form-input"
                    value={selectedTeamId}
                    onChange={e => {
                      setSelectedTeamId(e.target.value);
                      setFormData(prev => ({ ...prev, outro_responsavel_id: '' }));
                    }}
                  >
                    <option value="">Selecione a equipe...</option>
                    {allEquipes.map(eq => (
                      <option key={eq.id} value={eq.id}>{eq.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Nome do Responsável</label>
                  <select 
                    className="form-input"
                    value={formData.outro_responsavel_id || ''}
                    onChange={e => setFormData(prev => ({ ...prev, outro_responsavel_id: e.target.value }))}
                    disabled={!selectedTeamId}
                  >
                    <option value="">Selecione o responsável...</option>
                    {filteredParticipantes.map(p => (
                      <option key={p.id} value={p.id}>{p.pessoas?.nome_completo}</option>
                    ))}
                  </select>
                  {!selectedTeamId && <p style={{ fontSize: '0.7rem', opacity: 0.5, marginTop: '4px' }}>Selecione uma equipe primeiro.</p>}
                  {selectedTeamId && filteredParticipantes.length === 0 && <p style={{ fontSize: '0.7rem', color: 'var(--danger-text)', marginTop: '4px' }}>Nenhum outro participante encontrado nesta equipe.</p>}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Observações / Alergias (Opcional)</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: '100px', resize: 'vertical' }}
                  placeholder="Ex: Alergia a leite, restrições médicas, etc."
                  value={formData.observacoes || ''}
                  onChange={e => setFormData({ ...formData, observacoes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button 
                  type="button" 
                  onClick={resetForm} 
                  className="btn-secondary" 
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn-primary" 
                  style={{ flex: 2, height: '48px' }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <Loader className="animate-spin" size={20} /> : (editingId ? 'Salvar Alterações' : 'Adicionar Criança')}
                </button>
              </div>
            </form>
          </div>
        )}

        <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.875rem', opacity: 0.5 }}>
          As informações de recreação são essenciais para a segurança de seus filhos.
        </p>
      </div>

      <ConfirmDialog
        isOpen={!!idToDelete}
        title="Excluir Cadastro"
        message={
          <>
            Tem certeza que deseja excluir os dados de recreação de <strong>{children.find(c => c.id === idToDelete)?.nome_crianca}</strong>?
            <br />Esta ação não pode ser desfeita.
          </>
        }
        onConfirm={confirmDelete}
        onCancel={() => setIdToDelete(null)}
        isLoading={isDeleting}
        isDestructive={true}
      />
    </div>
  );
}
