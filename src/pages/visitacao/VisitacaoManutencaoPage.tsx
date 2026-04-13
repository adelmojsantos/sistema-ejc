import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Save, Camera, Check, Loader, Info, DollarSign } from 'lucide-react';
import { visitacaoService } from '../../services/visitacaoService';
import { supabase } from '../../lib/supabase';
import type { VisitaParticipacaoEnriched, VisitaStatus } from '../../types/visitacao';
import { toast } from 'react-hot-toast';
import { Header } from '../../components/Header';

export function VisitacaoManutencaoPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [visita, setVisita] = useState<VisitaParticipacaoEnriched | null>(null);

    // Form states
    const [status, setStatus] = useState<VisitaStatus>('pendente');
    const [observacoes, setObservacoes] = useState('');
    const [taxaPaga, setTaxaPaga] = useState(false);
    const [fotoUrl, setFotoUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        async function loadVisita() {
            if (!id) return;
            try {
                const { data, error } = await supabase
                    .from('visita_participacao')
                    .select(`
                        *,
                        participacoes:participacao_id (
                            id,
                            pessoas (nome_completo, cpf)
                        )
                    `)
                    .eq('id', id)
                    .single();

                if (error) throw error;
                if (data) {
                    setVisita(data);
                    setStatus(data.status || 'pendente');
                    setObservacoes(data.observacoes || '');
                    setTaxaPaga(data.taxa_paga || false);
                    setFotoUrl(data.foto_url || null);
                }
            } catch (error) {
                console.error('Erro ao buscar dados da visita:', error);
                toast.error('Não foi possível carregar os dados da visita.');
            } finally {
                setLoading(false);
            }
        }

        loadVisita();
    }, [id]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !visita) return;

        setUploading(true);
        try {
            const url = await visitacaoService.uploadFoto(visita.participacao_id, file);
            setFotoUrl(url);
            toast.success('Foto enviada com sucesso!');
        } catch (error) {
            console.error('Erro no upload:', error);
            toast.error('Erro ao enviar foto.');
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        if (!id) return;
        setSaving(true);
        try {
            await visitacaoService.atualizarVisita(id, {
                status,
                observacoes,
                taxa_paga: taxaPaga,
                foto_url: fotoUrl,
                data_visita: status === 'realizada' ? new Date().toISOString() : visita?.data_visita
            });
            toast.success('Dados salvos com sucesso!');
            navigate('/visitacao/meus-participantes');
        } catch (error) {
            console.error('Erro ao salvar:', error);
            toast.error('Erro ao salvar alterações.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="app-shell">
                <Header />
                <div className="container" style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                    <Loader className="animate-spin" size={32} />
                </div>
            </div>
        );
    }

    if (!visita) {
        return (
            <div className="app-shell">
                <Header />
                <div className="container">Visita não encontrada.</div>
            </div>
        );
    }

    return (
        <div className="app-shell">
            <Header />
            <main className="container main-content" style={{ paddingBottom: '4rem' }}>
                <div className="page-header" style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button onClick={() => navigate('/visitacao/meus-participantes')} className="icon-btn"><ChevronLeft size={20} /></button>
                        <div>
                            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Registro de Visita</h1>
                            <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.6 }}>
                                Encontrista: <strong>{(visita.participacoes as any)?.pessoas?.nome_completo}</strong>
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Column 1: Info & Photo */}
                    <div className="md:col-span-1 flex flex-col gap-6">
                        <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
                            <div style={{ 
                                width: '100%', aspectRatio: '1', borderRadius: '12px', background: 'var(--secondary-bg)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                                marginBottom: '1rem', border: '2px dashed var(--border-color)', position: 'relative'
                            }}>
                                {fotoUrl ? (
                                    <img src={fotoUrl} alt="Foto do encontrista" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ opacity: 0.3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <Camera size={48} />
                                        <span style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Sem foto registrada</span>
                                    </div>
                                )}
                                
                                {uploading && (
                                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Loader className="animate-spin" color="white" />
                                    </div>
                                )}
                            </div>
                            <label className="btn-outline" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <Camera size={18} /> {fotoUrl ? 'Alterar Foto' : 'Tirar/Enviar Foto'}
                                <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploading} />
                            </label>
                        </div>

                        <div className="card" style={{ padding: '1.5rem' }}>
                            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Info size={18} /> Dados do Encontrista
                            </h3>
                            <div style={{ fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <p style={{ margin: 0 }}><strong>Nome:</strong> {(visita.participacoes as any)?.pessoas?.nome_completo}</p>
                                <p style={{ margin: 0 }}><strong>CPF:</strong> {(visita.participacoes as any)?.pessoas?.cpf || 'Não informado'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Column 2 & 3: Form */}
                    <div className="md:col-span-2 flex flex-col gap-6">
                        <div className="card" style={{ padding: '2rem' }}>
                            <div className="form-group">
                                <label>Status da Visita</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem', marginTop: '0.5rem' }}>
                                    {(['pendente', 'realizada', 'ausente', 'cancelada'] as VisitaStatus[]).map((s) => (
                                        <button
                                            key={s}
                                            onClick={() => setStatus(s)}
                                            style={{
                                                padding: '0.75rem', borderRadius: '10px', border: '2px solid',
                                                borderColor: status === s ? 'var(--primary-color)' : 'var(--border-color)',
                                                background: status === s ? 'var(--primary-color)10' : 'transparent',
                                                color: status === s ? 'var(--primary-color)' : 'inherit',
                                                fontWeight: status === s ? 700 : 400,
                                                cursor: 'pointer', transition: 'all 0.2s', textTransform: 'capitalize'
                                            }}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group" style={{ marginTop: '2rem' }}>
                                <label>Observações / Dados Coletados</label>
                                <textarea
                                    className="form-input"
                                    value={observacoes}
                                    onChange={(e) => setObservacoes(e.target.value)}
                                    placeholder="Descreva como foi a visita, se houve alguma mudança de dados, etc..."
                                    style={{ minHeight: '150px', padding: '1rem', resize: 'vertical' }}
                                />
                            </div>

                            <div style={{ 
                                marginTop: '2rem', padding: '1.25rem', borderRadius: '12px', background: 'var(--secondary-bg)',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ background: 'var(--primary-color)', color: 'white', padding: '0.5rem', borderRadius: '8px' }}>
                                        <DollarSign size={20} />
                                    </div>
                                    <div>
                                        <h4 style={{ margin: 0 }}>Pagamento de Taxa</h4>
                                        <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6 }}>O encontrista pagou a taxa de inscrição?</p>
                                    </div>
                                </div>
                                <label className="switch">
                                    <input type="checkbox" checked={taxaPaga} onChange={(e) => setTaxaPaga(e.target.checked)} />
                                    <span className="slider round"></span>
                                </label>
                            </div>

                            <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button onClick={() => navigate('/visitacao/meus-participantes')} className="btn-outline">Cancelar</button>
                                <button 
                                    onClick={handleSave} 
                                    className="btn-primary" 
                                    disabled={saving}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 2rem' }}
                                >
                                    {saving ? <Loader className="animate-spin" size={18} /> : <Save size={18} />}
                                    Salvar Visita
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
