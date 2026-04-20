import { 
    Mic2, 
    Plus, 
    Settings, 
    Trash2, 
    MoreHorizontal, 
    ArrowLeft,
    Search,
    User
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { palestraService } from '../../services/palestraService';
import { encontroService } from '../../services/encontroService';
import { supabase } from '../../lib/supabase';
import type { Palestra } from '../../types/palestra';
import type { Encontro } from '../../types/encontro';

export function PalestrasGestaoPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [encontro, setEncontro] = useState<Encontro | null>(null);
    const [palestras, setPalestras] = useState<Palestra[]>([]);
    const [loading, setLoading] = useState(true);
    const [palestraLoading, setPalestraLoading] = useState(false);
    const [showPalestraModal, setShowPalestraModal] = useState(false);
    const [editingPalestra, setEditingPalestra] = useState<Palestra | null>(null);

    // Modal Form States
    const [pTitulo, setPTitulo] = useState('');
    const [pNome, setPNome] = useState('');
    const [pFoto, setPFoto] = useState('');
    const [pResumo, setPResumo] = useState('');
    const [pPessoaId, setPPessoaId] = useState<string | null>(null);
    const [peopleSearch, setPeopleSearch] = useState('');
    const [peopleResults, setPeopleResults] = useState<{ id: string, nome_completo: string, foto_url?: string }[]>([]);

    useEffect(() => {
        if (id) {
            loadData();
        }
    }, [id]);

    useEffect(() => {
        if (peopleSearch.length > 2) {
            const timer = setTimeout(async () => {
                const { data } = await supabase
                    .from('pessoas')
                    .select('id, nome_completo, foto_url')
                    .ilike('nome_completo', `%${peopleSearch}%`)
                    .limit(5);
                setPeopleResults(data || []);
            }, 300);
            return () => clearTimeout(timer);
        } else {
            setPeopleResults([]);
        }
    }, [peopleSearch]);

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
            toast.error('Erro ao carregar palestras.');
        } finally {
            setLoading(false);
        }
    };

    const loadPalestras = async () => {
        const pData = await palestraService.listarPorEncontro(id!);
        setPalestras(pData);
    };

    const openPalestraModal = (palestra?: Palestra) => {
        if (palestra) {
            setEditingPalestra(palestra);
            setPTitulo(palestra.titulo);
            setPNome(palestra.palestrante_nome || '');
            setPFoto(palestra.palestrante_foto_url || '');
            setPResumo(palestra.resumo || '');
            setPPessoaId(palestra.pessoa_id || null);
            setPeopleSearch(palestra.palestrante_nome || '');
        } else {
            setEditingPalestra(null);
            setPTitulo('');
            setPNome('');
            setPFoto('');
            setPResumo('');
            setPPessoaId(null);
            setPeopleSearch('');
        }
        setShowPalestraModal(true);
    };

    const handleSavePalestra = async () => {
        if (!pTitulo) return toast.error('Título é obrigatório');
        if (!id) return;

        setPalestraLoading(true);
        try {
            const payload = {
                encontro_id: id,
                titulo: pTitulo,
                palestrante_nome: pNome,
                palestrante_foto_url: pFoto,
                resumo: pResumo,
                pessoa_id: pPessoaId,
                ordem: editingPalestra ? editingPalestra.ordem : palestras.length + 1
            };

            if (editingPalestra) {
                await palestraService.atualizar(editingPalestra.id, payload);
                toast.success('Palestra atualizada!');
            } else {
                await palestraService.criar(payload as any);
                toast.success('Palestra adicionada!');
            }
            
            setShowPalestraModal(false);
            loadPalestras();
        } catch (err) {
            console.error(err);
            toast.error('Erro ao salvar palestra');
        } finally {
            setPalestraLoading(false);
        }
    };

    const handleDeletePalestra = async (pId: string) => {
        if (!confirm('Deseja realmente remover esta palestra?')) return;
        try {
            await palestraService.excluir(pId);
            toast.success('Palestra removida!');
            loadPalestras();
        } catch (err) {
            toast.error('Erro ao remover palestra');
        }
    };

    const selectPerson = (pessoa: { id: string, nome_completo: string, foto_url?: string }) => {
        setPPessoaId(pessoa.id);
        setPNome(pessoa.nome_completo);
        setPeopleSearch(pessoa.nome_completo);
        if (pessoa.foto_url) setPFoto(pessoa.foto_url);
        setPeopleResults([]);
    };

    if (loading) return <div className="p-8 text-center">Carregando...</div>;

    return (
        <div className="container">
            <PageHeader
                title="Gestão de Palestras"
                subtitle={`Encontro: ${encontro?.nome}`}
                onBack={() => navigate('/atividades/palestras')}
            />

            <div className="card" style={{ marginTop: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div className="icon-badge primary">
                            <Mic2 size={24} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0 }}>Mural de Palestras</h3>
                            <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.6 }}>Gerencie o conteúdo programático do encontro.</p>
                        </div>
                    </div>
                    <button className="btn-primary" onClick={() => openPalestraModal()}>
                        <Plus size={18} /> Adicionar Palestra
                    </button>
                </div>

                {palestras.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon"><Mic2 size={48} /></div>
                        <h3>Nenhuma palestra</h3>
                        <p>Comece adicionando a primeira palestra do encontro.</p>
                    </div>
                ) : (
                    <div className="palestras-grid-admin">
                        {palestras.map((p) => (
                            <div key={p.id} className="palestra-card-admin">
                                <div className="p-card-avatar">
                                    {p.palestrante_foto_url ? (
                                        <img src={p.palestrante_foto_url} alt={p.palestrante_nome || ''} />
                                    ) : (
                                        <User size={24} />
                                    )}
                                </div>
                                <div className="p-card-content">
                                    <h4>{p.titulo}</h4>
                                    <span className="p-card-speaker">{p.palestrante_nome || 'Sem palestrante'}</span>
                                    <p className="p-card-summary">{p.resumo || 'Nenhum resumo definido.'}</p>
                                </div>
                                <div className="p-card-actions">
                                    <button className="icon-btn" onClick={() => openPalestraModal(p)} title="Editar">
                                        <Settings size={18} />
                                    </button>
                                    <button className="icon-btn danger" onClick={() => handleDeletePalestra(p.id)} title="Excluir">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal de Cadastro */}
            {showPalestraModal && (
                <div className="modal-overlay">
                    <div className="modal-card">
                        <div className="modal-header">
                            <h3>{editingPalestra ? 'Editar Palestra' : 'Nova Palestra'}</h3>
                            <button className="close-btn" onClick={() => setShowPalestraModal(false)}>&times;</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Título da Palestra</label>
                                <input
                                    type="text"
                                    placeholder="Ex: O Jovem e o Mundo"
                                    className="form-input"
                                    value={pTitulo}
                                    onChange={e => setPTitulo(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label>Palestrante (Busca Inteligente)</label>
                                <div className="search-input-wrapper">
                                    <input
                                        type="text"
                                        placeholder="Digite o nome para buscar..."
                                        className="form-input"
                                        value={peopleSearch}
                                        onChange={e => {
                                            setPeopleSearch(e.target.value);
                                            setPNome(e.target.value);
                                        }}
                                    />
                                    {peopleResults.length > 0 && (
                                        <div className="search-suggestions">
                                            {peopleResults.map(p => (
                                                <div
                                                    key={p.id}
                                                    className="suggestion-item"
                                                    onClick={() => selectPerson(p)}
                                                >
                                                    <div className="sug-avatar">
                                                        {p.foto_url ? <img src={p.foto_url} alt="" /> : <User size={12} />}
                                                    </div>
                                                    <span>{p.nome_completo}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Foto do Palestrante (URL)</label>
                                <input
                                    type="text"
                                    placeholder="https://..."
                                    className="form-input"
                                    value={pFoto}
                                    onChange={e => setPFoto(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label>Resumo da Palestra</label>
                                <textarea
                                    rows={4}
                                    placeholder="Breve descrição..."
                                    className="form-input"
                                    value={pResumo}
                                    onChange={e => setPResumo(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-outline" onClick={() => setShowPalestraModal(false)}>Cancelar</button>
                            <button className="btn-primary" onClick={handleSavePalestra} disabled={palestraLoading}>
                                {palestraLoading ? 'Salvando...' : 'Salvar Palestra'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .icon-badge.primary { background: var(--primary-color); color: white; }
                .palestras-grid-admin { display: grid; grid-template-columns: 1fr; gap: 1rem; }
                .palestra-card-admin { 
                    display: flex; 
                    align-items: center; 
                    gap: 1.5rem; 
                    padding: 1.25rem; 
                    background: var(--glass-bg); 
                    border: 1px solid var(--border-color); 
                    border-radius: 16px;
                }
                .p-card-avatar { width: 64px; height: 64px; border-radius: 12px; overflow: hidden; background: var(--card-bg); flex-shrink: 0; }
                .p-card-avatar img { width: 100%; height: 100%; object-fit: cover; }
                .p-card-content { flex: 1; }
                .p-card-content h4 { margin: 0 0 0.25rem 0; font-size: 1.1rem; }
                .p-card-speaker { font-size: 0.85rem; color: var(--primary-color); font-weight: 700; text-transform: uppercase; }
                .p-card-summary { margin: 0.5rem 0 0 0; font-size: 0.9rem; opacity: 0.7; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
                .p-card-actions { display: flex; gap: 0.5rem; }

                /* Reuse existing modal styles */
                .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 2000; }
                .modal-card { background: var(--card-bg); width: 100%; max-width: 500px; border-radius: 20px; border: 1px solid var(--border-color); }
                .modal-header { padding: 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; }
                .close-btn { background: transparent; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-color); }
                .modal-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
                .modal-footer { padding: 1.5rem; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 1rem; }
                .search-input-wrapper { position: relative; }
                .search-suggestions { position: absolute; top: 100%; left: 0; right: 0; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; z-index: 10; overflow: hidden; }
                .suggestion-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem; cursor: pointer; transition: background 0.2s; }
                .suggestion-item:hover { background: var(--primary-color)20; }
                .sug-avatar { width: 24px; height: 24px; border-radius: 50%; overflow: hidden; background: var(--border-color); }
                .form-input { width: 100%; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-color); color: var(--text-color); }
                .empty-state { padding: 4rem 2rem; text-align: center; }
                .empty-icon { opacity: 0.2; margin-bottom: 1rem; }
            `}</style>
        </div>
    );
}

