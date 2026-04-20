import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Save, Camera, Loader, Info, DollarSign, User, Phone, UsersRound, Home } from 'lucide-react';
import { visitacaoService } from '../../services/visitacaoService';
import { supabase } from '../../lib/supabase';
import type { VisitaParticipacaoEnriched, VisitaStatus } from '../../types/visitacao';
import { toast } from 'react-hot-toast';
import { FormSection } from '../../components/ui/FormSection';
import { FormRow } from '../../components/ui/FormRow';
import { FormField } from '../../components/ui/FormField';

/** Local type for the Supabase-joined participacoes field on this page's query */
type ParticipacaoComPessoa = {
    id: string;
    pessoas: {
        id: string;
        nome_completo: string;
        cpf: string | null;
        telefone: string | null;
        endereco: string | null;
        numero: string | null;
        bairro: string | null;
        nome_pai: string | null;
        telefone_pai: string | null;
        nome_mae: string | null;
        telefone_mae: string | null;
    } | null;
};

export function VisitacaoManutencaoPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [visita, setVisita] = useState<VisitaParticipacaoEnriched | null>(null);

    // Visit states
    const [status, setStatus] = useState<VisitaStatus>('pendente');
    const [observacoes, setObservacoes] = useState('');
    const [taxaPaga, setTaxaPaga] = useState(false);
    const [fotoUrl, setFotoUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    
    // Correction states
    const [nomeCompleto, setNomeCompleto] = useState('');
    const [telefone, setTelefone] = useState('');
    const [endereco, setEndereco] = useState('');
    const [numero, setNumero] = useState('');
    const [bairro, setBairro] = useState('');
    const [nomePai, setNomePai] = useState('');
    const [telefonePai, setTelefonePai] = useState('');
    const [nomeMae, setNomeMae] = useState('');
    const [telefoneMae, setTelefoneMae] = useState('');

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
                            foto_url,
                            pessoas (*)
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
                    
                    // Photo is now in participacoes
                    const part = data.participacoes as any;
                    setFotoUrl(part?.foto_url || null);
                    
                    const p = (data.participacoes as ParticipacaoComPessoa | null)?.pessoas;
                    if (p) {
                        setNomeCompleto(p.nome_completo || '');
                        setTelefone(p.telefone || '');
                        setEndereco(p.endereco || '');
                        setNumero(p.numero || '');
                        setBairro(p.bairro || '');
                        setNomePai(p.nome_pai || '');
                        setTelefonePai(p.telefone_pai || '');
                        setNomeMae(p.nome_mae || '');
                        setTelefoneMae(p.telefone_mae || '');
                    }
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
        if (!id || !visita) return;
        setSaving(true);
        try {
            // Update Visit record
            await visitacaoService.atualizarVisita(id, {
                status,
                observacoes,
                taxa_paga: taxaPaga,
                data_visita: status === 'realizada' ? new Date().toISOString() : visita?.data_visita
            });

            // Update Participation record (Photo is here now)
            await visitacaoService.atualizarParticipacao(visita.participacao_id, {
                foto_url: fotoUrl
            });

            // Update Person record (Correction)
            const pessoaId = (visita.participacoes as ParticipacaoComPessoa | null)?.pessoas?.id;
            if (pessoaId) {
                await visitacaoService.atualizarPessoa(pessoaId, {
                    nome_completo: nomeCompleto,
                    telefone,
                    endereco,
                    numero,
                    bairro,
                    nome_pai: nomePai,
                    telefone_pai: telefonePai,
                    nome_mae: nomeMae,
                    telefone_mae: telefoneMae
                });
            }

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
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                <Loader className="animate-spin" size={32} />
            </div>
        );
    }

    if (!visita) {
        return (
            <div>Visita não encontrada.</div>
        );
    }

    return (
        <>
                <div className="page-header" style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button onClick={() => navigate('/visitacao/meus-participantes')} className="icon-btn"><ChevronLeft size={20} /></button>
                        <div>
                            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Registro de Visita</h1>
                            <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.6 }}>
                                Encontrista: <strong>{(visita.participacoes as ParticipacaoComPessoa | null)?.pessoas?.nome_completo}</strong>
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Column 1: Info & Photo */}
                    <div className="md:col-span-1 flex flex-col gap-6">
                        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ 
                                width: '180px', height: '180px', borderRadius: '16px', background: 'var(--secondary-bg)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                                marginBottom: '1.25rem', border: '2px dashed var(--border-color)', position: 'relative',
                                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
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
                            <label className="btn-outline" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', width: '100%' }}>
                                <Camera size={18} /> {fotoUrl ? 'Alterar Foto' : 'Tirar/Enviar Foto'}
                                <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploading} />
                            </label>
                        </div>

                        <div className="card" style={{ padding: '1.5rem' }}>
                            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Info size={18} /> Dados do Encontrista
                            </h3>
                            <div style={{ fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <p style={{ margin: 0 }}><strong>Nome:</strong> {(visita.participacoes as ParticipacaoComPessoa | null)?.pessoas?.nome_completo}</p>
                                <p style={{ margin: 0 }}><strong>CPF:</strong> {(visita.participacoes as ParticipacaoComPessoa | null)?.pessoas?.cpf || 'Não informado'}</p>
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
                                marginTop: '2rem', padding: '1.5rem', borderRadius: '16px', 
                                background: taxaPaga ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)' : 'var(--secondary-bg)',
                                border: taxaPaga ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid var(--border-color)',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                transition: 'all 0.3s ease'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ 
                                        background: taxaPaga ? '#10b981' : 'var(--muted-text)', 
                                        color: 'white', padding: '0.6rem', borderRadius: '10px',
                                        transition: 'all 0.3s ease'
                                    }}>
                                        <DollarSign size={20} />
                                    </div>
                                    <div>
                                        <h4 style={{ margin: 0, color: taxaPaga ? '#059669' : 'inherit' }}>Pagamento de Taxa</h4>
                                        <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6 }}>O encontrista pagou a taxa de inscrição?</p>
                                    </div>
                                </div>
                                <div 
                                    onClick={() => setTaxaPaga(!taxaPaga)}
                                    style={{
                                        width: '56px', height: '30px', borderRadius: '20px',
                                        background: taxaPaga ? '#10b981' : '#cbd5e1',
                                        position: 'relative', cursor: 'pointer', transition: 'all 0.3s ease',
                                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
                                    }}
                                >
                                    <div style={{
                                        width: '24px', height: '24px', borderRadius: '50%',
                                        background: 'white', position: 'absolute', top: '3px',
                                        left: taxaPaga ? '29px' : '3px', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                    }} />
                                </div>
                            </div>

                            <div style={{ marginTop: '2.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '2rem' }}>
                                <FormSection title="Correção de Dados Cadastrais" icon={<Info size={20} />}>
                                    <p style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '1.5rem', marginTop: '-1rem' }}>
                                        Caso encontre erros nos dados do encontrista durante a visita, corrija-os abaixo para atualizar o sistema.
                                    </p>

                                    <FormRow>
                                        <FormField
                                            label="Nome Completo"
                                            value={nomeCompleto}
                                            onChange={e => setNomeCompleto(e.target.value)}
                                            colSpan={8}
                                            icon={<User size={18} />}
                                        />
                                        <FormField
                                            label="Telefone Encontrista"
                                            value={telefone}
                                            onChange={e => setTelefone(e.target.value)}
                                            colSpan={4}
                                            icon={<Phone size={18} />}
                                        />
                                    </FormRow>

                                    <FormRow>
                                        <FormField
                                            label="Bairro"
                                            value={bairro}
                                            onChange={e => setBairro(e.target.value)}
                                            colSpan={4}
                                            icon={<Home size={18} />}
                                        />
                                        <FormField
                                            label="Endereço / Rua"
                                            value={endereco}
                                            onChange={e => setEndereco(e.target.value)}
                                            colSpan={6}
                                        />
                                        <FormField
                                            label="Nº"
                                            value={numero}
                                            onChange={e => setNumero(e.target.value)}
                                            colSpan={2}
                                        />
                                    </FormRow>

                                    <FormSection title="Filiação & Contatos" icon={<UsersRound size={18} />}>
                                        <FormRow>
                                            <FormField
                                                label="Nome do Pai"
                                                value={nomePai}
                                                onChange={e => setNomePai(e.target.value)}
                                                colSpan={8}
                                            />
                                            <FormField
                                                label="Telefone do Pai"
                                                value={telefonePai}
                                                onChange={e => setTelefonePai(e.target.value)}
                                                colSpan={4}
                                                icon={<Phone size={18} />}
                                            />
                                        </FormRow>
                                        <FormRow>
                                            <FormField
                                                label="Nome da Mãe"
                                                value={nomeMae}
                                                onChange={e => setNomeMae(e.target.value)}
                                                colSpan={8}
                                            />
                                            <FormField
                                                label="Telefone da Mãe"
                                                value={telefoneMae}
                                                onChange={e => setTelefoneMae(e.target.value)}
                                                colSpan={4}
                                                icon={<Phone size={18} />}
                                            />
                                        </FormRow>
                                    </FormSection>
                                </FormSection>
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
        </>
    );
}
