import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, ChevronLeft, Plus, Edit2, Trash2, Save, Loader } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { camisetaService } from '../../services/camisetaService';
import type { CamisetaModelo } from '../../types/camiseta';
import { ConfirmDialog } from '../../components/ConfirmDialog';

export function ConfiguracaoCamisetasPage() {
  const navigate = useNavigate();
  const [modelos, setModelos] = useState<CamisetaModelo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingModelo, setEditingModelo] = useState<CamisetaModelo | null>(null);
  const [nomeModelo, setNomeModelo] = useState('');
  
  const [modeloToDelete, setModeloToDelete] = useState<CamisetaModelo | null>(null);

  useEffect(() => {
    loadModelos();
  }, []);

  const loadModelos = async () => {
    setLoading(true);
    try {
      const data = await camisetaService.listarModelos();
      setModelos(data);
    } catch {
      toast.error('Erro ao carregar modelos.');
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
      loadModelos();
    } catch {
      toast.error('Erro ao salvar modelo.');
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
      loadModelos();
    } catch {
      toast.error('Erro ao excluir modelo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => navigate('/gestao-compras')} className="icon-btn">
            <ChevronLeft size={18} />
          </button>
          <div>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55 }}>Módulo de Compras</p>
            <h1 className="page-title" style={{ fontSize: '1.5rem' }}>Configuração de Camisetas</h1>
          </div>
        </div>

        <button className="btn-primary" onClick={() => { setEditingModelo(null); setNomeModelo(''); setIsModalOpen(true); }}>
          <Plus size={16} style={{ marginRight: '0.4rem' }} /> Novo Modelo
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', background: 'var(--surface-1)' }}>
              <th style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>Nome do Modelo</th>
              <th style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', width: '100px', textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={2} style={{ padding: '3rem', textAlign: 'center' }}>
                  <Loader className="animate-spin" size={24} style={{ margin: '0 auto' }} />
                </td>
              </tr>
            ) : modelos.length === 0 ? (
              <tr>
                <td colSpan={2} style={{ padding: '3rem', textAlign: 'center', opacity: 0.5 }}>
                  Nenhum modelo cadastrado.
                </td>
              </tr>
            ) : (
              modelos.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ fontWeight: 600 }}>{m.nome}</span>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button className="icon-btn" onClick={() => { setEditingModelo(m); setNomeModelo(m.nome); setIsModalOpen(true); }} title="Editar">
                        <Edit2 size={16} />
                      </button>
                      <button className="icon-btn text-danger" onClick={() => setModeloToDelete(m)} title="Excluir">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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

      <ConfirmDialog
        isOpen={!!modeloToDelete}
        title="Excluir Modelo"
        message={`Tem certeza que deseja excluir o modelo "${modeloToDelete?.nome}"? Isso não afetará os pedidos já realizados.`}
        onConfirm={handleDelete}
        onCancel={() => setModeloToDelete(null)}
        isLoading={saving}
        isDestructive={true}
      />
    </div>
  );
}
