import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Save, Camera, Loader, Info, DollarSign, User, Phone, UsersRound, Home, Heart, UtensilsCrossed, Pill, AlertTriangle, Upload, ImagePlus, Calendar, Shirt, Plus, Trash2, X, Car, Pencil } from 'lucide-react';
import { visitacaoService, type IntencaoCamisetaItem } from '../../services/visitacaoService';
import { camisetaService } from '../../services/camisetaService';
import type { CamisetaModelo, CamisetaTamanho } from '../../types/camiseta';
import { inscricaoService } from '../../services/inscricaoService';
import { recepcaoService } from '../../services/recepcaoService';
import { supabase } from '../../lib/supabase';
import type { VisitaParticipacaoEnriched, VisitaStatus } from '../../types/visitacao';
import type { RecepcaoDados, RecepcaoDadosFormData } from '../../types/recepcao';
import { toast } from 'react-hot-toast';
import { FormSection } from '../../components/ui/FormSection';
import { FormRow } from '../../components/ui/FormRow';
import { FormField } from '../../components/ui/FormField';
import { RadioGroup } from '../../components/ui/RadioGroup';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { formatTelefone, formatCpf } from '../../utils/cpfUtils';
import { cleanPlate, formatPlate } from '../../utils/plateUtils';

/** Local type for the Supabase-joined participacoes field on this page's query */
type ParticipacaoComPessoa = {
    id: string;
    encontro_id: string;
    foto_url: string | null;
    pessoas: {
        id: string;
        nome_completo: string;
        cpf: string | null;
        telefone: string | null;
        endereco: string | null;
        numero: string | null;
        complemento: string | null;
        cep: string | null;
        bairro: string | null;
        cidade: string | null;
        estado: string | null;
        data_nascimento: string | null;
        nome_pai: string | null;
        telefone_pai: string | null;
        nome_mae: string | null;
        telefone_mae: string | null;
        restricao_alimentar: string | null;
        medicamento_continuo: string | null;
        alergia: string | null;
        observacoes_saude: string | null;
    } | null;
};

type CamisetaModeloComStatus = CamisetaModelo & {
    esta_ativo_no_encontro?: boolean;
};

