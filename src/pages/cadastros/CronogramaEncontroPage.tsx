import {
  CalendarClock,
  Check,
  Loader,
  Palette,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { PageHeader } from '../../components/ui/PageHeader';
import { useEncontros } from '../../contexts/EncontroContext';
import { cronogramaService } from '../../services/cronogramaService';
import { encontroService } from '../../services/encontroService';
import type { EncontroCronogramaItem, EncontroCronogramaItemFormData } from '../../types/cronograma';
import type { Encontro } from '../../types/encontro';
import './CronogramaEncontroPage.css';

const SUGGESTED_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#64748b'];

const emptyItemForm = (encontroId = '', data = ''): EncontroCronogramaItemFormData => ({
  encontro_id: encontroId,
  data,
  hora_inicio: '',
  hora_fim: '',
  descricao: '',
  cor: '#0ea5e9',
});

function parseLocalDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

function enumerateDates(start?: string, end?: string) {
  if (!start || !end) return [];
  const current = parseLocalDate(start);
  const last = parseLocalDate(end);
  const dates: string[] = [];

  while (current <= last) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function formatDate(value: string, options?: Intl.DateTimeFormatOptions) {
  return parseLocalDate(value).toLocaleDateString('pt-BR', options);
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

export function CronogramaEncontroPage() {
  const { encontros, encontroAtivo } = useEncontros();

  const [selectedEncontroId, setSelectedEncontroId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [items, setItems] = useState<EncontroCronogramaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EncontroCronogramaItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [colorPopoverOpen, setColorPopoverOpen] = useState(false);
  const colorPopoverRef = useRef<HTMLDivElement>(null);
  const [editingItem, setEditingItem] = useState<EncontroCronogramaItem | null>(null);
  const [itemForm, setItemForm] = useState<EncontroCronogramaItemFormData>(emptyItemForm());

  useEffect(() => {
    if (!selectedEncontroId && encontroAtivo) {
      setSelectedEncontroId(encontroAtivo.id);
    } else if (!selectedEncontroId && encontros.length > 0) {
      setSelectedEncontroId(encontros[0].id);
    }
  }, [encontroAtivo, encontros, selectedEncontroId]);

  const selectedEncontro = useMemo(
    () => encontros.find((encontro) => encontro.id === selectedEncontroId) || null,
    [encontros, selectedEncontroId],
  );

  const availableDates = useMemo(
    () => enumerateDates(selectedEncontro?.data_inicio, selectedEncontro?.data_fim),
    [selectedEncontro],
  );

  useEffect(() => {
    if (!availableDates.includes(selectedDate)) {
      setSelectedDate(availableDates[0] || '');
    }
  }, [availableDates, selectedDate]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const itemsData = selectedEncontroId
        ? await cronogramaService.listarPorEncontro(selectedEncontroId)
        : [];
      setItems(itemsData);
    } catch (error) {
      console.error('Erro ao carregar cronograma:', error);
      toast.error('Não foi possível carregar o cronograma.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedEncontroId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!colorPopoverOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!colorPopoverRef.current?.contains(event.target as Node)) {
        setColorPopoverOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [colorPopoverOpen]);

  const dayItems = useMemo(
    () => items.filter((item) => item.data === selectedDate),
    [items, selectedDate],
  );

  const colorOptions = useMemo(
    () => Array.from(new Set([...items.map((item) => item.cor), ...SUGGESTED_COLORS])).slice(0, 8),
    [items],
  );

  const openNewItem = () => {
    if (!selectedEncontroId || !selectedDate) {
      toast.error('Selecione um encontro com período cadastrado.');
      return;
    }
    setEditingItem(null);
    setItemForm(emptyItemForm(selectedEncontroId, selectedDate));
    setItemFormOpen(true);
  };

  const openEditItem = (item: EncontroCronogramaItem) => {
    setEditingItem(item);
    setItemForm({
      encontro_id: item.encontro_id,
      data: item.data,
      hora_inicio: formatTime(item.hora_inicio),
      hora_fim: formatTime(item.hora_fim),
      descricao: item.descricao,
      cor: item.cor,
    });
    setItemFormOpen(true);
  };

  const handleSaveItem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!itemForm.data || !itemForm.hora_inicio || !itemForm.hora_fim || !itemForm.descricao.trim()) {
      toast.error('Preencha início, fim e descrição.');
      return;
    }
    if (itemForm.hora_fim <= itemForm.hora_inicio) {
      toast.error('O horário final deve ser posterior ao inicial.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...itemForm,
        descricao: itemForm.descricao.trim(),
      };
      if (editingItem) {
        await cronogramaService.atualizarItem(editingItem.id, payload);
      } else {
        await cronogramaService.criarItem(payload);
      }
      toast.success(editingItem ? 'Atividade atualizada.' : 'Atividade adicionada ao cronograma.');
      setItemFormOpen(false);
      await loadData();
    } catch (error) {
      console.error('Erro ao salvar item do cronograma:', error);
      toast.error('Não foi possível salvar a atividade.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await cronogramaService.excluirItem(deleteTarget.id);
      toast.success('Atividade removida do cronograma.');
      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      console.error('Erro ao excluir registro:', error);
      toast.error('Não foi possível remover a atividade.');
    } finally {
      setIsDeleting(false);
    }
  };

  const closeItemForm = () => {
    setItemFormOpen(false);
    setEditingItem(null);
  };

  const renderItemForm = () => (
    <form onSubmit={handleSaveItem} className="cronograma-inline-form card">
      <div className="cronograma-inline-time">
        <label>
          <span>Início</span>
          <input className="form-input" type="time" value={itemForm.hora_inicio} onChange={(event) => setItemForm({ ...itemForm, hora_inicio: event.target.value })} />
        </label>
        <label>
          <span>Fim</span>
          <input className="form-input" type="time" value={itemForm.hora_fim} onChange={(event) => setItemForm({ ...itemForm, hora_fim: event.target.value })} />
        </label>
      </div>
      <div className="cronograma-inline-content">
        <div className="cronograma-inline-color" ref={colorPopoverRef}>
          <span>Cor</span>
          <button
            type="button"
            className="cronograma-color-trigger"
            style={{ '--cor-selecionada': itemForm.cor } as React.CSSProperties}
            onClick={() => setColorPopoverOpen(true)}
          >
            <span />
          </button>
          {colorPopoverOpen && (
            <div className="cronograma-color-popover" role="dialog" aria-label="Escolher cor">
              <strong>Escolher cor</strong>
              <div className="cronograma-color-options">
                {colorOptions.map((cor) => (
                  <button
                    key={cor}
                    type="button"
                    className={itemForm.cor === cor ? 'is-active' : ''}
                    style={{ backgroundColor: cor }}
                    onClick={() => {
                      setItemForm({ ...itemForm, cor });
                      setColorPopoverOpen(false);
                    }}
                    aria-label={`Selecionar cor ${cor}`}
                    title={cor}
                  />
                ))}
              </div>
              <label className="cronograma-custom-color" title="Escolher outra cor">
                <input
                  type="color"
                  value={itemForm.cor}
                  onChange={(event) => setItemForm({ ...itemForm, cor: event.target.value })}
                />
                <Palette size={16} />
                <span>Escolher</span>
              </label>
            </div>
          )}
        </div>
        <label className="cronograma-inline-description">
          <span>Descrição</span>
          <input className="form-input" value={itemForm.descricao} onChange={(event) => setItemForm({ ...itemForm, descricao: event.target.value })} placeholder="Ex.: Palestra - Família - João e Maria" />
        </label>
      </div>
      <div className="cronograma-inline-actions">
        <button type="submit" className="btn-primary cronograma-confirm-btn" disabled={isSaving}>
          {isSaving ? <Loader className="animate-spin" size={18} /> : <Check size={18} />}
          <span>Salvar</span>
        </button>
        <button type="button" className="btn-secondary cronograma-cancel-btn" onClick={closeItemForm}>
          <X size={18} />
          <span>Cancelar</span>
        </button>
      </div>
    </form>
  );

  return (
    <main className="container fade-in cronograma-page">
      <PageHeader
        title="Cronograma"
        subtitle="Gestão de Cadastros"
        backPath="/cadastros"
        actions={(
          <div className="cronograma-encontro-select">
            <label>Encontro</label>
            <LiveSearchSelect<Encontro>
              value={selectedEncontroId}
              onChange={(value) => setSelectedEncontroId(value)}
              fetchData={(search, page) => encontroService.buscarComPaginacao(search, page)}
              getOptionLabel={(encontro) => encontro.nome}
              getOptionValue={(encontro) => encontro.id}
              initialOptions={encontros}
              placeholder="Selecione o encontro"
            />
          </div>
        )}
      />

      <div className="cronograma-day-toolbar">
        <div className="cronograma-days" role="tablist" aria-label="Dias do encontro">
          {availableDates.map((date) => (
            <button key={date} className={date === selectedDate ? 'is-active' : ''} onClick={() => setSelectedDate(date)} role="tab" aria-selected={date === selectedDate}>
              <strong>{formatDate(date, { weekday: 'long' })}</strong>
              <span>{formatDate(date, { day: '2-digit', month: '2-digit' })}</span>
            </button>
          ))}
        </div>
        <button className="btn-primary cronograma-add-btn" onClick={openNewItem} disabled={!selectedDate}>
          Adicionar atividade
        </button>
      </div>

      <section className="cronograma-list">
        {itemFormOpen && !editingItem && renderItemForm()}
        {isLoading ? (
          <div className="cronograma-empty card"><Loader className="animate-spin" size={28} /> Carregando cronograma...</div>
        ) : dayItems.length === 0 ? (
          <div className="cronograma-empty card">
            <CalendarClock size={34} />
            <strong>Nenhuma atividade neste dia</strong>
            <span>Adicione o primeiro horário para começar a montar a programação.</span>
          </div>
        ) : (
          dayItems.map((item) => {
            if (itemFormOpen && editingItem?.id === item.id) return <div key={item.id}>{renderItemForm()}</div>;
            return (
              <article key={item.id} className="cronograma-row card" style={{ '--atividade-cor': item.cor } as React.CSSProperties}>
                <div className="cronograma-time">
                  <strong>{formatTime(item.hora_inicio)}</strong>
                  <span aria-hidden="true">-</span>
                  <strong>{formatTime(item.hora_fim)}</strong>
                </div>
                <div className="cronograma-row__body">
                  <h3>{item.descricao}</h3>
                </div>
                <div className="cronograma-row__actions">
                  <button className="icon-btn" onClick={() => openEditItem(item)} aria-label="Editar horário"><Pencil size={17} /></button>
                  <button className="icon-btn icon-btn-danger" onClick={() => setDeleteTarget(item)} aria-label="Remover horário"><Trash2 size={17} /></button>
                </div>
              </article>
            );
          })
        )}
      </section>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Confirmar exclusão"
        message="Deseja remover este horário do cronograma?"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        isDestructive
      />

    </main>
  );
}
