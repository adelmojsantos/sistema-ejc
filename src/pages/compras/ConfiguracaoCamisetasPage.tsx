import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Edit2, Trash2, Save, Loader } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { camisetaService } from '../../services/camisetaService';
import { encontroService } from '../../services/encontroService';
import type { CamisetaModelo, CamisetaTamanho } from '../../types/camiseta';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { CurrencyFormField } from '../../components/ui/CurrencyFormField';
import { useEncontros } from '../../contexts/EncontroContext';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';

export function ConfiguracaoCamisetasPage() {
  const navigate = useNavigate();
  const [modelos, setModelos] = useState<CamisetaModelo[]>([]);
  const [tamanhos, setTamanhos] = useState<CamisetaTamanho[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { encontros } = useEncontros();
  const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');

  // Estados para Modelos
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingModelo, setEditingModelo] = useState<CamisetaModelo | null>(null);
  const [nomeModelo, setNomeModelo] = useState('');
  const [valorModelo, setValorModelo] = useState<number>(0);
  const [ativoNoEncontro, setAtivoNoEncontro] = useState(true);
  const [modeloToDelete, setModeloToDelete] = useState<CamisetaModelo | null>(null);

  // Estados para Tamanhos
  const [isSizeModalOpen, setIsSizeModalOpen] = useState(false);
  const [editingTamanho, setEditingTamanho] = useState<CamisetaTamanho | null>(null);
  const [siglaTamanho, setSiglaTamanho] = useState('');
  const [ordemTamanho, setOrdemTamanho] = useState(0);
  const [modeloIdTamanho, setModeloIdTamanho] = useState<string | null>(null);
  const [tamanhoToDelete, setTamanhoToDelete] = useState<CamisetaTamanho | null>(null);

  // Filtro de Tamanhos por Modelo
  const [filterModeloId, setFilterModeloId] = useState<string>('all');

  useEffect(() => {
    if (encontros.length > 0 && !selectedEncontroId) {
      const active = encontros.find(e => e.ativo);
      setSelectedEncontroId(active?.id ?? encontros[0].id);
    }
  }, [encontros, selectedEncontroId]);

  useEffect(() => {
    loadData();
  }, [selectedEncontroId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [modelosData, tamanhosData] = await Promise.all([
        camisetaService.listarModelos(selectedEncontroId || undefined),
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
        if (selectedEncontroId) {
          // Se houver encontro selecionado, salva na tabela de configuração de preços
          await camisetaService.salvarConfiguracaoEncontro(selectedEncontroId, editingModelo.id, valorModelo, ativoNoEncontro);
          toast.success('Configuração do encontro salva!');
        } else {
          // Se não, atualiza o modelo global
          await camisetaService.atualizarModelo(editingModelo.id, nomeModelo, valorModelo);
          toast.success('Modelo global atualizado!');
        }
      } else {
        await camisetaService.criarModelo(nomeModelo, valorModelo);
        toast.success('Modelo global criado!');
      }
      setIsModalOpen(false);
      setEditingModelo(null);
      setNomeModelo('');
      setValorModelo(0);
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
        await camisetaService.atualizarTamanho(editingTamanho.id, siglaTamanho, modeloIdTamanho, ordemTamanho);
        toast.success('Tamanho atualizado!');
      } else {
        await camisetaService.criarTamanho(siglaTamanho, modeloIdTamanho, ordemTamanho);
        toast.success('Tamanho criado!');
      }
      setIsSizeModalOpen(false);
      setEditingTamanho(null);
      setSiglaTamanho('');
      setOrdemTamanho(0);
      setModeloIdTamanho(null);
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

  const filteredTamanhos = tamanhos.filter(t =>
    filterModeloId === 'all' || t.modelo_id === filterModeloId
  );

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => navigate('/compras')} className="icon-btn">
            <ChevronLeft size={18} />
          </button>
          <div>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55 }}>Módulo de Compras</p>
            <h1 className="page-title" style={{ fontSize: '1.5rem' }}>Configuração de Camisetas</h1>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, opacity: 0.6, whiteSpace: 'nowrap' }}>Preços para:</span>
          <div className="form-group" style={{ marginBottom: 0, minWidth: '250px' }}>
            <LiveSearchSelect
              value={selectedEncontroId}
              onChange={val => setSelectedEncontroId(val)}
              fetchData={async (s, p) => await encontroService.buscarComPaginacao(s, p)}
              getOptionLabel={e => e.nome}
              getOptionValue={e => e.id}
              initialOptions={encontros}
              placeholder="Geral (Modelos Globais)"
            />
          </div>
          {selectedEncontroId && (
            <button className="btn-text" onClick={() => setSelectedEncontroId('')} style={{ fontSize: '0.8rem' }}>
              Limpar
            </button>
          )}
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
                  <th style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', width: '100px' }}>Valor</th>
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
                    <tr
                      key={m.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        background: filterModeloId === m.id ? 'var(--surface-2)' : 'transparent',
                        cursor: 'pointer'
                      }}
                      onClick={() => setFilterModeloId(m.id === filterModeloId ? 'all' : m.id)}
                    >
                      <td style={{ padding: '1rem', fontWeight: 600 }}>{m.nome}</td>
                      <td style={{ padding: '1rem', fontWeight: 500 }}>
                        {m.valor ? m.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00'}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button className="icon-btn" onClick={(e) => { 
                            e.stopPropagation(); 
                            setEditingModelo(m); 
                            setNomeModelo(m.nome); 
                            setValorModelo(m.valor || 0); 
                            setAtivoNoEncontro((m as any).esta_ativo_no_encontro ?? true);
                            setIsModalOpen(true); 
                          }}><Edit2 size={16} /></button>
                          <button className="icon-btn text-danger" onClick={(e) => { e.stopPropagation(); setModeloToDelete(m); }}><Trash2 size={16} /></button>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Tamanhos</h2>
              <select
                className="form-input"
                style={{ padding: '0.5rem', fontSize: '0.8rem', width: 'auto' }}
                value={filterModeloId}
                onChange={(e) => setFilterModeloId(e.target.value)}
              >
                <option value="all">Todos</option>
                {modelos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </div>
            <button className="btn-primary" onClick={() => {
              setEditingTamanho(null);
              setSiglaTamanho('');
              setModeloIdTamanho(filterModeloId !== 'all' ? filterModeloId : null);
              setOrdemTamanho(tamanhos.length + 1);
              setIsSizeModalOpen(true);
            }}>
              <Plus size={16} /> Novo Tamanho
            </button>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', background: 'var(--surface-1)' }}>
                  <th style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', width: '60px' }}>Ordem</th>
                  <th style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>Sigla/Nome</th>
                  <th style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>Modelo</th>
                  <th style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', width: '100px', textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center' }}><Loader className="animate-spin" size={24} style={{ margin: '0 auto' }} /></td></tr>
                ) : filteredTamanhos.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>Nenhum tamanho encontrado.</td></tr>
                ) : (
                  filteredTamanhos.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem', opacity: 0.5 }}>{t.ordem}</td>
                      <td style={{ padding: '1rem', fontWeight: 600 }}>{t.sigla}</td>
                      <td style={{ padding: '1rem', fontSize: '0.8rem' }}>
                        {modelos.find(m => m.id === t.modelo_id)?.nome || <span className="text-muted">Global</span>}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button className="icon-btn" onClick={() => {
                            setEditingTamanho(t);
                            setSiglaTamanho(t.sigla);
                            setOrdemTamanho(t.ordem);
                            setModeloIdTamanho(t.modelo_id);
                            setIsSizeModalOpen(true);
                          }}><Edit2 size={16} /></button>
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

      {/* Modal de Cadastro/Edição de Modelo */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-header"><h3>{editingModelo ? 'Editar Modelo' : 'Novo Modelo'}</h3></div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nome do Modelo</label>
                  <input type="text" className="form-input" value={nomeModelo} onChange={e => setNomeModelo(e.target.value)} placeholder="Ex: Camiseta Oficial" required autoFocus />
                </div>
                <div className="form-group">
                  <CurrencyFormField
                    label="Valor (R$)"
                    name="valor"
                    value={valorModelo}
                    onChange={setValorModelo}
                    placeholder="0,00"
                    required
                  />
                </div>
                {selectedEncontroId && editingModelo && (
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem' }}>
                    <input 
                      type="checkbox" 
                      id="ativo_no_encontro"
                      checked={ativoNoEncontro} 
                      onChange={e => setAtivoNoEncontro(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <label htmlFor="ativo_no_encontro" style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                      Habilitar este modelo para o encontro selecionado
                    </label>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? <Loader className="animate-spin" size={16} /> : <Save size={16} />} Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Cadastro/Edição de Tamanho */}
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
                  <label className="form-label">Vincular ao Modelo</label>
                  <select className="form-input" value={modeloIdTamanho || ''} onChange={e => setModeloIdTamanho(e.target.value || null)}>
                    <option value="">Global (Disponível para todos)</option>
                    {modelos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  </select>
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
        message={`Tem certeza que deseja excluir o modelo "${modeloToDelete?.nome}"?`}
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