export function VisitacaoManutencaoPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [visita, setVisita] = useState<VisitaParticipacaoEnriched | null>(null);
    const [recepcaoDados, setRecepcaoDados] = useState<RecepcaoDados | null>(null);
    const [showRecepcaoForm, setShowRecepcaoForm] = useState(false);
    const [savingRecepcao, setSavingRecepcao] = useState(false);
    const [deletingRecepcao, setDeletingRecepcao] = useState(false);
    const [recepcaoForm, setRecepcaoForm] = useState<RecepcaoDadosFormData>({
        veiculo_tipo: 'carro',
        veiculo_modelo: '',
        veiculo_cor: '',
        veiculo_placa: '',
    });

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
    const [complemento, setComplemento] = useState('');
    const [cep, setCep] = useState('');
    const [bairro, setBairro] = useState('');
    const [cidade, setCidade] = useState('');
    const [estado, setEstado] = useState('');
    const [dataNascimento, setDataNascimento] = useState('');
    const [nomePai, setNomePai] = useState('');
    const [telefonePai, setTelefonePai] = useState('');
    const [nomeMae, setNomeMae] = useState('');
    const [telefoneMae, setTelefoneMae] = useState('');
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [isConfirmPhotoRemoveDialogOpen, setIsConfirmPhotoRemoveDialogOpen] = useState(false);

    // Health states
    const [restricaoAlimentar, setRestricaoAlimentar] = useState('');
    const [medicamentoContinuo, setMedicamentoContinuo] = useState('');
    const [alergia, setAlergia] = useState('');
    const [observacoesSaude, setObservacoesSaude] = useState('');

    const [isHistory, setIsHistory] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const [isPhotoActionSheetOpen, setIsPhotoActionSheetOpen] = useState(false);

    // ---- Intenção de camiseta ----
    const [intencoes, setIntencoes] = useState<IntencaoCamisetaItem[]>([]);
    const [modelosCamiseta, setModelosCamiseta] = useState<CamisetaModelo[]>([]);
    const [tamanhosCamiseta, setTamanhosCamiseta] = useState<CamisetaTamanho[]>([]);
    const [showAddIntencao, setShowAddIntencao] = useState(false);
    const [newIntencao, setNewIntencao] = useState({ modelo_id: '', tamanho: '', quantidade: 1 });

    const processFile = useCallback(async (file: File) => {
        if (!file || !visita || !file.type.startsWith('image/')) return;
        setUploading(true);
        try {
            const url = await visitacaoService.uploadFoto(visita.participacao_id, file);
            setFotoUrl(url);

            // Salva a foto no banco imediatamente após o upload
            await visitacaoService.atualizarParticipacao(visita.participacao_id, {
                foto_url: url
            });

            toast.success('Foto enviada com sucesso!');
        } catch (error) {
            console.error('Erro no upload:', error);
            toast.error('Erro ao enviar foto.');
        } finally {
            setUploading(false);
        }
    }, [visita]);

    const removePhoto = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setIsConfirmPhotoRemoveDialogOpen(true);
    }, []);

    const handleConfirmRemovePhoto = async () => {
        if (!visita) return;
        setUploading(true);
        setIsConfirmPhotoRemoveDialogOpen(false);
        try {
            await visitacaoService.atualizarParticipacao(visita.participacao_id, {
                foto_url: null
            });
            setFotoUrl(null);
            toast.success('Foto removida com sucesso!');
        } catch (error) {
            console.error('Erro ao remover foto:', error);
            toast.error('Erro ao remover foto.');
        } finally {
            setUploading(false);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    }, [processFile]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    useEffect(() => {
        async function loadVisita() {
            if (!id) return;
            try {
                // 1. Try to fetch from active visits
                let { data } = await supabase
                    .from('visita_participacao')
                    .select(`
                        *,
                        participacoes:participacao_id (
                            id,
                            encontro_id,
                            foto_url,
                            pessoas (*)
                        )
                    `)
                    .eq('id', id)
                    .maybeSingle();

                let isHistoryRecord = false;

                if (data) {
                    setVisita(data);
                    setIsHistory(false);
                    isHistoryRecord = false;
                } else {
                    // 2. Try to fetch from canceled history
                    const { data: historyData, error: historyError } = await supabase
                        .from('participacoes_canceladas')
                        .select(`
                            *,
                            pessoas (*)
                        `)
                        .eq('id', id)
                        .maybeSingle();

                    if (historyError) throw historyError;

                    if (historyData) {
                        isHistoryRecord = true;
                        setIsHistory(true);
                        // Map history data to match expected structure
                        const mappedData: VisitaParticipacaoEnriched = {
                            id: historyData.id,
                            grupo_id: historyData.grupo_id || '',
                            visitante: false,
                            status: (historyData.status_visita as VisitaStatus) || 'cancelada',
                            observacoes: historyData.observacoes || '',
                            taxa_paga: historyData.dados_snapshot?.taxa_paga || false,
                            participacao_id: historyData.dados_snapshot?.participacao_id || '',
                            created_at: historyData.data_cancelamento || '',
                            foto_url: null,
                            data_visita: null,
                            participacoes: {
                                id: historyData.dados_snapshot?.participacao_id || '',
                                encontro_id: historyData.encontro_id,
                                foto_url: null,
                                pessoas: historyData.pessoas
                            }
                        };
                        setVisita(mappedData);
                        data = mappedData;
                    }
                }

                if (data) {
                    setStatus(data.status || 'pendente');
                    setObservacoes(data.observacoes || '');
                    setTaxaPaga(data.taxa_paga || false);

                    // Photo is now in participacoes
                    const part = data.participacoes as ParticipacaoComPessoa | null;
                    setFotoUrl(part?.foto_url || null);

                    const p = (data.participacoes as ParticipacaoComPessoa | null)?.pessoas;
                    if (p) {
                        setNomeCompleto(p.nome_completo || '');
                        setTelefone(formatTelefone(p.telefone || ''));
                        setEndereco(p.endereco || '');
                        setNumero(p.numero || '');
                        setComplemento(p.complemento || '');
                        setCep(p.cep || '');
                        setBairro(p.bairro || '');
                        setCidade(p.cidade || '');
                        setEstado(p.estado || '');
                        setDataNascimento(p.data_nascimento || '');
                        setNomePai(p.nome_pai || '');
                        setTelefonePai(formatTelefone(p.telefone_pai || ''));
                        setNomeMae(p.nome_mae || '');
                        setTelefoneMae(formatTelefone(p.telefone_mae || ''));
                        setRestricaoAlimentar(p.restricao_alimentar || '');
                        setMedicamentoContinuo(p.medicamento_continuo || '');
                        setAlergia(p.alergia || '');
                        setObservacoesSaude(p.observacoes_saude || '');
                    }

                    // Load shirt intentions (only for real visits, not history)
                    if (!isHistoryRecord && data.id) {
                        try {
                            const intData = await visitacaoService.listarIntencoes(data.id);
                            setIntencoes(intData);
                        } catch { /* silently ignore */ }
                    }

                    if (!isHistoryRecord && data.participacao_id) {
                        try {
                            const dadosRecepcao = await recepcaoService.obterPorParticipacao(data.participacao_id);
                            setRecepcaoDados(dadosRecepcao);
                            if (dadosRecepcao) {
                                setRecepcaoForm({
                                    veiculo_tipo: dadosRecepcao.veiculo_tipo,
                                    veiculo_modelo: dadosRecepcao.veiculo_modelo,
                                    veiculo_cor: dadosRecepcao.veiculo_cor,
                                    veiculo_placa: formatPlate(dadosRecepcao.veiculo_placa),
                                });
                            }
                        } catch (error) {
                            console.error('Erro ao carregar dados de recepção:', error);
                        }
                    }

                    // Load shirt models for the encontro
                    const encontroId = part?.encontro_id;
                    if (encontroId) {
                        try {
                            const [mods, tams] = await Promise.all([
                                camisetaService.listarModelos(encontroId),
                                camisetaService.listarTamanhos()
                            ]);
                            setModelosCamiseta((mods as CamisetaModeloComStatus[]).filter(m => m.esta_ativo_no_encontro !== false));
                            setTamanhosCamiseta(tams);
                        } catch { /* silently ignore */ }
                    }
                } else {
                    toast.error('Visita não encontrada.');
                    navigate('/visitacao/meus-participantes');
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
        setIsPhotoActionSheetOpen(false);
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    const handlePhotoAreaClick = () => {
        if (uploading) return;
        if (window.innerWidth <= 768) {
            setIsPhotoActionSheetOpen(true);
        } else {
            fileInputRef.current?.click();
        }
    };

    const handleSave = async () => {
        if (!id || !visita) return;

        if (status === 'cancelada') {
            setIsConfirmDialogOpen(true);
            return;
        }

        await executeSave();
    };

    const handleConfirmCancel = async () => {
        if (!id || !visita) return;
        setSaving(true);
        try {
            // 1. Record the cancellation in the history table
            await inscricaoService.registrarCancelamento({
                pessoa_id: (visita.participacoes as ParticipacaoComPessoa | null)?.pessoas?.id || '',
                encontro_id: (visita.participacoes as ParticipacaoComPessoa | null)?.encontro_id || '',
                grupo_id: visita.grupo_id,
                status_visita: status,
                observacoes: observacoes,
                dados_snapshot: {
                    visita_participacao_id: id,
                    participacao_id: visita.participacao_id,
                    taxa_paga: taxaPaga,
                    data_registro: new Date().toISOString()
                }
            });

            // 2. Delete the visitation link (visita_participacao)
            await visitacaoService.desvincular(id);

            // 3. Delete the meeting registration (participacoes)
            // As requested, this removes the person from the meeting entirely
            await inscricaoService.desvincularDoEncontro(visita.participacao_id);

            toast.success('Pessoa marcada como desistente e participação removida do encontro.');
            navigate('/visitacao/meus-participantes');
        } catch (error) {
            console.error('Erro ao cancelar:', error);
            toast.error('Erro ao processar cancelamento.');
            setSaving(false);
        }
    };

    const executeSave = async () => {
        if (!id || !visita) return;
        setSaving(true);
        try {
            await visitacaoService.atualizarVisita(id, {
                status,
                observacoes,
                taxa_paga: taxaPaga,
                data_visita: status === 'realizada' ? new Date().toISOString() : (visita.data_visita || undefined)
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
                    complemento,
                    cep,
                    bairro,
                    cidade,
                    estado,
                    data_nascimento: dataNascimento,
                    nome_pai: nomePai,
                    telefone_pai: telefonePai,
                    nome_mae: nomeMae,
                    telefone_mae: telefoneMae,
                    restricao_alimentar: restricaoAlimentar || null,
                    medicamento_continuo: medicamentoContinuo || null,
                    alergia: alergia || null,
                    observacoes_saude: observacoesSaude || null
                });
            }

            // Save shirt intentions
            await visitacaoService.salvarIntencoes(id, intencoes);

            toast.success('Dados salvos com sucesso!');
            navigate('/visitacao/meus-participantes');
        } catch (error) {
            console.error('Erro ao salvar:', error);
            toast.error('Erro ao salvar alterações.');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveRecepcao = async () => {
        if (!visita?.participacao_id) return;

        if (!recepcaoForm.veiculo_modelo.trim()) {
            toast.error('O modelo do veículo é obrigatório.');
            return;
        }
        if (!recepcaoForm.veiculo_cor.trim()) {
            toast.error('A cor do veículo é obrigatória.');
            return;
        }
        if (!recepcaoForm.veiculo_placa.trim()) {
            toast.error('A placa do veículo é obrigatória.');
            return;
        }

        setSavingRecepcao(true);
        try {
            const result = await recepcaoService.salvar(
                visita.participacao_id,
                {
                    ...recepcaoForm,
                    veiculo_placa: cleanPlate(recepcaoForm.veiculo_placa),
                },
                visita.id
            );
            setRecepcaoDados(result);
            setShowRecepcaoForm(false);
            setRecepcaoForm({
                veiculo_tipo: result.veiculo_tipo,
                veiculo_modelo: result.veiculo_modelo,
                veiculo_cor: result.veiculo_cor,
                veiculo_placa: formatPlate(result.veiculo_placa),
            });
            toast.success('Dados do veículo salvos com sucesso!');
        } catch (error) {
            console.error('Erro ao salvar dados de recepção:', error);
            toast.error('Erro ao salvar dados do veículo.');
        } finally {
            setSavingRecepcao(false);
        }
    };

    const handleDeleteRecepcao = async () => {
        if (!recepcaoDados) return;
        if (!window.confirm('Deseja realmente remover os dados do veículo deste encontrista?')) return;

        setDeletingRecepcao(true);
        try {
            await recepcaoService.excluir(recepcaoDados.id);
            setRecepcaoDados(null);
            setRecepcaoForm({
                veiculo_tipo: 'carro',
                veiculo_modelo: '',
                veiculo_cor: '',
                veiculo_placa: '',
            });
            setShowRecepcaoForm(false);
            toast.success('Veículo removido com sucesso!');
        } catch (error) {
            console.error('Erro ao excluir dados de recepção:', error);
            toast.error('Erro ao remover veículo.');
        } finally {
            setDeletingRecepcao(false);
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

            {isHistory && (
                <div className="card" style={{ marginBottom: '1.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#ef4444' }}>
                    <Info size={20} />
                    <p style={{ margin: 0, fontWeight: 600 }}>
                        Esta pessoa foi marcada como DESISTENTE e arquivada no histórico. Os dados abaixo são apenas para consulta.
                    </p>
                </div>
            )}

            {/* HERO CARD: Photo + Person Info */}
            <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem', overflow: 'hidden' }}>
                <div className="visita-hero-row">
                    {/* Photo Area with Drag & Drop */}
                    <div
                        className={`visita-photo-area ${isDragging ? 'dragging' : ''} ${fotoUrl ? 'has-photo' : ''}`}
                        onClick={handlePhotoAreaClick}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                    >
                        {fotoUrl ? (
                            <img src={fotoUrl} alt="Foto do encontrista" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <div className="visita-photo-placeholder">
                                {isDragging ? (
                                    <>
                                        <Upload size={36} />
                                        <span>Solte a foto aqui</span>
                                    </>
                                ) : (
                                    <>
                                        <ImagePlus size={36} />
                                        <span>Clique ou arraste</span>
                                        <span style={{ fontSize: '0.65rem' }}>uma foto aqui</span>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Hover overlay on existing photo */}
                        {fotoUrl && !uploading && (
                            <div className="visita-photo-overlay">
                                <Camera size={24} />
                                <span>Alterar</span>
                            </div>
                        )}

                        {fotoUrl && !uploading && (
                            <button
                                onClick={removePhoto}
                                style={{
                                    position: 'absolute',
                                    top: '8px',
                                    right: '8px',
                                    background: 'rgba(239, 68, 68, 0.9)',
                                    color: 'white',
                                    border: 'none',
                                    padding: 0,
                                    margin: 0,
                                    borderRadius: '50%',
                                    width: '32px',
                                    height: '32px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    zIndex: 9999,
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#ef4444'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.9)'}
                                title="Remover Foto"
                            >
                                <Trash2 size={16} color="white" />
                            </button>
                        )}

                        {uploading && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px' }}>
                                <Loader className="animate-spin" color="white" size={32} />
                            </div>
                        )}

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={handleFileUpload}
                            disabled={uploading}
                        />

                        <input
                            ref={cameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            style={{ display: 'none' }}
                            onChange={handleFileUpload}
                            disabled={uploading}
                        />
                    </div>

                    {/* Person Info */}
                    <div className="visita-hero-info">
                        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>
                            {(visita.participacoes as ParticipacaoComPessoa | null)?.pessoas?.nome_completo}
                        </h2>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, background: 'var(--secondary-bg)', border: '1px solid var(--border-color)' }}>
                                <User size={12} /> {(() => {
                                    const cpf = (visita.participacoes as ParticipacaoComPessoa | null)?.pessoas?.cpf;
                                    return cpf ? formatCpf(cpf) : 'CPF não informado';
                                })()}
                            </span>
                            {(visita.participacoes as ParticipacaoComPessoa | null)?.pessoas?.telefone && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, background: 'var(--secondary-bg)', border: '1px solid var(--border-color)' }}>
                                    <Phone size={12} /> {formatTelefone((visita.participacoes as ParticipacaoComPessoa | null)?.pessoas?.telefone)}
                                </span>
                            )}
                        </div>
                        {((visita.participacoes as ParticipacaoComPessoa | null)?.pessoas?.endereco) && (
                            <p style={{ margin: '0.75rem 0 0', fontSize: '0.85rem', opacity: 0.6, display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                                <Home size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                                <span>
                                    {(visita.participacoes as ParticipacaoComPessoa | null)?.pessoas?.endereco}
                                    {(visita.participacoes as ParticipacaoComPessoa | null)?.pessoas?.numero ? `, ${(visita.participacoes as ParticipacaoComPessoa | null)?.pessoas?.numero}` : ''}
                                    {(visita.participacoes as ParticipacaoComPessoa | null)?.pessoas?.complemento ? ` - ${(visita.participacoes as ParticipacaoComPessoa | null)?.pessoas?.complemento}` : ''}
                                    <br />
                                    {[(visita.participacoes as ParticipacaoComPessoa | null)?.pessoas?.bairro, (visita.participacoes as ParticipacaoComPessoa | null)?.pessoas?.cidade].filter(Boolean).join(' — ')}
                                    {(visita.participacoes as ParticipacaoComPessoa | null)?.pessoas?.estado ? `/${(visita.participacoes as ParticipacaoComPessoa | null)?.pessoas?.estado}` : ''}
                                    {(visita.participacoes as ParticipacaoComPessoa | null)?.pessoas?.cep ? ` • CEP: ${(visita.participacoes as ParticipacaoComPessoa | null)?.pessoas?.cep}` : ''}
                                </span>
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* FORM CONTENT */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="card" style={{ padding: '2rem' }}>
                    <div className="form-group">
                        <label>Status da Visita</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem', marginTop: '0.5rem', padding: '0.5rem' }}>
                            {(['pendente', 'realizada', 'ausente', 'cancelada'] as VisitaStatus[]).map((s) => {
                                const getStatusColor = (status: string) => {
                                    switch (status) {
                                        case 'pendente': return '#f59e0b';
                                        case 'realizada': return '#10b981';
                                        case 'ausente': return '#64748b';
                                        case 'cancelada': return '#ef4444';
                                        default: return 'var(--primary-color)';
                                    }
                                };
                                const getStatusBgColor = (status: string) => {
                                    switch (status) {
                                        case 'pendente': return 'rgba(245, 158, 11, 0.1)';
                                        case 'realizada': return 'rgba(16, 185, 129, 0.1)';
                                        case 'ausente': return 'rgba(100, 116, 139, 0.1)';
                                        case 'cancelada': return 'rgba(239, 68, 68, 0.1)';
                                        default: return 'var(--primary-color)10';
                                    }
                                };
                                return (
                                    <button
                                        key={s}
                                        onClick={() => !isHistory && setStatus(s)}
                                        style={{
                                            padding: '0.75rem', borderRadius: '10px', border: '2px solid',
                                            borderColor: status === s ? getStatusColor(s) : 'var(--border-color)',
                                            background: status === s ? getStatusBgColor(s) : 'transparent',
                                            color: status === s ? getStatusColor(s) : 'inherit',
                                            fontWeight: status === s ? 700 : 400,
                                            cursor: isHistory ? 'default' : 'pointer', transition: 'all 0.2s', textTransform: 'capitalize',
                                            opacity: isHistory && status !== s ? 0.5 : 1
                                        }}
                                        disabled={isHistory}
                                    >
                                        {s === 'cancelada' ? 'desistente' : s}
                                    </button>
                                );
                            })}
                        </div>
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
                            onClick={() => !isHistory && setTaxaPaga(!taxaPaga)}
                            style={{
                                width: '56px', height: '30px', borderRadius: '20px',
                                background: taxaPaga ? '#10b981' : '#cbd5e1',
                                position: 'relative', cursor: isHistory ? 'default' : 'pointer', transition: 'all 0.3s ease',
                                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)',
                                opacity: isHistory ? 0.7 : 1
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

                    {!isHistory && (
                        <div style={{
                            marginTop: '2rem',
                            padding: '1.5rem',
                            borderRadius: '16px',
                            background: recepcaoDados
                                ? 'linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(37, 99, 235, 0.03) 100%)'
                                : 'var(--secondary-bg)',
                            border: recepcaoDados ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid var(--border-color)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0 }}>
                                    <div style={{
                                        background: recepcaoDados ? '#2563eb' : 'var(--muted-text)',
                                        color: 'white',
                                        padding: '0.6rem',
                                        borderRadius: '10px',
                                        display: 'flex'
                                    }}>
                                        <Car size={20} />
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <h4 style={{ margin: 0, color: recepcaoDados ? '#2563eb' : 'inherit' }}>Veículo para Recepção</h4>
                                        <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6 }}>
                                            {recepcaoDados
                                                ? 'Dados vinculados a esta visita e ao encontrista.'
                                                : 'Informe o veículo do encontrista para a recepção.'}
                                        </p>
                                    </div>
                                </div>
                                {recepcaoDados && (
                                    <div
                                        style={{
                                            display: 'inline-block',
                                            backgroundColor: '#2563eb',
                                            color: 'white',
                                            padding: '0.15rem 0.6rem',
                                            borderRadius: '6px',
                                            fontWeight: 600,
                                            fontSize: '0.95rem',
                                            textTransform: 'uppercase',
                                            boxShadow: '0 2px 4px rgba(37, 99, 235, 0.3)',
                                            letterSpacing: formatPlate(recepcaoDados.veiculo_placa).includes('-') ? '0.05em' : '0.15em'
                                        }}
                                    >
                                        {formatPlate(recepcaoDados.veiculo_placa)}
                                    </div>
                                )}
                            </div>

                            {recepcaoDados && !showRecepcaoForm && (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ textAlign: 'left', opacity: 0.55 }}>
                                                <th style={{ padding: '0.45rem 0.35rem', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.68rem' }}>Tipo</th>
                                                <th style={{ padding: '0.45rem 0.35rem', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.68rem' }}>Modelo</th>
                                                <th style={{ padding: '0.45rem 0.35rem', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.68rem' }}>Cor</th>
                                                <th style={{ padding: '0.45rem 0.35rem', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.68rem' }}>Placa</th>
                                                <th style={{ width: '88px' }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr style={{ borderTop: '1px solid var(--border-color)' }}>
                                                <td style={{ padding: '0.55rem 0.35rem', textTransform: 'capitalize' }}>{recepcaoDados.veiculo_tipo}</td>
                                                <td style={{ padding: '0.55rem 0.35rem', fontWeight: 600 }}>{recepcaoDados.veiculo_modelo}</td>
                                                <td style={{ padding: '0.55rem 0.35rem' }}>{recepcaoDados.veiculo_cor}</td>
                                                <td style={{ padding: '0.55rem 0.35rem', fontWeight: 700 }}>{formatPlate(recepcaoDados.veiculo_placa)}</td>
                                                <td style={{ padding: '0.55rem 0.35rem', textAlign: 'right', verticalAlign: 'middle' }}>
                                                    <div style={{ display: 'inline-flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowRecepcaoForm(true)}
                                                        className="icon-btn"
                                                        disabled={deletingRecepcao}
                                                        title="Editar veículo"
                                                        aria-label="Editar veículo"
                                                        style={{ width: '34px', height: '34px', padding: 0, color: 'var(--primary-color)' }}
                                                    >
                                                        <Pencil size={15} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleDeleteRecepcao}
                                                        className="icon-btn"
                                                        disabled={deletingRecepcao}
                                                        title="Excluir veículo"
                                                        aria-label="Excluir veículo"
                                                        style={{ width: '34px', height: '34px', padding: 0, color: '#ef4444' }}
                                                    >
                                                        {deletingRecepcao ? <Loader className="animate-spin" size={15} /> : <Trash2 size={15} />}
                                                    </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {!recepcaoDados && !showRecepcaoForm && (
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowRecepcaoForm(true)}
                                        className="btn-secondary"
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                    >
                                        <Car size={16} />
                                        Adicionar veículo
                                    </button>
                                </div>
                            )}

                            {showRecepcaoForm && (
                                <>
                                    <RadioGroup
                                        label="Tipo de veículo"
                                        options={[
                                            { label: 'Carro', value: 'carro' },
                                            { label: 'Moto', value: 'moto' },
                                        ]}
                                        value={recepcaoForm.veiculo_tipo}
                                        onChange={val => setRecepcaoForm(prev => ({ ...prev, veiculo_tipo: val as 'carro' | 'moto' }))}
                                    />

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.9rem', alignItems: 'end' }}>
                                        <FormField
                                            label="Modelo"
                                            required
                                            floating={false}
                                            value={recepcaoForm.veiculo_modelo}
                                            onChange={e => setRecepcaoForm(prev => ({ ...prev, veiculo_modelo: e.target.value }))}
                                            disabled={savingRecepcao}
                                        />
                                        <FormField
                                            label="Cor"
                                            required
                                            floating={false}
                                            value={recepcaoForm.veiculo_cor}
                                            onChange={e => setRecepcaoForm(prev => ({ ...prev, veiculo_cor: e.target.value }))}
                                            disabled={savingRecepcao}
                                        />
                                        <FormField
                                            label="Placa"
                                            required
                                            floating={false}
                                            placeholder="ABC-1234 ou ABC1D23"
                                            value={recepcaoForm.veiculo_placa}
                                            onChange={e => setRecepcaoForm(prev => ({ ...prev, veiculo_placa: formatPlate(e.target.value) }))}
                                            disabled={savingRecepcao}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
                                        <button
                                            type="button"
                                            onClick={() => setShowRecepcaoForm(false)}
                                            className="btn-outline"
                                            disabled={savingRecepcao}
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSaveRecepcao}
                                            className="btn-secondary"
                                            disabled={savingRecepcao}
                                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '150px', justifyContent: 'center' }}
                                        >
                                            {savingRecepcao ? <Loader className="animate-spin" size={16} /> : <Car size={16} />}
                                            Salvar veículo
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* ---- INTENÇÃO DE CAMISETA ---- */}
                    {!isHistory && (
                        <div style={{
                            marginTop: '2rem',
                            borderRadius: '16px',
                            border: intencoes.length > 0
                                ? '1px solid rgba(99, 102, 241, 0.3)'
                                : '1px solid var(--border-color)',
                            background: intencoes.length > 0
                                ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.06) 0%, rgba(99, 102, 241, 0.02) 100%)'
                                : 'var(--secondary-bg)',
                            overflow: 'hidden',
                            transition: 'all 0.3s ease'
                        }}>
                            {/* Header */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem',
                                padding: '1.25rem 1.5rem',
                                borderBottom: (showAddIntencao || intencoes.length > 0) ? '1px solid var(--border-color)' : 'none'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: '1 1 200px' }}>
                                    <div style={{
                                        background: intencoes.length > 0 ? '#6366f1' : 'var(--muted-text)',
                                        color: 'white', padding: '0.5rem', borderRadius: '10px',
                                        transition: 'all 0.3s ease', display: 'flex'
                                    }}>
                                        <Shirt size={18} />
                                    </div>
                                    <div>
                                        <h4 style={{ margin: 0, color: intencoes.length > 0 ? '#6366f1' : 'inherit' }}>
                                            Intenção de Camiseta
                                            {intencoes.length > 0 && (
                                                <span style={{
                                                    marginLeft: '0.5rem', fontSize: '0.75rem', fontWeight: 700,
                                                    background: '#6366f1', color: 'white',
                                                    padding: '2px 8px', borderRadius: '999px'
                                                }}>
                                                    {intencoes.reduce((s, i) => s + i.quantidade, 0)} un.
                                                </span>
                                            )}
                                        </h4>
                                        <p style={{ margin: 0, fontSize: '0.78rem', opacity: 0.6 }}>
                                            Registre o interesse — não é um pedido formal
                                        </p>
                                    </div>
                                </div>
                                {!showAddIntencao && modelosCamiseta.length > 0 && (
                                    <button
                                        onClick={() => {
                                            const firstMod = modelosCamiseta[0];
                                            const firstTam = tamanhosCamiseta.filter(t => !t.modelo_id || t.modelo_id === firstMod.id)[0]?.sigla || '';
                                            setNewIntencao({ modelo_id: firstMod.id, tamanho: firstTam, quantidade: 1 });
                                            setShowAddIntencao(true);
                                        }}
                                        className="btn-mobile-full"
                                        style={{
                                            background: '#6366f1', color: 'white', border: 'none',
                                            borderRadius: '10px', padding: '0.5rem 1rem',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                                            fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <Plus size={16} /> Adicionar
                                    </button>
                                )}
                                {!showAddIntencao && modelosCamiseta.length === 0 && (
                                    <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>Nenhum modelo disponível</span>
                                )}
                            </div>

                            {/* Lista de intenções */}
                            {intencoes.length > 0 && (
                                <div style={{ padding: '0.75rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {intencoes.map((item, idx) => {
                                        const modeloNome = item.camiseta_modelos?.nome
                                            || modelosCamiseta.find(m => m.id === item.modelo_id)?.nome
                                            || 'Modelo';
                                        return (
                                            <div key={idx} style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                padding: '0.6rem 0.75rem', borderRadius: '10px',
                                                background: 'rgba(99, 102, 241, 0.07)',
                                                border: '1px solid rgba(99, 102, 241, 0.15)'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <Shirt size={14} color="#6366f1" />
                                                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{modeloNome}</span>
                                                    <span style={{
                                                        fontSize: '0.78rem', fontWeight: 700, padding: '2px 8px',
                                                        borderRadius: '6px', background: 'rgba(99,102,241,0.15)', color: '#6366f1'
                                                    }}>{item.tamanho}</span>
                                                    <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>× {item.quantidade}</span>
                                                </div>
                                                <button
                                                    onClick={() => setIntencoes(prev => prev.filter((_, i) => i !== idx))}
                                                    style={{
                                                        background: 'none', border: 'none', cursor: 'pointer',
                                                        color: '#ef4444', opacity: 0.5, padding: '4px',
                                                        display: 'flex', transition: 'opacity 0.2s'
                                                    }}
                                                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                                                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
                                                    title="Remover"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Mini-form para adicionar */}
                            {showAddIntencao && (
                                <div style={{ padding: '1rem 1.5rem', background: 'rgba(99,102,241,0.04)' }}>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
                                        <div className="form-group" style={{ marginBottom: 0, flex: '1 1 180px' }}>
                                            <label className="form-label" style={{ fontSize: '0.78rem' }}>Modelo</label>
                                            <select
                                                className="form-input"
                                                value={newIntencao.modelo_id}
                                                onChange={e => {
                                                    const modId = e.target.value;
                                                    const firstTam = tamanhosCamiseta.filter(t => !t.modelo_id || t.modelo_id === modId)[0]?.sigla || '';
                                                    setNewIntencao(prev => ({ ...prev, modelo_id: modId, tamanho: firstTam }));
                                                }}
                                                style={{ height: '42px', fontSize: '0.875rem', padding: '0 0.75rem' }}
                                            >
                                                {modelosCamiseta.map(m => (
                                                    <option key={m.id} value={m.id}>{m.nome}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0, flex: '1 1 100px' }}>
                                            <label className="form-label" style={{ fontSize: '0.78rem' }}>Tamanho</label>
                                            <select
                                                className="form-input"
                                                value={newIntencao.tamanho}
                                                onChange={e => setNewIntencao(prev => ({ ...prev, tamanho: e.target.value }))}
                                                style={{ height: '42px', fontSize: '0.875rem', padding: '0 0.75rem' }}
                                            >
                                                {tamanhosCamiseta
                                                    .filter(t => !t.modelo_id || t.modelo_id === newIntencao.modelo_id)
                                                    .sort((a, b) => a.ordem - b.ordem)
                                                    .map(t => (
                                                        <option key={t.id} value={t.sigla}>{t.sigla}</option>
                                                    ))}
                                            </select>
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0, flex: '0 0 70px' }}>
                                            <label className="form-label" style={{ fontSize: '0.78rem' }}>Qtd</label>
                                            <input
                                                type="number" min={1} max={10}
                                                className="form-input"
                                                value={newIntencao.quantidade}
                                                onChange={e => setNewIntencao(prev => ({ ...prev, quantidade: Math.max(1, parseInt(e.target.value) || 1) }))}
                                                style={{ height: '42px', fontSize: '0.875rem', width: '70px', textAlign: 'center' }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.4rem', flex: '1 1 auto', justifyContent: 'flex-end' }}>
                                            <button
                                                onClick={() => {
                                                    if (!newIntencao.modelo_id || !newIntencao.tamanho) return;
                                                    setIntencoes(prev => [...prev, { ...newIntencao }]);
                                                    setShowAddIntencao(false);
                                                }}
                                                style={{
                                                    background: '#6366f1', color: 'white', border: 'none',
                                                    borderRadius: '10px', padding: '0 1rem', height: '42px',
                                                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                                                    fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                                                    whiteSpace: 'nowrap'
                                                }}
                                                disabled={!newIntencao.modelo_id || !newIntencao.tamanho}
                                            >
                                                <Plus size={15} /> OK
                                            </button>
                                            <button
                                                onClick={() => setShowAddIntencao(false)}
                                                style={{
                                                    background: 'none', border: '1px solid var(--border-color)',
                                                    borderRadius: '10px', padding: '0 0.75rem', height: '42px',
                                                    display: 'flex', alignItems: 'center', cursor: 'pointer',
                                                    color: 'var(--text-color)'
                                                }}
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Botão adicionar mais (quando já tem itens e não está no form) */}
                            {!showAddIntencao && intencoes.length > 0 && modelosCamiseta.length > 0 && (
                                <div style={{ padding: '0.5rem 1.5rem 1rem' }}>
                                    <button
                                        onClick={() => {
                                            const firstMod = modelosCamiseta[0];
                                            const firstTam = tamanhosCamiseta.filter(t => !t.modelo_id || t.modelo_id === firstMod.id)[0]?.sigla || '';
                                            setNewIntencao({ modelo_id: firstMod.id, tamanho: firstTam, quantidade: 1 });
                                            setShowAddIntencao(true);
                                        }}
                                        style={{
                                            background: 'none', border: '1px dashed rgba(99,102,241,0.4)',
                                            borderRadius: '8px', padding: '0.4rem 0.75rem',
                                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                                            fontSize: '0.8rem', color: '#6366f1', cursor: 'pointer', fontWeight: 600
                                        }}
                                    >
                                        <Plus size={14} /> Adicionar outro modelo
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <div style={{ paddingTop: '2rem' }}>
                        <FormSection title="Correção de Dados Cadastrais" icon={<Info size={20} />}>
                            <p style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '1.5rem', marginTop: '-0.5rem' }}>
                                Caso encontre erros nos dados do encontrista durante a visita, corrija-os abaixo para atualizar o sistema.
                            </p>

                            <FormRow>
                                <FormField
                                    label="Nome Completo"
                                    value={nomeCompleto}
                                    onChange={e => setNomeCompleto(e.target.value)}
                                    colSpan={6}
                                    icon={<User size={18} />}
                                    disabled={isHistory}
                                />
                                <FormField
                                    label="Telefone Encontrista"
                                    value={telefone}
                                    onChange={e => setTelefone(formatTelefone(e.target.value))}
                                    colSpan={3}
                                    icon={<Phone size={18} />}
                                    disabled={isHistory}
                                />
                                <FormField
                                    label="Data de Nascimento"
                                    value={dataNascimento}
                                    onChange={e => setDataNascimento(e.target.value)}
                                    colSpan={3}
                                    type="date"
                                    icon={<Calendar size={18} />}
                                    disabled={isHistory}
                                />
                            </FormRow>

                            <FormRow>
                                <FormField
                                    label="CEP"
                                    value={cep}
                                    onChange={e => setCep(e.target.value)}
                                    colSpan={2}
                                    icon={<Home size={18} />}
                                    disabled={isHistory}
                                />
                                <FormField
                                    label="Bairro"
                                    value={bairro}
                                    onChange={e => setBairro(e.target.value)}
                                    colSpan={4}
                                    disabled={isHistory}
                                />
                                <FormField
                                    label="Cidade"
                                    value={cidade}
                                    onChange={e => setCidade(e.target.value)}
                                    colSpan={4}
                                    disabled={isHistory}
                                />
                                <FormField
                                    label="Estado (UF)"
                                    value={estado}
                                    onChange={e => setEstado(e.target.value)}
                                    colSpan={2}
                                    disabled={isHistory}
                                />
                            </FormRow>

                            <FormRow>
                                <FormField
                                    label="Endereço / Rua"
                                    value={endereco}
                                    onChange={e => setEndereco(e.target.value)}
                                    colSpan={6}
                                    disabled={isHistory}
                                />
                                <FormField
                                    label="Nº"
                                    value={numero}
                                    onChange={e => setNumero(e.target.value)}
                                    colSpan={2}
                                    disabled={isHistory}
                                />
                                <FormField
                                    label="Complemento"
                                    value={complemento}
                                    onChange={e => setComplemento(e.target.value)}
                                    colSpan={4}
                                    disabled={isHistory}
                                />
                            </FormRow>
                        </FormSection>
                        <FormSection title="Filiação & Contatos" icon={<UsersRound size={18} />}>
                            <FormRow>
                                <FormField
                                    label="Nome do Pai"
                                    value={nomePai}
                                    onChange={e => setNomePai(e.target.value)}
                                    colSpan={8}
                                    disabled={isHistory}
                                />
                                <FormField
                                    label="Telefone do Pai"
                                    value={telefonePai}
                                    onChange={e => setTelefonePai(formatTelefone(e.target.value))}
                                    colSpan={4}
                                    icon={<Phone size={18} />}
                                    disabled={isHistory}
                                />
                            </FormRow>
                            <FormRow>
                                <FormField
                                    label="Nome da Mãe"
                                    value={nomeMae}
                                    onChange={e => setNomeMae(e.target.value)}
                                    colSpan={8}
                                    disabled={isHistory}
                                />
                                <FormField
                                    label="Telefone da Mãe"
                                    value={telefoneMae}
                                    onChange={e => setTelefoneMae(formatTelefone(e.target.value))}
                                    colSpan={4}
                                    icon={<Phone size={18} />}
                                    disabled={isHistory}
                                />
                            </FormRow>
                        </FormSection>

                        <FormSection title="Informações de Saúde" icon={<Heart size={18} />}>
                            <p style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '1.5rem', marginTop: '-0.5rem' }}>
                                Registre informações importantes sobre a saúde do encontrista para que a equipe esteja preparada.
                            </p>

                            <FormRow>
                                <div className="col-6">
                                    <div className="form-group">
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <UtensilsCrossed size={14} style={{ color: '#f59e0b' }} />
                                            Restrição Alimentar
                                        </label>
                                        <textarea
                                            className="form-input"
                                            value={restricaoAlimentar}
                                            onChange={e => setRestricaoAlimentar(e.target.value)}
                                            placeholder="Ex: Vegetariano, intolerante à lactose, celíaco..."
                                            style={{ minHeight: '80px', resize: 'vertical' }}
                                            disabled={isHistory}
                                        />
                                    </div>
                                </div>
                                <div className="col-6">
                                    <div className="form-group">
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <AlertTriangle size={14} style={{ color: '#ef4444' }} />
                                            Alergia
                                        </label>
                                        <textarea
                                            className="form-input"
                                            value={alergia}
                                            onChange={e => setAlergia(e.target.value)}
                                            placeholder="Ex: Amendoim, penicilina, látex, poeira..."
                                            style={{ minHeight: '80px', resize: 'vertical' }}
                                            disabled={isHistory}
                                        />
                                    </div>
                                </div>
                            </FormRow>
                            <FormRow>
                                <div className="col-6">
                                    <div className="form-group">
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <Pill size={14} style={{ color: '#6366f1' }} />
                                            Medicamento Contínuo
                                        </label>
                                        <textarea
                                            className="form-input"
                                            value={medicamentoContinuo}
                                            onChange={e => setMedicamentoContinuo(e.target.value)}
                                            placeholder="Ex: Insulina, antialérgico, antidepressivo..."
                                            style={{ minHeight: '80px', resize: 'vertical' }}
                                            disabled={isHistory}
                                        />
                                    </div>
                                </div>
                                <div className="col-6">
                                    <div className="form-group">
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <Heart size={14} style={{ color: '#10b981' }} />
                                            Observações de Saúde
                                        </label>
                                        <textarea
                                            className="form-input"
                                            value={observacoesSaude}
                                            onChange={e => setObservacoesSaude(e.target.value)}
                                            placeholder="Ex: Epilepsia, diabetes, asma, deficiência física..."
                                            style={{ minHeight: '80px', resize: 'vertical' }}
                                            disabled={isHistory}
                                        />
                                    </div>
                                </div>
                            </FormRow>
                        </FormSection>

                        <FormSection title="Observações da Visita" icon={<Info size={20} />}>
                            <p style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '1.5rem', marginTop: '-0.5rem' }}>
                                Registre aqui qualquer detalhe importante coletado durante a visita, impressões ou recados da família.
                            </p>
                            <div className="form-group">
                                <textarea
                                    className="form-input"
                                    value={observacoes}
                                    onChange={(e) => setObservacoes(e.target.value)}
                                    placeholder="Descreva como foi a visita, se houve alguma mudança de dados, etc..."
                                    style={{ minHeight: '150px', resize: 'vertical' }}
                                    disabled={isHistory}
                                />
                            </div>
                        </FormSection>
                    </div>

                    <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                        <button onClick={() => navigate('/visitacao/meus-participantes')} className="btn-outline">Cancelar</button>
                        <button
                            onClick={handleSave}
                            className="btn-primary"
                            disabled={saving || isHistory}
                            style={{
                                display: isHistory ? 'none' : 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0 2rem'
                            }}
                        >
                            {saving ? <Loader className="animate-spin" size={18} /> : <Save size={18} />}
                            Salvar Visita
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                    .visita-hero-row {
                        display: flex;
                        align-items: center;
                        gap: 2rem;
                    }
                    @media (max-width: 639px) {
                        .visita-hero-row {
                            flex-direction: column;
                            align-items: center;
                            text-align: center;
                        }
                        .visita-hero-info {
                            align-items: center;
                        }
                        .visita-hero-info p {
                            justify-content: center;
                        }
                    }
                    .visita-photo-area {
                        width: 160px;
                        height: 160px;
                        min-width: 160px;
                        border-radius: 16px;
                        background: var(--secondary-bg);
                        border: 2.5px dashed var(--border-color);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        overflow: hidden;
                        position: relative;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        box-shadow: inset 0 2px 6px rgba(0,0,0,0.04);
                    }
                    .visita-photo-area:hover {
                        border-color: var(--primary-color);
                        box-shadow: 0 0 0 4px rgba(var(--primary-rgb), 0.1);
                    }
                    .visita-photo-area.dragging {
                        border-color: var(--primary-color);
                        background: rgba(var(--primary-rgb), 0.08);
                        box-shadow: 0 0 0 6px rgba(var(--primary-rgb), 0.15);
                        transform: scale(1.02);
                    }
                    .visita-photo-area.has-photo {
                        border-style: solid;
                        border-color: transparent;
                    }
                    .visita-photo-area.has-photo:hover {
                        border-color: var(--primary-color);
                    }
                    .visita-photo-placeholder {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 0.25rem;
                        opacity: 0.35;
                        font-size: 0.75rem;
                        font-weight: 600;
                        color: var(--text-color);
                        transition: opacity 0.2s;
                    }
                    .visita-photo-area:hover .visita-photo-placeholder {
                        opacity: 0.6;
                    }
                    .visita-photo-area.dragging .visita-photo-placeholder {
                        opacity: 0.8;
                        color: var(--primary-color);
                    }
                    .visita-photo-overlay {
                        position: absolute;
                        inset: 0;
                        background: rgba(0,0,0,0.55);
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        gap: 0.25rem;
                        color: white;
                        font-weight: 700;
                        font-size: 0.8rem;
                        opacity: 0;
                        transition: opacity 0.25s ease;
                        border-radius: 14px;
                        pointer-events: none;
                    }
                    .visita-photo-area:hover .visita-photo-overlay {
                        opacity: 1;
                    }
                    .visita-hero-info {
                        flex: 1;
                        min-width: 0;
                        display: flex;
                        flex-direction: column;
                    }
                    /* Action Sheet Styles */
                    .photo-actions-modal-overlay {
                        position: fixed;
                        inset: 0;
                        background: rgba(0,0,0,0.6);
                        backdrop-filter: blur(4px);
                        z-index: 99999;
                        display: flex;
                        align-items: flex-end;
                        justify-content: center;
                        animation: fadeIn 0.2s ease-out;
                    }
                    @media (min-width: 640px) {
                        .photo-actions-modal-overlay {
                            align-items: center;
                        }
                    }
                    .photo-actions-modal {
                        background: var(--card-bg, #ffffff);
                        width: 100%;
                        max-width: 500px;
                        border-top-left-radius: 24px;
                        border-top-right-radius: 24px;
                        padding: 1.5rem;
                        box-shadow: 0 -10px 25px rgba(0,0,0,0.15);
                        display: flex;
                        flex-direction: column;
                        gap: 1rem;
                        animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    }
                    @media (min-width: 640px) {
                        .photo-actions-modal {
                            border-radius: 20px;
                            box-shadow: 0 10px 30px rgba(0,0,0,0.25);
                            animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                        }
                    }
                    .photo-actions-header {
                        text-align: center;
                    }
                    .photo-actions-header h3 {
                        margin: 0;
                        font-size: 1.2rem;
                        font-weight: 700;
                        color: var(--text-color);
                    }
                    .photo-actions-header p {
                        margin: 0.25rem 0 0;
                        font-size: 0.85rem;
                        color: var(--text-color);
                        opacity: 0.7;
                    }
                    .photo-actions-buttons {
                        display: flex;
                        flex-direction: column;
                        gap: 0.75rem;
                    }
                    .photo-action-btn {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 0.75rem;
                        padding: 1rem;
                        border-radius: 12px;
                        border: 1px solid var(--border-color);
                        background: var(--secondary-bg, #f8f9fa);
                        color: var(--text-color);
                        font-weight: 600;
                        font-size: 0.95rem;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .photo-action-btn:hover {
                        background: var(--primary-color);
                        color: white;
                        border-color: var(--primary-color);
                    }
                    .photo-actions-cancel {
                        padding: 0.75rem;
                        border-radius: 12px;
                        border: none;
                        background: rgba(239, 68, 68, 0.1);
                        color: #ef4444;
                        font-weight: 700;
                        font-size: 0.95rem;
                        cursor: pointer;
                        transition: all 0.2s;
                        text-align: center;
                    }
                    .photo-actions-cancel:hover {
                        background: #ef4444;
                        color: white;
                    }

                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    @keyframes slideUp {
                        from { transform: translateY(100%); }
                        to { transform: translateY(0); }
                    }
                    @keyframes scaleIn {
                        from { transform: scale(0.95); opacity: 0; }
                        to { transform: scale(1); opacity: 1; }
                    }
                `}</style>

            <ConfirmDialog
                isOpen={isConfirmDialogOpen}
                title="Confirmar Desistência"
                message="Marcar como DESISTENTE irá REMOVER esta pessoa do Encontro permanentemente (embora os dados fiquem salvos no histórico). Esta ação não pode ser desfeita. Deseja continuar?"
                confirmText="Sim, Confirmar Desistência"
                cancelText="Voltar"
                onConfirm={handleConfirmCancel}
                onCancel={() => setIsConfirmDialogOpen(false)}
                isLoading={saving}
                isDestructive={true}
            />

            <ConfirmDialog
                isOpen={isConfirmPhotoRemoveDialogOpen}
                title="Remover Foto"
                message="Deseja realmente remover a foto deste participante?"
                confirmText="Sim, Remover Foto"
                cancelText="Cancelar"
                onConfirm={handleConfirmRemovePhoto}
                onCancel={() => setIsConfirmPhotoRemoveDialogOpen(false)}
                isLoading={uploading}
                isDestructive={true}
            />

            {isPhotoActionSheetOpen && (
                <div className="photo-actions-modal-overlay">
                    <div className="photo-actions-modal" onClick={e => e.stopPropagation()}>
                        <div className="photo-actions-header">
                            <h3>Adicionar Foto</h3>
                            <p>Como você deseja inserir a foto?</p>
                        </div>
                        <div className="photo-actions-buttons">
                            <button
                                onClick={() => {
                                    setIsPhotoActionSheetOpen(false);
                                    cameraInputRef.current?.click();
                                }}
                                className="photo-action-btn"
                            >
                                <Camera size={20} />
                                Tirar Foto (Câmera)
                            </button>
                            <button
                                onClick={() => {
                                    setIsPhotoActionSheetOpen(false);
                                    fileInputRef.current?.click();
                                }}
                                className="photo-action-btn"
                            >
                                <ImagePlus size={20} />
                                Escolher da Galeria
                            </button>
                        </div>
                        <button className="photo-actions-cancel" onClick={() => setIsPhotoActionSheetOpen(false)}>
                            Cancelar
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
