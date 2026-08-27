import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Loader, Users, ShieldCheck } from 'lucide-react';
import logoEjc from '../../assets/logo-ejc.svg';
import { toast } from 'react-hot-toast';
import { circuloPublicoService, type CirculoPublicParticipante } from '../../services/circuloPublicoService';
import { useCirculoAccess } from '../../hooks/useCirculoAccess';

export default function FormCirculoAccessPage() {
  const { circulo_id: circuloIdParam } = useParams<{ circulo_id: string }>();
  const [searchParams] = useSearchParams();
  const encontro_id = searchParams.get('encontro');
  const navigate = useNavigate();

  const { validateAndAccess, isValidating, isAuthenticated, isLoading } = useCirculoAccess();

  const legacyCirculoId = circuloIdParam ? parseInt(circuloIdParam, 10) : null;
  const isGeneralAccess = !legacyCirculoId;

  const [isLoadingInfo, setIsLoadingInfo] = useState(true);
  const [encontroNome, setEncontroNome] = useState('');
  const [circulos, setCirculos] = useState<Array<{ circulo_id: number; nome: string }>>([]);
  const [selectedCirculoId, setSelectedCirculoId] = useState<number | null>(legacyCirculoId);
  const [circuloNome, setCirculoNome] = useState('');
  const [mediadores, setMediadores] = useState<{ nome: string }[]>([]);
  const [participantes, setParticipantes] = useState<CirculoPublicParticipante[]>([]);
  const [invalid, setInvalid] = useState(false);

  const [selectedParticipacaoId, setSelectedParticipacaoId] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [telefoneFim, setTelefoneFim] = useState('');

  // Se já autenticado, vai direto para a ficha
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/pos-encontro/ficha');
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Carrega informações públicas do círculo
  useEffect(() => {
    async function loadInfo() {
      if (!encontro_id) {
        setInvalid(true);
        setIsLoadingInfo(false);
        return;
      }

      try {
        if (isGeneralAccess) {
          const generalInfo = await circuloPublicoService.obterPesquisaGeneralInfo(encontro_id);
          setEncontroNome(generalInfo.encontro_nome);
          setCirculos(generalInfo.circulos);
          setCirculoNome('');
          setMediadores([]);
          setParticipantes([]);
        } else if (legacyCirculoId) {
          const info = await circuloPublicoService.obterInfo(legacyCirculoId, encontro_id);
          setCirculoNome(info.circulo_nome);
          setMediadores(info.mediadores);
          setParticipantes(info.participantes);
        }
      } catch {
        setInvalid(true);
      } finally {
        setIsLoadingInfo(false);
      }
    }
    loadInfo();
  }, [encontro_id, isGeneralAccess, legacyCirculoId]);

  useEffect(() => {
    if (!isGeneralAccess || !selectedCirculoId || !encontro_id) return;
    let active = true;
    setIsLoadingInfo(true);
    setSelectedParticipacaoId('');
    setDataNascimento('');
    setTelefoneFim('');
    circuloPublicoService.obterPesquisaCirculoInfo(selectedCirculoId, encontro_id)
      .then((info) => {
        if (!active) return;
        setCirculoNome(info.circulo_nome);
        setMediadores(info.mediadores);
        setParticipantes(info.participantes);
      })
      .catch(() => { if (active) setInvalid(true); })
      .finally(() => { if (active) setIsLoadingInfo(false); });
    return () => { active = false; };
  }, [encontro_id, isGeneralAccess, selectedCirculoId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCirculoId) {
      toast.error('Por favor, selecione seu círculo.');
      return;
    }
    if (!selectedParticipacaoId) {
      toast.error('Por favor, selecione seu nome na lista.');
      return;
    }
    if (!dataNascimento) {
      toast.error('Por favor, informe sua data de nascimento.');
      return;
    }
    if (telefoneFim.length !== 4) {
      toast.error('Informe exatamente os 4 últimos dígitos do seu telefone.');
      return;
    }

    const participante = participantes.find(p => p.participacao_id === selectedParticipacaoId);
    const nome = participante?.nome ?? '';

    const success = await validateAndAccess(
      {
        circulo_id: selectedCirculoId,
        encontro_id: encontro_id!,
        participacao_id: selectedParticipacaoId,
        data_nascimento: dataNascimento,
        telefone_fim: telefoneFim,
      },
      nome
    );

    if (success) {
      navigate('/pos-encontro/ficha');
    }
  };

  if (isLoading || isLoadingInfo) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-color)' }}>
        <Loader className="animate-spin" size={32} color="var(--primary-color)" />
      </div>
    );
  }

  if (invalid || !encontro_id || (!isGeneralAccess && !selectedCirculoId)) {
    return (
      <div className="fade-in" style={{ minHeight: '100vh', background: 'var(--bg-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div className="card" style={{ maxWidth: '450px', width: '100%', textAlign: 'center', padding: '3rem 2rem' }}>
          <h2 style={{ color: 'var(--danger-text)', marginBottom: '1rem' }}>Link Inválido</h2>
          <p style={{ opacity: 0.7 }}>Este link de acesso é inválido ou o círculo não foi encontrado.<br />Solicite um novo link ao seu mediador.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ minHeight: '100vh', background: 'var(--bg-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div className="card" style={{ maxWidth: '500px', width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img src={logoEjc} alt="Logo EJC" className="public-logo-img" style={{ height: '70px', width: 'auto', marginBottom: '1.25rem' }} />

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary-color)',
            padding: '0.35rem 1rem', borderRadius: '999px', fontSize: '0.8rem',
            fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
            marginBottom: '0.75rem'
          }}>
            <Users size={14} />
            {circuloNome || encontroNome || 'Pesquisa dos encontristas'}
          </div>

          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>Avaliação e Ficha Pós-Encontro</h1>

          {mediadores.length > 0 && (
            <p style={{ opacity: 0.55, fontSize: '0.85rem' }}>
              {mediadores.length === 1 ? 'Mediador' : 'Mediadores'}:{' '}
              <strong>{mediadores.map(m => m.nome).join(' · ')}</strong>
            </p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{
            padding: '0.75rem 1rem',
            background: 'rgba(var(--primary-rgb), 0.04)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            fontSize: '0.875rem',
            opacity: 0.75,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <ShieldCheck size={16} />
            Selecione seu nome e confirme sua identidade para responder à avaliação e acessar sua ficha.
          </div>

          {isGeneralAccess && (
            <div className="form-group">
              <label className="form-label">Meu círculo é</label>
              <select
                className="form-input"
                required
                value={selectedCirculoId ?? ''}
                onChange={(event) => setSelectedCirculoId(event.target.value ? Number(event.target.value) : null)}
              >
                <option value="">Selecione seu círculo...</option>
                {circulos.map((circulo) => (
                  <option key={circulo.circulo_id} value={circulo.circulo_id}>{circulo.nome}</option>
                ))}
              </select>
            </div>
          )}

          {/* Seleção do participante */}
          <div className="form-group">
            <label className="form-label">Meu nome é</label>
            <select
              className="form-input"
              required
              disabled={!selectedCirculoId}
              value={selectedParticipacaoId}
              onChange={e => setSelectedParticipacaoId(e.target.value)}
            >
              <option value="">{selectedCirculoId ? 'Selecione seu nome...' : 'Selecione primeiro o círculo'}</option>
              {participantes.map(p => (
                <option key={p.participacao_id} value={p.participacao_id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Data de nascimento */}
          <div className="form-group">
            <label className="form-label">Data de Nascimento</label>
            <input
              type="date"
              className="form-input"
              required
              value={dataNascimento}
              onChange={e => setDataNascimento(e.target.value)}
            />
          </div>

          {/* 4 últimos dígitos do telefone */}
          <div className="form-group">
            <label className="form-label">4 últimos dígitos do seu telefone</label>
            <input
              type="tel"
              className="form-input"
              required
              placeholder="Ex: 4321"
              maxLength={4}
              value={telefoneFim}
              onChange={e => setTelefoneFim(e.target.value.replace(/\D/g, '').slice(0, 4))}
              style={{ letterSpacing: '0.3em', fontSize: '1.25rem', textAlign: 'center' }}
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ marginTop: '0.5rem', height: '48px', fontSize: '1rem' }}
            disabled={isValidating}
          >
            {isValidating ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Loader className="animate-spin" size={20} />
                <span>Verificando...</span>
              </div>
            ) : (
              'Acessar avaliação e ficha'
            )}
          </button>
        </form>

        <p style={{ marginTop: '1.75rem', fontSize: '0.75rem', textAlign: 'center', opacity: 0.45 }}>
          Em caso de dúvidas, procure seu mediador.
        </p>
      </div>
    </div>
  );
}
