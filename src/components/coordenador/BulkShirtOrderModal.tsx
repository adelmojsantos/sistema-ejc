import { Loader, Plus, Shirt, Trash2, User, X } from 'lucide-react';
import { Minus, Plus as PlusIcon } from 'phosphor-react';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { camisetaService } from '../../services/camisetaService';
import type { CamisetaModelo, CamisetaTamanho } from '../../types/camiseta';
import type { Pessoa } from '../../types/pessoa';
import { formatBRL } from '../../utils/currencyUtils';

interface Member {
  id: string;
  pessoas: Pessoa;
}

interface BulkShirtOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  modelos: CamisetaModelo[];
  tamanhos: CamisetaTamanho[];
  onSuccess: () => Promise<void>;
}

interface OrderRow {
  id: string;
  participacao_id: string;
  modelo_id: string;
  tamanho: string;
  quantidade: number;
}

export function BulkShirtOrderModal({ isOpen, onClose, members, modelos, tamanhos, onSuccess }: BulkShirtOrderModalProps) {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 768;

  // State for the entry form
  const [currentOrder, setCurrentOrder] = useState({
    participacao_id: '',
    modelo_id: '',
    tamanho: 'G',
    quantidade: 1
  });

  useEffect(() => {
    if (isOpen) {
      setRows([]); // Always start empty as requested
      if (modelos.length > 0) {
        const defaultModelo = modelos[0];
        const availableSizes = tamanhos.filter(t => !t.modelo_id || t.modelo_id === defaultModelo.id);
        setCurrentOrder({
          participacao_id: '',
          modelo_id: defaultModelo.id,
          tamanho: availableSizes.length > 0 ? availableSizes[0].sigla : 'G',
          quantidade: 1
        });
      }
    }
  }, [isOpen, modelos, tamanhos]);

  const handleAddToList = () => {
    if (!currentOrder.participacao_id) {
      toast.error('Selecione uma pessoa.');
      return;
    }

    const newRow: OrderRow = {
      id: Math.random().toString(36).substr(2, 9),
      ...currentOrder
    };

    setRows([newRow, ...rows]); // Add to top of list

    // Reset only the person, keep model/size for batching similar orders
    setCurrentOrder(prev => ({
      ...prev,
      participacao_id: '',
      quantidade: 1
    }));

    toast.success('Adicionado à lista!');
  };

  const removeRow = (id: string) => {
    setRows(rows.filter(r => r.id !== id));
  };

  const handleSave = async () => {
    if (rows.length === 0) {
      toast.error('Adicione pelo menos um pedido à lista.');
      return;
    }

    setIsSaving(true);
    try {
      await Promise.all(rows.map(r =>
        camisetaService.criarPedido({
          participacao_id: r.participacao_id,
          modelo_id: r.modelo_id,
          tamanho: r.tamanho,
          quantidade: r.quantidade
        })
      ));

      toast.success('Todos os pedidos foram realizados com sucesso!');
      await onSuccess();
      onClose();
    } catch (error) {
      console.error('Erro ao realizar pedidos em massa:', error);
      toast.error('Erro ao realizar alguns pedidos.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-content" style={{ maxWidth: '900px', width: '95%', maxHeight: '95vh' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              backgroundColor: 'rgba(var(--primary-rgb), 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)'
            }}>
              <Shirt size={22} />
            </div>
            <div>
              <h2 className="modal-title">Pedir Camisetas em Massa</h2>
              <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6 }}>Monte sua lista e salve tudo de uma vez</p>
            </div>
          </div>
          <button onClick={onClose} className="icon-btn">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: isMobile ? '1rem' : '1.5rem', overflowY: 'auto' }}>

          {/* SEÇÃO DO FORMULÁRIO DE ENTRADA */}
          <div className="card" style={{
            padding: isMobile ? '1rem' : '1.25rem',
            backgroundColor: 'rgba(var(--primary-rgb), 0.03)',
            border: '2px solid var(--primary-color)',
            borderRadius: '16px',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '1rem', color: 'var(--primary-color)' }}>
              Novo Item
            </h3>

            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: '1rem',
              alignItems: isMobile ? 'stretch' : 'flex-end'
            }}>
              {/* Pessoa */}
              <div style={{ flex: isMobile ? 'none' : '2', width: isMobile ? '100%' : 'auto' }}>
                <label style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.5, marginBottom: '0.3rem', display: 'block' }}>Pessoa</label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={currentOrder.participacao_id}
                    onChange={e => setCurrentOrder({ ...currentOrder, participacao_id: e.target.value })}
                    className="form-input"
                    style={{ paddingLeft: '2.5rem', height: '48px', fontSize: '0.9rem' }}
                  >
                    <option value="" disabled>Selecione uma pessoa...</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.pessoas.nome_completo}</option>
                    ))}
                  </select>
                  <User size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                </div>
              </div>

              {/* Modelo */}
              <div style={{ flex: isMobile ? 'none' : '1.2', width: isMobile ? '100%' : 'auto' }}>
                <label style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.5, marginBottom: '0.3rem', display: 'block' }}>Modelo</label>
                <select
                  value={currentOrder.modelo_id}
                  onChange={e => {
                    const newModelId = e.target.value;
                    const availableSizes = tamanhos.filter(t => !t.modelo_id || t.modelo_id === newModelId);
                    setCurrentOrder({
                      ...currentOrder,
                      modelo_id: newModelId,
                      tamanho: availableSizes.length > 0 ? availableSizes[0].sigla : 'G'
                    });
                  }}
                  className="form-input"
                  style={{ height: '48px', fontSize: '0.9rem' }}
                >
                  {modelos.map(mod => (
                    <option key={mod.id} value={mod.id}>{mod.nome}</option>
                  ))}
                </select>
              </div>

              {/* Tamanho e Quantidade na mesma linha no mobile */}
              <div style={{
                display: 'flex',
                gap: '1rem',
                width: isMobile ? '100%' : 'auto',
                flex: isMobile ? 'none' : 'row'
              }}>
                {/* Tamanho */}
                <div style={{ width: '120px' }}>
                  <label style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.5, marginBottom: '0.3rem', display: 'block', textAlign: 'left' }}>Tam</label>
                  <select
                    value={currentOrder.tamanho}
                    onChange={e => setCurrentOrder({ ...currentOrder, tamanho: e.target.value })}
                    className="form-input"
                    style={{ height: '48px', fontSize: '0.9rem', textAlign: 'left' }}
                  >
                    {tamanhos
                      .filter(t => !t.modelo_id || t.modelo_id === currentOrder.modelo_id)
                      .map(t => (
                        <option key={t.id} value={t.sigla}>{t.sigla}</option>
                      ))}
                  </select>
                </div>

                {/* Quantidade */}
                <div style={{ flex: 1, minWidth: '80px' }}>
                  <label style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.5, marginBottom: '0.3rem', display: 'block', textAlign: 'center' }}>Qtd</label>
                  <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--surface-1)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', height: '48px', padding: '2px' }}>
                    <button
                      type="button"
                      onClick={() => setCurrentOrder({ ...currentOrder, quantidade: Math.max(1, currentOrder.quantidade - 1) })}
                      disabled={currentOrder.quantidade === 1}
                      style={{
                        minWidth: '40px', height: '100%', border: 'none', background: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: currentOrder.quantidade === 1 ? 'not-allowed' : 'pointer',
                        color: 'var(--primary-color)',
                        transition: 'all 0.2s',
                        flexShrink: 1,
                        padding: 0,
                        outline: 'none',
                        opacity: currentOrder.quantidade === 1 ? 0.3 : 1
                      }}
                      onMouseEnter={e => currentOrder.quantidade > 1 && (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <Minus size={16} strokeWidth={1.5} color='var(--text-color)' />
                    </button>
                    <input
                      type="number"
                      value={currentOrder.quantidade}
                      onChange={e => setCurrentOrder({ ...currentOrder, quantidade: parseInt(e.target.value) || 1 })}
                      className="form-input no-spinner"
                      style={{
                        flex: 1, padding: '0', border: 'none', background: 'transparent',
                        fontSize: '0.9rem', textAlign: 'center', fontWeight: 500,
                        color: 'var(--text-color)',
                        appearance: 'none', margin: 0,
                        boxShadow: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setCurrentOrder({ ...currentOrder, quantidade: currentOrder.quantidade + 1 })}
                      style={{
                        minWidth: '40px', height: '100%', border: 'none', background: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: 'var(--primary-color)',
                        transition: 'all 0.2s',
                        flexShrink: 1,
                        padding: 0,
                        outline: 'none',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <PlusIcon size={16} strokeWidth={1.5} color='var(--text-color)' />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleAddToList}
              className="btn-secondary"
              style={{
                marginTop: '1.25rem',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                borderStyle: 'dashed',
                borderWidth: '2px',
                height: '48px',
                borderRadius: '12px',
                fontWeight: 600
              }}
            >
              <Plus size={20} />
              <span>Adicionar à Lista</span>
            </button>
          </div>

          {/* LISTA DE ITENS ADICIONADOS */}
          {rows.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.5 }}>Itens na Lista ({rows.length})</h3>
                <button onClick={() => setRows([])} className="btn-text" style={{ color: 'var(--danger-color)', fontSize: '0.75rem' }}>Limpar Lista</button>
              </div>
              {rows.map((row) => {
                const member = members.find(m => m.id === row.participacao_id);
                const modelo = modelos.find(m => m.id === row.modelo_id);
                return (
                  <div key={row.id} className="card" style={{
                    padding: '0.75rem 1.25rem',
                    backgroundColor: 'rgba(0,0,0,0.02)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: isMobile ? '0.75rem' : '1.5rem',
                    animation: 'fadeInUp 0.3s ease',
                    borderRadius: '12px',
                    flexDirection: isMobile ? 'column' : 'row',
                    textAlign: isMobile ? 'center' : 'left'
                  }}>
                    <div style={{ flex: 1, width: isMobile ? '100%' : 'auto' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{member?.pessoas.nome_completo}</div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{modelo?.nome} • Tam: {row.tamanho} • Qtd: {row.quantidade}</div>
                    </div>
                    <div style={{
                      textAlign: isMobile ? 'center' : 'right',
                      width: isMobile ? '100%' : 'auto',
                      borderTop: isMobile ? '1px solid var(--border-color)' : 'none',
                      paddingTop: isMobile ? '0.5rem' : '0'
                    }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary-color)' }}>
                        {formatBRL((modelo?.valor || 0) * row.quantidade)}
                      </div>
                    </div>
                    <button
                      onClick={() => removeRow(row.id)}
                      className="icon-btn"
                      style={{
                        color: 'var(--danger-color)',
                        backgroundColor: 'rgba(239, 68, 68, 0.05)',
                        width: '36px', height: '36px',
                        position: isMobile ? 'absolute' : 'relative',
                        top: isMobile ? '0.5rem' : 'auto',
                        right: isMobile ? '0.5rem' : 'auto'
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{
              padding: '3rem', textAlign: 'center', opacity: 0.3, border: '2px dashed var(--border-color)', borderRadius: '16px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem'
            }}>
              <Shirt size={48} strokeWidth={1} />
              <p style={{ margin: 0, fontWeight: 500 }}>Sua lista está vazia. Adicione itens acima.</p>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{
          padding: '1.25rem 1.5rem',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'stretch' : 'center',
          backgroundColor: 'var(--surface-2)',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', justifyContent: isMobile ? 'space-between' : 'flex-start', alignItems: isMobile ? 'center' : 'flex-start' }}>
            <div style={{ fontSize: '0.75rem', opacity: 0.5, textTransform: 'uppercase', fontWeight: 800 }}>Total da Lista</div>
            <div style={{ fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: 900, color: 'var(--primary-color)' }}>
              {formatBRL(rows.reduce((acc, r) => acc + ((modelos.find(mod => mod.id === r.modelo_id)?.valor || 0) * r.quantidade), 0))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={onClose} className="btn-text" style={{ flex: isMobile ? 1 : 'none' }}>Fechar</button>
            <button
              onClick={handleSave}
              disabled={isSaving || rows.length === 0}
              className="btn-primary"
              style={{
                padding: '0.75rem 2.5rem',
                minWidth: '160px',
                borderRadius: '12px',
                fontSize: '1rem',
                flex: isMobile ? 2 : 'none'
              }}
            >
              {isSaving ? <Loader className="animate-spin" size={20} /> : 'Salvar Pedidos'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
