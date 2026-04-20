import { 
    FileText, 
    Save, 
    ArrowLeft,
    CheckCircle2
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { palestraService } from '../../services/palestraService';
import { encontroService } from '../../services/encontroService';
import type { Palestra } from '../../types/palestra';
import type { Encontro } from '../../types/encontro';

export function PalestrasResumoPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [encontro, setEncontro] = useState<Encontro | null>(null);
    const [palestras, setPalestras] = useState<Palestra[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);

    useEffect(() => {
        if (id) {
            loadData();
        }
    }, [id]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [eData, pData] = await Promise.all([
                encontroService.obterPorId(id!),
                palestraService.listarPorEncontro(id!)
            ]);
            setEncontro(eData);
            setPalestras(pData);
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            toast.error('Erro ao carregar dados.');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateResumo = async (palestraId: string, novoResumo: string) => {
        setSavingId(palestraId);
        try {
            await palestraService.atualizar(palestraId, { resumo: novoResumo });
            // Atualizar estado local
            setPalestras(prev => prev.map(p => p.id === palestraId ? { ...p, resumo: novoResumo } : p));
            toast.success('Resumo salvo!');
        } catch (error) {
            toast.error('Erro ao salvar resumo');
        } finally {
            setSavingId(null);
        }
    };

    if (loading) return <div className="p-8 text-center">Carregando...</div>;

    return (
        <div className="container">
            <PageHeader
                title="Revisão de Resumos"
                subtitle={`Encontro: ${encontro?.nome}`}
                onBack={() => navigate('/atividades/palestras')}
            />

            <div className="resumo-editor-container" style={{ marginTop: '2rem' }}>
                <div className="info-alert">
                    <FileText size={20} />
                    <p>Esta tela é dedicada apenas à edição rápida dos resumos das palestras já cadastradas. As alterações são salvas individualmente.</p>
                </div>

                {palestras.length === 0 ? (
                    <div className="card text-center p-12">
                        <p className="opacity-50">Nenhuma palestra cadastrada para este encontro.</p>
                    </div>
                ) : (
                    <div className="resumo-list">
                        {palestras.map((p) => (
                            <div key={p.id} className="resumo-row-card">
                                <div className="resumo-row-header">
                                    <div className="row-info">
                                        <h4>{p.titulo}</h4>
                                        <span className="p-speaker">{p.palestrante_nome}</span>
                                    </div>
                                    <div className="row-status">
                                        {p.resumo ? <CheckCircle2 size={16} className="status-done" /> : <div className="status-pending" />}
                                    </div>
                                </div>
                                <div className="resumo-textarea-wrapper">
                                    <textarea
                                        rows={4}
                                        placeholder="Digite o resumo da palestra aqui..."
                                        defaultValue={p.resumo || ''}
                                        onBlur={(e) => {
                                            if (e.target.value !== (p.resumo || '')) {
                                                handleUpdateResumo(p.id, e.target.value);
                                            }
                                        }}
                                    />
                                    {savingId === p.id && (
                                        <div className="saving-indicator">Salvando...</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style>{`
                .info-alert {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    background: var(--primary-color)10;
                    border: 1px solid var(--primary-color)30;
                    padding: 1.25rem;
                    border-radius: 12px;
                    margin-bottom: 2rem;
                    color: var(--primary-color);
                }
                .info-alert p { margin: 0; font-size: 0.9rem; font-weight: 500; }
                
                .resumo-list { display: flex; flex-direction: column; gap: 1.5rem; }
                .resumo-row-card { 
                    background: var(--card-bg); 
                    border: 1px solid var(--border-color); 
                    border-radius: 16px; 
                    overflow: hidden;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.05);
                }
                .resumo-row-header {
                    padding: 1rem 1.5rem;
                    background: rgba(255,255,255,0.02);
                    border-bottom: 1px solid var(--border-color);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .row-info h4 { margin: 0; font-size: 1rem; }
                .p-speaker { font-size: 0.8rem; opacity: 0.6; font-weight: 600; text-transform: uppercase; }
                
                .resumo-textarea-wrapper { padding: 1.5rem; position: relative; }
                .resumo-textarea-wrapper textarea {
                    width: 100%;
                    background: var(--bg-color);
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    padding: 1rem;
                    color: var(--text-color);
                    font-size: 0.95rem;
                    resize: vertical;
                    transition: border-color 0.2s;
                }
                .resumo-textarea-wrapper textarea:focus {
                    border-color: var(--primary-color);
                    outline: none;
                }
                .saving-indicator {
                    position: absolute;
                    bottom: 2rem;
                    right: 2rem;
                    font-size: 0.75rem;
                    color: var(--primary-color);
                    font-weight: 600;
                    animation: pulse 1.5s infinite;
                }
                @keyframes pulse {
                    0%, 100% { opacity: 0.6; }
                    50% { opacity: 1; }
                }
                .status-done { color: #10b981; }
                .status-pending { width: 16px; height: 16px; border-radius: 50%; border: 2px dashed var(--border-color); }
            `}</style>
        </div>
    );
}
