import { Calendar, Check, Copy, Info, LinkIcon, Loader, Plus, QrCode, Shirt, Tag, X, FileText, Download } from 'lucide-react';
import React, { useState } from 'react';
import type { Encontro, EncontroFormData } from '../../types/encontro';
import { FormField } from '../ui/FormField';
import { CurrencyFormField } from '../ui/CurrencyFormField';
import { FormRow } from '../ui/FormRow';
import { FormSection } from '../ui/FormSection';
import toast from 'react-hot-toast';

interface EncontroFormProps {
    title: string;
    initialData?: Encontro;
    onSubmit: (data: EncontroFormData) => Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
}

type FormErrors = Partial<Record<keyof EncontroFormData, string>>;

function validate(data: EncontroFormData): FormErrors {
    const errors: FormErrors = {};
    if (!data.nome?.trim()) errors.nome = 'Nome é obrigatório.';
    if (!data.data_inicio) errors.data_inicio = 'Data de início é obrigatória.';
    if (!data.data_fim) errors.data_fim = 'Data de fim é obrigatória.';
    return errors;
}

export function EncontroForm({ title, initialData, onSubmit, onCancel, isLoading = false }: EncontroFormProps) {
    const [form, setForm] = useState<EncontroFormData>({
        nome: initialData?.nome ?? '',
        data_inicio: initialData?.data_inicio ?? '',
        data_fim: initialData?.data_fim ?? '',
        local: initialData?.local ?? '',
        descricao: initialData?.descricao ?? '',
        ativo: initialData?.ativo ?? false,
        formulario_publico_ativo: initialData?.formulario_publico_ativo ?? false,
        edicao: initialData?.edicao ?? null,
        tema: initialData?.tema ?? '',
        musica: initialData?.musica ?? '',
        link_musica: initialData?.link_musica ?? '',
        link_youtube: initialData?.link_youtube ?? '',
        limite_vagas_online: initialData?.limite_vagas_online ?? 0,
        valor_taxa: initialData?.valor_taxa ?? 0,
        pix_taxa_chave: initialData?.pix_taxa_chave ?? '',
        pix_taxa_tipo: initialData?.pix_taxa_tipo ?? null,
        pix_taxa_qrcode_url: initialData?.pix_taxa_qrcode_url ?? '',
        pix_camisetas_chave: initialData?.pix_camisetas_chave ?? '',
        pix_camisetas_tipo: initialData?.pix_camisetas_tipo ?? null,
        pix_camisetas_qrcode_url: initialData?.pix_camisetas_qrcode_url ?? '',
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleDownloadQr = async (url: string) => {
        if (!url) return;
        try {
            const fullUrl = url.startsWith('http') ? url : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/financeiro/${url}`;
            const response = await fetch(fullUrl);
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `pix_qrcode_${Date.now()}.${url.split('.').pop()}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            toast.error('Erro ao baixar arquivo');
        }
    };

    const openFile = (url: string) => {
        const fullUrl = url.startsWith('http') ? url : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/financeiro/${url}`;
        window.open(fullUrl, '_blank');
    };
    const [errors, setErrors] = useState<FormErrors>({});

    const [copied, setCopied] = useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        const url = `${window.location.origin}/formulario?encontro=${initialData?.id}`;
        navigator.clipboard.writeText(url);

        setCopied(true);
        toast.success('Link copiado!');

        setTimeout(() => setCopied(false), 2000);
    };

    const handleChange = (field: keyof EncontroFormData, value: string | number | boolean | null) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const erros = validate(form);
        if (Object.keys(erros).length > 0) {
            setErrors(erros);
            return;
        }

        setIsSubmitting(true);
        try {
            await onSubmit(form);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2.5rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>{title}</h2>

                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '1.25rem',
                    width: '100%',
                    backgroundColor: 'var(--surface-2)',
                    padding: '1.25rem',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                }}>
                    {/* Toggle: Ativo */}
                    <div style={{
                        flex: '1 1 280px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem'
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Encontro Ativo</span>
                            <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Status principal do sistema</span>
                        </div>
                        <div className="toggle-sim-nao">
                            <button
                                type="button"
                                className={`toggle-sim-nao-item ${form.ativo ? 'active-sim' : ''}`}
                                onClick={() => handleChange('ativo', true)}
                            >
                                Sim
                            </button>
                            <button
                                type="button"
                                className={`toggle-sim-nao-item ${!form.ativo ? 'active-nao' : ''}`}
                                onClick={() => handleChange('ativo', false)}
                            >
                                Não
                            </button>
                        </div>
                    </div>

                    {/* Divider Desktop Only */}
                    <div style={{ width: '1px', height: '40px', backgroundColor: 'var(--border-color)', opacity: 0.5 }} className="desktop-only" />

                    {/* Toggle: Form Público */}
                    <div style={{
                        flex: '1 1 280px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem'
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Liberar Formulários</span>
                            <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Recepção e Recreação</span>
                            {initialData && initialData.formulario_publico_ativo && (
                                <div className="encontro-detail-item" style={{ marginTop: '0.4rem', gap: '0.5rem' }}>
                                    <LinkIcon size={12} className="icon-dim" />
                                    <span style={{ fontSize: '0.75rem', opacity: 0.8, fontWeight: 500 }}>Link Formulários Recepção e Recreação</span>
                                    <div className="musica-actions">
                                        <button
                                            type="button"
                                            className={`mini-link-btn ${copied ? 'copied' : ''}`}
                                            onClick={handleCopy}
                                            title="Copiar Link"
                                            style={{ width: '22px', height: '22px' }}
                                        >
                                            {copied ? <Check size={12} className="icon-check-anim" /> : <Copy size={12} />}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="toggle-sim-nao">
                            <button
                                type="button"
                                className={`toggle-sim-nao-item ${form.formulario_publico_ativo ? 'active-sim' : ''}`}
                                onClick={() => handleChange('formulario_publico_ativo', true)}
                            >
                                Sim
                            </button>
                            <button
                                type="button"
                                className={`toggle-sim-nao-item ${!form.formulario_publico_ativo ? 'active-nao' : ''}`}
                                onClick={() => handleChange('formulario_publico_ativo', false)}
                            >
                                Não
                            </button>
                        </div>
                    </div>
                </div>
            </div>


            <FormSection title="Dados Básicos" icon={<Info size={18} />} columns={0}>
                <FormRow>
                    <FormField
                        label="Nome do Encontro"
                        name="nome"
                        value={form.nome}
                        onChange={(e) => handleChange('nome', e.target.value)}
                        error={errors.nome}
                        required
                        colSpan={6}
                        placeholder="Ex: 25º EJC Capelinha"
                    />
                    <FormField
                        label="Edição"
                        name="edicao"
                        type="number"
                        value={form.edicao ?? ''}
                        onChange={(e) => handleChange('edicao', e.target.value ? parseInt(e.target.value) : null)}
                        colSpan={2}
                        placeholder="Ex: 25"
                    />
                    <CurrencyFormField
                        label="Valor da Taxa"
                        name="valor_taxa"
                        value={form.valor_taxa}
                        onChange={(val) => handleChange('valor_taxa', val)}
                        colSpan={2}
                        placeholder="0,00"
                    />
                    <FormField
                        label="Limite Online"
                        name="limite_vagas_online"
                        type="number"
                        value={form.limite_vagas_online}
                        onChange={(e) => handleChange('limite_vagas_online', e.target.value ? parseInt(e.target.value) : 0)}
                        colSpan={2}
                        placeholder="71"
                    />

                </FormRow>
            </FormSection>

            <FormSection title="Datas e Local" icon={<Calendar size={18} />} columns={0}>
                <FormRow>
                    <FormField
                        label="Data Início"
                        name="data_inicio"
                        type="date"
                        value={form.data_inicio}
                        onChange={(e) => handleChange('data_inicio', e.target.value)}
                        error={errors.data_inicio}
                        required
                        colSpan={3}
                    />
                    <FormField
                        label="Data Fim"
                        name="data_fim"
                        type="date"
                        value={form.data_fim}
                        onChange={(e) => handleChange('data_fim', e.target.value)}
                        error={errors.data_fim}
                        required
                        colSpan={3}
                    />
                    <FormField
                        label="Local"
                        name="local"
                        value={form.local ?? ''}
                        onChange={(e) => handleChange('local', e.target.value)}
                        colSpan={6}
                        placeholder="Ex: Centro Pastoral"
                    />
                </FormRow>

            </FormSection>

            <FormSection title="Tema e Inspiração" icon={<Tag size={18} />} columns={0}>
                <FormRow>
                    <FormField
                        label="Tema"
                        name="tema"
                        value={form.tema ?? ''}
                        onChange={(e) => handleChange('tema', e.target.value)}
                        colSpan={6}
                        placeholder="Tema do encontro"
                    />
                    <FormField
                        label="Música Tema"
                        name="musica"
                        value={form.musica ?? ''}
                        onChange={(e) => handleChange('musica', e.target.value)}
                        colSpan={6}
                        placeholder="Título da música"
                    />
                </FormRow>
                <FormRow>
                    <FormField
                        label="Link da Música (Stream)"
                        name="link_musica"
                        value={form.link_musica ?? ''}
                        onChange={(e) => handleChange('link_musica', e.target.value)}
                        colSpan={6}
                        placeholder="Link Spotify, Deezer, etc."
                    />
                    <FormField
                        label="Link do YouTube"
                        name="link_youtube"
                        value={form.link_youtube ?? ''}
                        onChange={(e) => handleChange('link_youtube', e.target.value)}
                        colSpan={6}
                        placeholder="Link do vídeo/clipe"
                    />
                </FormRow>
                <FormRow>
                    <FormField
                        label="Descrição"
                        name="descricao"
                        as="textarea"
                        value={form.descricao ?? ''}
                        onChange={(e) => handleChange('descricao', e.target.value)}
                        colSpan={12}
                        placeholder="Informações adicionais..."
                    />
                </FormRow>
            </FormSection>

            <FormSection title="Informações de Pagamento" icon={<Info size={18} />} columns={0}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                    gap: '1.5rem',
                    marginTop: '0.5rem'
                }}>
                    {/* Painel Taxas */}
                    <div className="payment-config-card">
                        <div className="payment-card-header">
                            <div className="payment-icon taxa">
                                <FileText size={18} />
                            </div>
                            <h3 className="payment-card-title">Taxas</h3>
                        </div>

                        <div className="payment-card-body">
                            <div className="form-row-compact">
                                <div className="form-group floating-label-group" style={{ flex: '1 1 120px' }}>
                                    <div className="form-input-wrapper">
                                        <select
                                            id="pix_taxa_tipo"
                                            className="form-input floating-input"
                                            value={form.pix_taxa_tipo ?? ''}
                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChange('pix_taxa_tipo', e.target.value || null)}
                                        >
                                            <option value="">Selecione...</option>
                                            <option value="cpf">CPF</option>
                                            <option value="cnpj">CNPJ</option>
                                            <option value="email">E-mail</option>
                                            <option value="telefone">Telefone</option>
                                            <option value="aleatoria">Chave Aleatória</option>
                                        </select>
                                        <label className="form-label floating-label" htmlFor="pix_taxa_tipo">Tipo</label>
                                    </div>
                                </div>
                                <div className="form-group floating-label-group" style={{ flex: '2 1 200px' }}>
                                    <FormField
                                        label="Chave PIX (Taxas)"
                                        name="pix_taxa_chave"
                                        value={form.pix_taxa_chave ?? ''}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('pix_taxa_chave', e.target.value)}
                                        placeholder="Insira a chave"
                                    />
                                </div>
                            </div>

                            <div className="qrcode-upload-container">
                                <div className="qrcode-preview">
                                    {form.pix_taxa_qrcode_url ? (
                                        <div className="qrcode-image-wrapper" onClick={() => openFile(form.pix_taxa_qrcode_url!)} style={{ cursor: 'pointer' }} title="Clique para abrir">
                                            {form.pix_taxa_qrcode_url.toLowerCase().endsWith('.pdf') ? (
                                                <div className="qrcode-placeholder" style={{ background: '#f8fafc', width: '100%', height: '100%' }}>
                                                    <FileText size={32} color="#ef4444" />
                                                    <span style={{ fontSize: '0.6rem' }}>PDF</span>
                                                </div>
                                            ) : (
                                                <img
                                                    src={form.pix_taxa_qrcode_url.startsWith('http') ? form.pix_taxa_qrcode_url : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/financeiro/${form.pix_taxa_qrcode_url}`}
                                                    alt="QR Code Taxas"
                                                />
                                            )}
                                        </div>
                                    ) : (
                                        <div className="qrcode-placeholder">
                                            <QrCode size={32} />
                                            <span>Sem QR Code</span>
                                        </div>
                                    )}
                                </div>
                                <div className="qrcode-actions">
                                    <p className="qrcode-hint">QR Code para facilitar o pagamento das taxas via celular.</p>
                                    {form.pix_taxa_qrcode_url ? (
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <button
                                                type="button"
                                                className="qr-upload-label"
                                                style={{ color: '#ef4444', borderColor: '#ef4444' }}
                                                onClick={() => handleChange('pix_taxa_qrcode_url', null)}
                                            >
                                                <X size={16} />
                                                <span>Remover</span>
                                            </button>
                                            <button
                                                type="button"
                                                className="qr-upload-label"
                                                onClick={() => handleDownloadQr(form.pix_taxa_qrcode_url!)}
                                            >
                                                <Download size={16} />
                                                <span>Download</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="qr-upload-label">
                                            <Plus size={16} />
                                            <span>Selecionar QR Code</span>
                                            <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={async (e) => {
                                                const file = e.target.files?.[0]; if (!file) return;
                                                setIsSubmitting(true);
                                                try {
                                                    const { supabase } = await import('../../lib/supabase');
                                                    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
                                                    const filePath = `taxas_${Date.now()}_${sanitizedName}`;
                                                    const { error } = await supabase.storage.from('financeiro').upload(filePath, file);
                                                    if (error) throw error;
                                                    handleChange('pix_taxa_qrcode_url', filePath);
                                                    toast.success('QR Code de Taxas enviado!');
                                                } catch (err: any) { toast.error('Erro ao enviar imagem'); } finally {
                                                    setIsSubmitting(false);
                                                    e.target.value = ''; // Limpa o input
                                                }
                                            }} />
                                        </label>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Painel Camisetas */}
                    <div className="payment-config-card">
                        <div className="payment-card-header">
                            <div className="payment-icon camiseta">
                                <Shirt size={18} />
                            </div>
                            <h3 className="payment-card-title">Camisetas</h3>
                        </div>

                        <div className="payment-card-body">
                            <div className="form-row-compact">
                                <div className="form-group floating-label-group" style={{ flex: '1 1 120px' }}>
                                    <div className="form-input-wrapper">
                                        <select
                                            id="pix_camisetas_tipo"
                                            className="form-input floating-input"
                                            value={form.pix_camisetas_tipo ?? ''}
                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChange('pix_camisetas_tipo', e.target.value || null)}
                                        >
                                            <option value="">Selecione...</option>
                                            <option value="cpf">CPF</option>
                                            <option value="cnpj">CNPJ</option>
                                            <option value="email">E-mail</option>
                                            <option value="telefone">Telefone</option>
                                            <option value="aleatoria">Chave Aleatória</option>
                                        </select>
                                        <label className="form-label floating-label" htmlFor="pix_camisetas_tipo">Tipo</label>
                                    </div>
                                </div>
                                <div className="form-group floating-label-group" style={{ flex: '2 1 200px' }}>
                                    <FormField
                                        label="Chave PIX (Camisetas)"
                                        name="pix_camisetas_chave"
                                        value={form.pix_camisetas_chave ?? ''}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('pix_camisetas_chave', e.target.value)}
                                        placeholder="Insira a chave"
                                    />
                                </div>
                            </div>

                            <div className="qrcode-upload-container">
                                <div className="qrcode-preview">
                                    {form.pix_camisetas_qrcode_url ? (
                                        <div className="qrcode-image-wrapper" onClick={() => openFile(form.pix_camisetas_qrcode_url!)} style={{ cursor: 'pointer' }} title="Clique para abrir">
                                            {form.pix_camisetas_qrcode_url.toLowerCase().endsWith('.pdf') ? (
                                                <div className="qrcode-placeholder" style={{ background: '#f8fafc', width: '100%', height: '100%' }}>
                                                    <FileText size={32} color="#ef4444" />
                                                    <span style={{ fontSize: '0.6rem' }}>PDF</span>
                                                </div>
                                            ) : (
                                                <img
                                                    src={form.pix_camisetas_qrcode_url.startsWith('http') ? form.pix_camisetas_qrcode_url : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/financeiro/${form.pix_camisetas_qrcode_url}`}
                                                    alt="QR Code Camisetas"
                                                />
                                            )}
                                        </div>
                                    ) : (
                                        <div className="qrcode-placeholder">
                                            <QrCode size={32} />
                                            <span>Sem QR Code</span>
                                        </div>
                                    )}
                                </div>
                                <div className="qrcode-actions">
                                    <p className="qrcode-hint">QR Code para o pagamento do pedido das camisetas.</p>
                                    {form.pix_camisetas_qrcode_url ? (
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <button
                                                type="button"
                                                className="qr-upload-label"
                                                style={{ color: '#ef4444', borderColor: '#ef4444' }}
                                                onClick={() => handleChange('pix_camisetas_qrcode_url', null)}
                                            >
                                                <X size={16} />
                                                <span>Remover</span>
                                            </button>
                                            <button
                                                type="button"
                                                className="qr-upload-label"
                                                onClick={() => handleDownloadQr(form.pix_camisetas_qrcode_url!)}
                                            >
                                                <Download size={16} />
                                                <span>Download</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="qr-upload-label">
                                            <Plus size={16} />
                                            <span>Selecionar QR Code</span>
                                            <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={async (e) => {
                                                const file = e.target.files?.[0]; if (!file) return;
                                                setIsSubmitting(true);
                                                try {
                                                    const { supabase } = await import('../../lib/supabase');
                                                    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
                                                    const filePath = `camisetas_${Date.now()}_${sanitizedName}`;
                                                    const { error } = await supabase.storage.from('financeiro').upload(filePath, file);
                                                    if (error) throw error;
                                                    handleChange('pix_camisetas_qrcode_url', filePath);
                                                    toast.success('QR Code de Camisetas enviado!');
                                                } catch (err: any) { toast.error('Erro ao enviar imagem'); } finally {
                                                    setIsSubmitting(false);
                                                    e.target.value = ''; // Limpa o input
                                                }
                                            }} />
                                        </label>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </FormSection>



            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="btn-cancel" onClick={onCancel} disabled={isLoading}>
                    <X size={16} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
                    Cancelar
                </button>
                <button type="submit" disabled={isLoading || isSubmitting}>
                    {isLoading || isSubmitting ? (
                        <><Loader size={16} className="animate-spin" style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />Salvando...</>
                    ) : (
                        <><Check size={16} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />Salvar</>
                    )}
                </button>
            </div>
            <style>{`
                .payment-config-card { background: var(--surface-1); border: 1px solid var(--border-color); border-radius: 16px; padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; transition: all 0.2s ease; }
                .payment-config-card:hover { border-color: var(--primary-color); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                .payment-card-header { display: flex; align-items: center; gap: 0.75rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem; margin-bottom: 0.25rem; }
                .payment-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
                .payment-icon.taxa { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
                .payment-icon.camiseta { background: rgba(168, 85, 247, 0.1); color: #a855f7; }
                .payment-card-title { margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--text-color); }
                .payment-card-body { display: flex; flex-direction: column; gap: 1rem; }
                .form-row-compact { display: flex; flex-wrap: wrap; gap: 0.75rem; }
                .qrcode-upload-container { display: flex; align-items: center; gap: 1.25rem; padding: 1rem; background: rgba(0,0,0,0.03); border-radius: 12px; border: 1px dashed var(--border-color); }
                .qrcode-preview { width: 80px; height: 80px; border-radius: 8px; overflow: hidden; background: white; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid var(--border-color); }
                .qrcode-image-wrapper { width: 100%; height: 100%; position: relative; }
                .qrcode-image-wrapper img { width: 100%; height: 100%; object-fit: contain; }
                .remove-qr-btn { position: absolute; top: -5px; right: -5px; width: 20px; height: 20px; border-radius: 50%; background: #ef4444; color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.2); z-index: 10; }
                .qrcode-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--muted-text); gap: 4px; }
                .qrcode-placeholder span { font-size: 0.6rem; font-weight: 700; text-transform: uppercase; }
                .qrcode-actions { flex: 1; display: flex; flex-direction: column; gap: 0.5rem; }
                .qrcode-hint { font-size: 0.7rem; opacity: 0.6; margin: 0; line-height: 1.3; }
                .qr-upload-label { align-self: flex-start; display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.75rem; background: var(--surface-2); border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
                .qr-upload-label:hover { background: var(--primary-color); color: white; border-color: var(--primary-color); }

                .encontro-detail-item { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; width: 100%; }
                .icon-dim { opacity: 0.5; flex-shrink: 0; }
                .musica-actions { display: flex; gap: 6px; flex-shrink: 0; align-items: center; }
                .mini-link-btn { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 6px; background: var(--secondary-bg); border: 1px solid var(--border-color); color: var(--text-color); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; }
                .mini-link-btn:hover { background: var(--primary-color) !important; color: white !important; border-color: var(--primary-color); transform: translateY(-1px); }
                .mini-link-btn.copied { background: #10b981 !important; color: white !important; border-color: #10b981; }
                .mini-link-btn svg { display: block; flex-shrink: 0; }
                .icon-check-anim { animation: check-pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }

                @keyframes check-pop {
                    0% { transform: scale(0.5) rotate(-20deg); opacity: 0; }
                    100% { transform: scale(1) rotate(0); opacity: 1; }
                }
            `}</style>
        </form>
    );
}
