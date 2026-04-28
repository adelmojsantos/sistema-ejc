import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Edit2, Trash2, Save, Loader } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { camisetaService } from '../../services/camisetaService';
import type { CamisetaModelo, CamisetaTamanho } from '../../types/camiseta';
import { ConfirmDialog } from '../../components/ConfirmDialog';

export function ConfiguracaoCamisetasPage() {
  const navigate = useNavigate();
  const [modelos, setModelos] = useState<CamisetaModelo[]>([]);
  const [tamanhos, setTamanhos] = useState<CamisetaTamanho[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingModelo, setEditingModelo] = useState<CamisetaModelo | null>(null);
  const [nomeModelo, setNomeModelo] = useState('');

  const [isSizeModalOpen, setIsSizeModalOpen] = useState(false);
  const [editingTamanho, setEditingTamanho] = useState<CamisetaTamanho | null>(null);
  const [siglaTamanho, setSiglaTamanho] = useState('');
  const [ordemTamanho, setOrdemTamanho] = useState(0);

  const [modeloToDelete, setModeloToDelete] = useState<CamisetaModelo | null>(null);
  const [tamanhoToDelete, setTamanhoToDelete] = useState<CamisetaTamanho | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [modelosData, tamanhosData] = await Promise.all([
        camisetaService.listarModelos(),
        camisetaService.listarTamanhos()
      ]);
      setModelos(modelosData);
      setTamanhos(tamanhosData);
    } catch {
      toast.error('Erro ao carregar configurações.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeModelo.trim()) return;

    setSaving(true);
    try {
      if (editingModelo) {
        await camisetaService.atualizarModelo(editingModelo.id, nomeModelo);
        toast.success('Modelo atualizado!');
      } else {
        await camisetaService.criarModelo(nomeModelo);
        toast.success('Modelo criado!');
      }
      setIsModalOpen(false);
      setEditingModelo(null);
      setNomeModelo('');
      loadData();
    } catch {
      toast.error('Erro ao salvar modelo.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siglaTamanho.trim()) return;

    setSaving(true);
    try {
      if (editingTamanho) {
        await camisetaService.atualizarTamanho(editingTamanho.id, siglaTamanho, ordemTamanho);
        toast.success('Tamanho atualizado!');
      } else {
        await camisetaService.criarTamanho(siglaTamanho, ordemTamanho);
        toast.success('Tamanho criado!');
      }
      setIsSizeModalOpen(false);
      setEditingTamanho(null);
      setSiglaTamanho('');
      setOrdemTamanho(0);
      loadData();
    } catch {
      toast.error('Erro ao salvar tamanho.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!modeloToDelete) return;
    setSaving(true);
    try {
      await camisetaService.excluirModelo(modeloToDelete.id);
      toast.success('Modelo excluído!');
      setModeloToDelete(null);
      loadData();
    } catch {
      toast.error('Erro ao excluir modelo.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSize = async () => {
    if (!tamanhoToDelete) return;
    setSaving(true);
    try {
      await camisetaService.excluirTamanho(tamanhoToDelete.id);
      toast.success('Tamanho excluído!');
      setTamanhoToDelete(null);
      loadData();
    } catch {
      toast.error('Erro ao excluir tamanho.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => navigate('/compras')} className="icon-btn">
            <ChevronLeft size={18} />
          </button>
          <div>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55 }}>Módulo de Compras</p>
            <h1 className="page-title" style={{ fontSize: '1.5rem' }}>Configuração de Camisetas</h1>
          </div>
        </div>

      <div className="grid-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
        {/* Seção de Modelos */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Modelos de Camisetas</h2>
            <button className="btn-primary" onClick={() => { setEditingModelo(null); setNomeModelo(''); setIsModalOpen(true); }}>
              <Plus size={16} /> Novo Modelo
            </button>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', background: 'var(--surface-1)' }}>
                  <th style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>Nome</th>
                  <th style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', width: '100px', textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={2} style={{ padding: '2rem', textAlign: 'center' }}><Loader className="animate-spin" size={24} style={{ margin: '0 auto' }} /></td></tr>
                ) : modelos.length === 0 ? (
                  <tr><td colSpan={2} style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>Nenhum modelo.</td></tr>
                ) : (
                  modelos.map(m => (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem', fontWeight: 600 }}>{m.nome}</td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button className="icon-btn" onClick={() => { setEditingModelo(m); setNomeModelo(m.nome); setIsModalOpen(true); }}><Edit2 size={16} /></button>
                          <button className="icon-btn text-danger" onClick={() => setModeloToDelete(m)}><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Seção de Tamanhos */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Tamanhos Disponíveis</h2>
            <button className="btn-primary" onClick={() => { setEditingTamanho(null); setSiglaTamanho(''); setOrdemTamanho(tamanhos.length + 1); setIsSizeModalOpen(true); }}>
              <Plus size={16} /> Novo Tamanho
            </button>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', background: 'var(--surface-1)' }}>
                  <th style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', width: '60px' }}>Ordem</th>
                  <th style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>Sigla/Nome</th>
                  <th style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', width: '100px', textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={3} style={{ padding: '2rem', textAlign: 'center' }}><Loader className="animate-spin" size={24} style={{ margin: '0 auto' }} /></td></tr>
                ) : tamanhos.length === 0 ? (
                  <tr><td colSpan={3} style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>Nenhum tamanho.</td></tr>
                ) : (
                  tamanhos.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem', opacity: 0.5 }}>{t.ordem}</td>
                      <td style={{ padding: '1rem', fontWeight: 600 }}>{t.sigla}</td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button className="icon-btn" onClick={() => { setEditingTamanho(t); setSiglaTamanho(t.sigla); setOrdemTamanho(t.ordem); setIsSizeModalOpen(true); }}><Edit2 size={16} /></button>
                          <button className="icon-btn text-danger" onClick={() => setTamanhoToDelete(t)}><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Modal de Cadastro/Edição */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>{editingModelo ? 'Editar Modelo' : 'Novo Modelo'}</h3>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nome do Modelo</label>
                  <input
                    type="text"
                    className="form-input"
                    value={nomeModelo}
                    onChange={e => setNomeModelo(e.target.value)}
                    placeholder="Ex: Camiseta Oficial 2024"
                    required
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? <Loader className="animate-spin" size={16} /> : <Save size={16} style={{ marginRight: '0.4rem' }} />}
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Tamanho */}
      {isSizeModalOpen && (
        <div className="modal-overlay" onClick={() => setIsSizeModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header"><h3>{editingTamanho ? 'Editar Tamanho' : 'Novo Tamanho'}</h3></div>
            <form onSubmit={handleSaveSize}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Sigla/Nome</label>
                  <input type="text" className="form-input" value={siglaTamanho} onChange={e => setSiglaTamanho(e.target.value)} placeholder="Ex: P, M, GG..." required autoFocus />
                </div>
                <div className="form-group">
                  <label className="form-label">Ordem de Exibição</label>
                  <input type="number" className="form-input" value={ordemTamanho} onChange={e => setOrdemTamanho(parseInt(e.target.value))} required />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsSizeModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? <Loader className="animate-spin" size={16} /> : <Save size={16} />} Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!modeloToDelete}
        title="Excluir Modelo"
        message={`Tem certeza que deseja excluir o modelo "${modeloToDelete?.nome}"? Isso não afetará os pedidos já realizados.`}
        onConfirm={handleDelete}
        onCancel={() => setModeloToDelete(null)}
        isLoading={saving}
        isDestructive={true}
      />

      <ConfirmDialog
        isOpen={!!tamanhoToDelete}
        title="Excluir Tamanho"
        message={`Tem certeza que deseja excluir o tamanho "${tamanhoToDelete?.sigla}"?`}
        onConfirm={handleDeleteSize}
        onCancel={() => setTamanhoToDelete(null)}
        isLoading={saving}
        isDestructive={true}
      />
    </div>
  );
}
