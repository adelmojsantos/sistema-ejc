import { Loader } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import logoEjc from '../../assets/logo-ejc.svg';
import { FormField } from '../../components/ui/FormField';
import { useExternalAccess } from '../../hooks/useExternalAccess';
import { encontroService } from '../../services/encontroService';
import { equipeService } from '../../services/equipeService';
import type { Encontro } from '../../types/encontro';
import type { Equipe } from '../../types/equipe';

export default function FormAccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const encontro_id = searchParams.get('encontro');

  const { validateAndAccess, isValidating, isAuthenticated } = useExternalAccess();

  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [encontro, setEncontro] = useState<Encontro | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [formData, setFormData] = useState({
    equipe_id: '',
    nome: '',
    telefone_fim: '',
  });

  useEffect(() => {
    if (isAuthenticated) {
      navigate(`/formulario/recepcao`);
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    async function loadData() {
      if (!encontro_id) {
        setIsLoadingData(false);
        return;
      }
      try {
        const [equipesList, encontrosList] = await Promise.all([
          equipeService.listar(),
          encontroService.listar()
        ]);
        setEquipes(equipesList);
        const current = encontrosList.find(e => e.id === encontro_id);
        setEncontro(current || null);
      } catch (error) {
        console.error('Erro ao carregar dados do encontro:', error);
      } finally {
        setIsLoadingData(false);
      }
    }
    loadData();
  }, [encontro_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!encontro_id) return;

    await validateAndAccess({
      encontro_id,
      equipe_id: formData.equipe_id,
      nome: formData.nome,
      telefone_fim: formData.telefone_fim
    });
  };

  if (isLoadingData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-color)' }}>
        <Loader className="animate-spin" size={32} color="var(--primary-color)" />
      </div>
    );
  }

  if (!encontro_id || !encontro || !encontro.formulario_publico_ativo) {
    return (
      <div className="container" style={{ maxWidth: '500px', marginTop: '10vh', textAlign: 'center' }}>
        <div className="card">
          <h2 style={{ color: 'var(--danger-text)' }}>Link Inválido ou Inativo</h2>
          <p style={{ opacity: 0.7 }}>Este formulário não está disponível no momento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{
      minHeight: '100vh',
      background: 'var(--bg-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem'
    }}>
      <div className="card" style={{ maxWidth: '500px', width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <img src={logoEjc} alt="Logo" className="public-logo-img" style={{ height: '80px', width: 'auto', marginBottom: '1rem' }} />
          </div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Identificação</h1>
          <p style={{ opacity: 0.6, fontSize: '0.875rem' }}>
            {encontro.nome}<br />
            Por favor, valide seus dados para acessar o formulário.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          <div className="form-group">
            <label className="form-label">Equipe</label>
            <select
              className="form-input"
              required
              value={formData.equipe_id}
              onChange={e => setFormData({ ...formData, equipe_id: e.target.value })}
            >
              <option value="">Selecione sua equipe...</option>
              {equipes.map(eq => (
                <option key={eq.id} value={eq.id}>{eq.nome}</option>
              ))}
            </select>
          </div>

          <FormField
            label="Nome"
            required
            placeholder="Como está no cadastro"
            value={formData.nome}
            onChange={e => setFormData({ ...formData, nome: e.target.value })}
          />

          <FormField
            label="Telefone (com ou sem DDD)"
            required
            placeholder="Ex: 11987654321 ou 87654321"
            value={formData.telefone_fim}
            onChange={e => setFormData({ ...formData, telefone_fim: e.target.value.replace(/\D/g, '') })}
          />

          <button
            type="submit"
            className="btn-primary"
            style={{ marginTop: '0.5rem', height: '48px', fontSize: '1rem' }}
            disabled={isValidating}
          >
            {isValidating ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Loader className="animate-spin" size={20} />
                <span>Validando...</span>
              </div>
            ) : (
              'Acessar Formulário'
            )}
          </button>
        </form>

        <p style={{ marginTop: '2rem', fontSize: '0.75rem', textAlign: 'center', opacity: 0.5 }}>
          Em caso de dúvidas, procure a coordenação de sua equipe.
        </p>
      </div>
    </div>
  );
}
