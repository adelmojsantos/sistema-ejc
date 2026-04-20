import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExternalAccess } from '../../hooks/useExternalAccess';
import { recepcaoService } from '../../services/recepcaoService';
import { FormField } from '../../components/ui/FormField';
import { RadioGroup } from '../../components/ui/RadioGroup';
import { Loader, Car, CheckCircle, LogOut } from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { RecepcaoDadosFormData } from '../../types/recepcao';

export default function FormPage() {
  const navigate = useNavigate();
  const { session, isAuthenticated, isSessionLoading, logout } = useExternalAccess();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState<RecepcaoDadosFormData>({
    veiculo_tipo: 'carro',
    veiculo_modelo: '',
    veiculo_cor: '',
    veiculo_placa: '',
  });

  useEffect(() => {
    if (!isSessionLoading && !isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, isSessionLoading, navigate]);

  useEffect(() => {
    async function loadExistingData() {
      if (session?.participacao_id) {
        try {
          const existing = await recepcaoService.obterPorParticipacao(session.participacao_id);
          if (existing) {
            setFormData({
              veiculo_tipo: existing.veiculo_tipo,
              veiculo_modelo: existing.veiculo_modelo,
              veiculo_cor: existing.veiculo_cor,
              veiculo_placa: existing.veiculo_placa,
            });
          }
        } catch (error) {
          console.error('Erro ao carregar dados prévios:', error);
        }
      }
    }
    loadExistingData();
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.participacao_id) return;

    setIsSubmitting(true);
    try {
      await recepcaoService.salvar(session.participacao_id, formData);
      toast.success('Dados salvos com sucesso!');
      setIsSuccess(true);
    } catch (error) {
      console.error('Erro ao salvar dados:', error);
      toast.error('Erro ao salvar os dados. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSessionLoading) {
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
          <h1 style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>Tudo pronto!</h1>
          <p style={{ opacity: 0.7, marginBottom: '2rem' }}>
            Seus dados de recepção foram registrados com sucesso. Obrigado pela colaboração!
          </p>
          <button 
            onClick={() => { logout(); navigate('/'); }} 
            className="btn-secondary"
            style={{ width: '100%' }}
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ paddingBottom: '3rem', minHeight: '100vh', background: 'var(--bg-color)' }}>
      {/* Header Mobile / Sticky */}
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
        <div>
          <h2 style={{ fontSize: '1rem', margin: 0 }}>Dados da Recepção</h2>
          <p style={{ fontSize: '0.75rem', opacity: 0.5, margin: 0 }}>{session?.participacoes?.pessoas?.nome_completo}</p>
        </div>
        <button onClick={logout} className="icon-btn" title="Sair">
          <LogOut size={18} />
        </button>
      </div>

      <div className="container" style={{ maxWidth: '600px', marginTop: '2rem' }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', opacity: 0.8 }}>
            <Car size={24} color="var(--primary-color)" />
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Informações do Veículo</h2>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ 
              padding: '1rem', 
              backgroundColor: 'rgba(var(--primary-rgb, 0, 0, 254), 0.04)', 
              borderRadius: '8px', 
              border: '1px solid var(--border-color)',
              marginBottom: '0.5rem'
            }}>
              <p style={{ fontSize: '0.875rem', margin: '0 0 0.5rem 0', opacity: 0.6 }}>Você está preenchendo para a equipe:</p>
              <p style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{session?.participacoes?.equipes?.nome}</p>
            </div>

            <RadioGroup
              label="Tipo de veículo"
              options={[
                { label: 'Carro', value: 'carro' },
                { label: 'Moto', value: 'moto' },
              ]}
              value={formData.veiculo_tipo}
              onChange={val => setFormData({ ...formData, veiculo_tipo: val as 'moto' | 'carro' })}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) minmax(200px, 1fr)', gap: '1rem', flexWrap: 'wrap' }}>
              <FormField
                label="Modelo do veículo"
                required
                placeholder="Ex: Corolla, CG 160"
                value={formData.veiculo_modelo}
                onChange={e => setFormData({ ...formData, veiculo_modelo: e.target.value })}
              />
              <FormField
                label="Cor"
                required
                placeholder="Ex: Prata, Preto"
                value={formData.veiculo_cor}
                onChange={e => setFormData({ ...formData, veiculo_cor: e.target.value })}
              />
            </div>

            <FormField
              label="Placa do veículo"
              required
              placeholder="ABC-1234 ou ABC1D23"
              value={formData.veiculo_placa}
              onChange={e => setFormData({ ...formData, veiculo_placa: e.target.value })}
            />

            <div style={{ marginTop: '1rem' }}>
              <button 
                type="submit" 
                className="btn-primary" 
                style={{ width: '100%', height: '48px', fontSize: '1rem' }}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <Loader className="animate-spin" size={20} />
                    <span>Salvando...</span>
                  </div>
                ) : (
                  'Salvar Dados'
                )}
              </button>
            </div>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.875rem', opacity: 0.5 }}>
          Seus dados são armazenados com segurança.
        </p>
      </div>
    </div>
  );
}
