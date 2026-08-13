import {
  Ban,
  CheckCircle2,
  ChevronDown,
  FileCheck2,
  FileText,
  Loader,
  Search,
  ReceiptText,
  Shirt,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PaymentProofGalleryModal } from '../compras/PaymentProofGalleryModal';
import { ConfirmDialog } from '../ConfirmDialog';
import { CurrencyFormField } from '../ui/CurrencyFormField';
import { FormField } from '../ui/FormField';
import { Modal } from '../ui/Modal';
import type {
  FinanceiroReconciliacao,
  FinanceiroReconciliacaoFormData,
  FinanceiroReconciliacaoPendente,
  FinanceiroReconciliacaoPendencias,
  FinanceiroReconciliacaoTipo,
} from '../../types/financeiro';
import './FinanceiroReconciliationPanel.css';

const hoje = () => new Date().toISOString().slice(0, 10);
const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const itemKey = (item: FinanceiroReconciliacaoPendente) => `${item.fonte}:${item.fonte_id}`;

interface FinanceiroReconciliationPanelProps {
  encontroId: string;
  canManage: boolean;
  loading: boolean;
  saving: boolean;
  pendencias: FinanceiroReconciliacaoPendencias;
  reconciliacoes: FinanceiroReconciliacao[];
  onCreate: (formData: FinanceiroReconciliacaoFormData) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
}

interface ReconciliationCardProps {
  tipo: FinanceiroReconciliacaoTipo;
  items: FinanceiroReconciliacaoPendente[];
  canManage: boolean;
  onOpen: () => void;
}

function ReconciliationCard({ tipo, items, canManage, onOpen }: ReconciliationCardProps) {
  const isTaxa = tipo === 'taxa';
  const total = items.reduce((sum, item) => sum + item.valor_esperado, 0);
  const proofs = new Set(items.flatMap((item) => item.comprovantes_urls)).size;

  return (
    <article className={`finance-reconciliation-card finance-reconciliation-card--${tipo}`}>
      <span className="finance-reconciliation-card__icon" aria-hidden="true">
        {isTaxa ? <ReceiptText size={22} /> : <Shirt size={22} />}
      </span>
      <div className="finance-reconciliation-card__body">
        <span>{isTaxa ? 'Taxas pagas' : 'Camisetas pagas'}</span>
        <strong>{money(total)}</strong>
        <small>
          {items.length} {items.length === 1 ? 'pagamento pendente' : 'pagamentos pendentes'}
          {' · '}{proofs} {proofs === 1 ? 'comprovante relacionado' : 'comprovantes relacionados'}
        </small>
      </div>
      {canManage && (
        <button type="button" className="btn-secondary" onClick={onOpen} disabled={items.length === 0}>
          <FileCheck2 size={17} /> Conciliar
        </button>
      )}
    </article>
  );
}

export function FinanceiroReconciliationPanel({
  encontroId,
  canManage,
  loading,
  saving,
  pendencias,
  reconciliacoes,
  onCreate,
  onCancel,
}: FinanceiroReconciliationPanelProps) {
  const [modalTipo, setModalTipo] = useState<FinanceiroReconciliacaoTipo | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [valorRecebido, setValorRecebido] = useState(0);
  const [dataRecebimento, setDataRecebimento] = useState(hoje());
  const [justificativa, setJustificativa] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activePublico, setActivePublico] = useState<'encontreiro' | 'encontrista'>('encontreiro');
  const [cancelTarget, setCancelTarget] = useState<FinanceiroReconciliacao | null>(null);
  const [proofGallery, setProofGallery] = useState<{ title: string; entityName: string; urls: string[] } | null>(null);

  const modalItems = useMemo(
    () => modalTipo === 'taxa' ? pendencias.taxas : modalTipo === 'camiseta' ? pendencias.camisetas : [],
    [modalTipo, pendencias],
  );
  const selectedItems = useMemo(
    () => modalItems.filter((item) => selectedKeys.has(itemKey(item))),
    [modalItems, selectedKeys],
  );
  const valorEsperado = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.valor_esperado, 0),
    [selectedItems],
  );
  const hasDifference = Math.abs(valorRecebido - valorEsperado) >= 0.01;

  const visibleItems = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase('pt-BR');
    return modalItems.filter((item) => (
      item.publico === activePublico
      && (!term
        || item.pessoa_nome.toLocaleLowerCase('pt-BR').includes(term)
        || (item.grupo_nome || '').toLocaleLowerCase('pt-BR').includes(term))
    ));
  }, [activePublico, modalItems, searchTerm]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, FinanceiroReconciliacaoPendente[]>();
    visibleItems.forEach((item) => {
      const group = item.grupo_nome || (activePublico === 'encontreiro' ? 'Sem equipe' : 'Sem dupla');
      groups.set(group, [...(groups.get(group) || []), item]);
    });
    return Array.from(groups.entries());
  }, [activePublico, visibleItems]);

  const publicoCounts = useMemo(() => ({
    encontreiro: modalItems.filter((item) => item.publico === 'encontreiro').length,
    encontrista: modalItems.filter((item) => item.publico === 'encontrista').length,
  }), [modalItems]);
  const allVisibleSelected = visibleItems.length > 0
    && visibleItems.every((item) => selectedKeys.has(itemKey(item)));

  useEffect(() => {
    setValorRecebido(valorEsperado);
  }, [valorEsperado]);

  const openModal = (tipo: FinanceiroReconciliacaoTipo) => {
    setModalTipo(tipo);
    setSelectedKeys(new Set());
    setValorRecebido(0);
    setDataRecebimento(hoje());
    setJustificativa('');
    setSearchTerm('');
    setActivePublico('encontreiro');
  };

  const closeModal = () => {
    if (saving) return;
    setModalTipo(null);
    setSelectedKeys(new Set());
  };

  const toggleItem = (item: FinanceiroReconciliacaoPendente) => {
    const key = itemKey(item);
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleGroup = (items: FinanceiroReconciliacaoPendente[]) => {
    const keys = items.map(itemKey);
    const allSelected = keys.every((key) => selectedKeys.has(key));

    setSelectedKeys((current) => {
      const next = new Set(current);
      keys.forEach((key) => {
        if (allSelected) next.delete(key);
        else next.add(key);
      });
      return next;
    });
  };

  const selectAll = () => {
    const visibleKeys = visibleItems.map(itemKey);
    const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((key) => selectedKeys.has(key));
    setSelectedKeys((current) => {
      const next = new Set(current);
      visibleKeys.forEach((key) => {
        if (allVisibleSelected) next.delete(key);
        else next.add(key);
      });
      return next;
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!modalTipo || selectedItems.length === 0 || valorRecebido <= 0) return;
    if (hasDifference && !justificativa.trim()) return;

    try {
      await onCreate({
        encontro_id: encontroId,
        tipo: modalTipo,
        itens: selectedItems.map(({ fonte, fonte_id }) => ({ fonte, fonte_id })),
        valor_recebido: valorRecebido,
        data_recebimento: dataRecebimento,
        justificativa: justificativa.trim(),
      });
      closeModal();
    } catch {
      // A página mantém o modal aberto e já apresenta a mensagem do backend.
    }
  };

  return (
    <section className="finance-reconciliation">
      <div className="finance-reconciliation__heading">
        <div>
          <span className="finance-reconciliation__eyebrow">CONFERÊNCIA DE RECEBIMENTOS</span>
          <h2>Pagamentos aguardando lançamento</h2>
          <p>Selecione os pagamentos, confira os comprovantes e informe o valor que realmente entrou no caixa.</p>
        </div>
      </div>

      {loading ? (
        <div className="finance-reconciliation__loading"><Loader className="animate-spin" /> Carregando recebimentos...</div>
      ) : (
        <div className="finance-reconciliation__cards">
          <ReconciliationCard tipo="taxa" items={pendencias.taxas} canManage={canManage} onOpen={() => openModal('taxa')} />
          <ReconciliationCard tipo="camiseta" items={pendencias.camisetas} canManage={canManage} onOpen={() => openModal('camiseta')} />
        </div>
      )}

      {reconciliacoes.length > 0 && (
        <details className="finance-reconciliation-history">
          <summary>
            <span><FileText size={18} /> Histórico de conciliações ({reconciliacoes.length})</span>
            <ChevronDown size={18} />
          </summary>
          <div className="finance-reconciliation-history__list">
            {reconciliacoes.map((reconciliacao) => {
              const difference = reconciliacao.valor_recebido - reconciliacao.valor_esperado;
              return (
                <article key={reconciliacao.id} className="finance-reconciliation-history__item">
                  <div className="finance-reconciliation-history__main">
                    <span className={`almox-status-pill ${reconciliacao.status === 'ativo' ? 'success' : 'warning'}`}>
                      {reconciliacao.status === 'ativo' ? 'Conciliação registrada' : 'Conciliação cancelada'}
                    </span>
                    <div>
                      <strong>{reconciliacao.tipo === 'taxa' ? 'Taxas' : 'Camisetas'} · {money(reconciliacao.valor_recebido)}</strong>
                      <small>
                        {reconciliacao.itens.length} {reconciliacao.itens.length === 1 ? 'pagamento' : 'pagamentos'} · {' '}
                        {new Date(`${reconciliacao.data_recebimento}T00:00:00`).toLocaleDateString('pt-BR')}
                      </small>
                    </div>
                  </div>
                  <div className="finance-reconciliation-history__details">
                    <span>Esperado: <strong>{money(reconciliacao.valor_esperado)}</strong></span>
                    {Math.abs(difference) >= 0.01 && <span>Diferença: <strong>{money(difference)}</strong></span>}
                    {reconciliacao.comprovantes_urls.length > 0 && (
                      <button
                        type="button"
                        className="finance-reconciliation__link"
                        onClick={() => setProofGallery({
                          title: 'Comprovantes da conciliação',
                          entityName: reconciliacao.tipo === 'taxa' ? 'Taxas' : 'Camisetas',
                          urls: reconciliacao.comprovantes_urls,
                        })}
                      >
                        Ver comprovantes ({reconciliacao.comprovantes_urls.length})
                      </button>
                    )}
                    {canManage && reconciliacao.status === 'ativo' && (
                      <button type="button" className="btn-secondary btn-sm" onClick={() => setCancelTarget(reconciliacao)}>
                        <Ban size={15} /> Cancelar
                      </button>
                    )}
                  </div>
                  {reconciliacao.justificativa && <p className="finance-reconciliation-history__note">{reconciliacao.justificativa}</p>}
                </article>
              );
            })}
          </div>
        </details>
      )}

      <Modal
        isOpen={modalTipo !== null}
        onClose={closeModal}
        title={modalTipo === 'taxa' ? 'Conciliar taxas' : 'Conciliar camisetas'}
        maxWidth="920px"
      >
        <form className="finance-reconciliation-modal" onSubmit={submit}>
          <div className="finance-reconciliation-modal__toolbar">
            <div>
              <strong>{selectedItems.length} de {modalItems.length} selecionados</strong>
              <span>Valor esperado: {money(valorEsperado)}</span>
            </div>
          </div>

          <div className="finance-reconciliation-modal__tabs" role="tablist" aria-label="Tipo de participante">
            <button
              type="button"
              role="tab"
              aria-selected={activePublico === 'encontreiro'}
              className={activePublico === 'encontreiro' ? 'active' : ''}
              onClick={() => {
                setActivePublico('encontreiro');
                setSearchTerm('');
              }}
            >
              Equipes de trabalho <span>{publicoCounts.encontreiro}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activePublico === 'encontrista'}
              className={activePublico === 'encontrista' ? 'active' : ''}
              onClick={() => {
                setActivePublico('encontrista');
                setSearchTerm('');
              }}
            >
              Encontristas <span>{publicoCounts.encontrista}</span>
            </button>
          </div>

          <div className="finance-reconciliation-modal__list-tools">
            <label className="finance-reconciliation-modal__search">
              <Search size={18} aria-hidden="true" />
              <span className="sr-only">Buscar pagamento</span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={activePublico === 'encontreiro'
                  ? 'Buscar pessoa ou equipe...'
                  : 'Buscar encontrista ou dupla...'}
              />
            </label>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={selectAll}
              disabled={visibleItems.length === 0}
            >
              <CheckCircle2 size={15} /> {allVisibleSelected ? 'Limpar seleção' : 'Selecionar todos'}
            </button>
          </div>

          <div className="finance-reconciliation-modal__groups">
            {groupedItems.map(([groupName, items]) => {
                    const selectedInGroup = items.filter((item) => selectedKeys.has(itemKey(item))).length;
                    const allGroupSelected = selectedInGroup === items.length;
                    const sharedProofUrls = Array.from(new Set(
                      items
                        .filter((item) => item.fonte !== 'visita_camiseta')
                        .flatMap((item) => item.comprovantes_urls),
                    ));

                    return (
                      <details key={`${activePublico}:${groupName}`} className="finance-reconciliation-modal__group">
                        <summary>
                          <span>
                            <strong>{groupName}</strong>
                            <small>{items.length} {items.length === 1 ? 'pagamento' : 'pagamentos'}</small>
                          </span>
                          <span>
                            <strong>{money(items.reduce((sum, item) => sum + item.valor_esperado, 0))}</strong>
                            <ChevronDown size={17} aria-hidden="true" />
                          </span>
                        </summary>
                        <div className="finance-reconciliation-modal__group-actions">
                          {sharedProofUrls.length > 0 && (
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              onClick={() => setProofGallery({
                                title: activePublico === 'encontreiro' ? 'Comprovantes da equipe' : 'Comprovantes da dupla',
                                entityName: groupName,
                                urls: sharedProofUrls,
                              })}
                            >
                              <FileText size={15} /> Ver comprovantes ({sharedProofUrls.length})
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={() => toggleGroup(items)}
                          >
                            <CheckCircle2 size={15} /> {allGroupSelected ? 'Limpar seleção' : 'Selecionar todos'}
                          </button>
                        </div>
                        {items.map((item) => (
                          <div key={itemKey(item)} className="finance-reconciliation-modal__row">
                            <input
                              id={`reconciliation-${item.fonte}-${item.fonte_id}`}
                              type="checkbox"
                              checked={selectedKeys.has(itemKey(item))}
                              onChange={() => toggleItem(item)}
                            />
                            <label
                              htmlFor={`reconciliation-${item.fonte}-${item.fonte_id}`}
                              className="finance-reconciliation-modal__person"
                            >
                              <strong>{item.pessoa_nome}</strong>
                            </label>
                            {item.fonte === 'visita_camiseta' && item.comprovantes_urls.length > 0 && (
                              <button
                                type="button"
                                className="finance-reconciliation__link"
                                onClick={() => setProofGallery({
                                  title: 'Comprovante do pagamento',
                                  entityName: item.pessoa_nome,
                                  urls: item.comprovantes_urls,
                                })}
                              >
                                <FileText size={15} /> {item.comprovantes_urls.length}
                              </button>
                            )}
                            <strong className="finance-reconciliation-modal__value">{money(item.valor_esperado)}</strong>
                          </div>
                        ))}
                      </details>
                    );
                  })}
            {groupedItems.length === 0 && (
              <div className="finance-reconciliation-modal__empty">
                {searchTerm
                  ? `Nenhum pagamento encontrado para “${searchTerm}”.`
                  : activePublico === 'encontreiro'
                    ? 'Nenhum pagamento de equipe disponível.'
                    : 'Nenhum pagamento de encontrista disponível.'}
              </div>
            )}
          </div>

          <div className="finance-reconciliation-modal__form">
            <CurrencyFormField
              label="Valor efetivamente recebido"
              name="valor_recebido"
              value={valorRecebido}
              onChange={setValorRecebido}
              required
            />
            <FormField
              label="Data do recebimento"
              name="data_recebimento"
              type="date"
              value={dataRecebimento}
              onChange={(event) => setDataRecebimento(event.target.value)}
              required
            />
            {hasDifference && (
              <div className="finance-reconciliation-modal__justification">
                <FormField
                  label="Justificativa da diferença"
                  name="justificativa"
                  as="textarea"
                  rows={3}
                  value={justificativa}
                  onChange={(event) => setJustificativa(event.target.value)}
                  required
                />
                <span>Diferença de {money(valorRecebido - valorEsperado)} em relação aos itens selecionados.</span>
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={closeModal} disabled={saving}>Cancelar</button>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving || selectedItems.length === 0 || valorRecebido <= 0 || (hasDifference && !justificativa.trim())}
            >
              {saving ? <><Loader size={17} className="animate-spin" /> Salvando...</> : <><CheckCircle2 size={17} /> Confirmar e lançar</>}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={cancelTarget !== null}
        onCancel={() => setCancelTarget(null)}
        onConfirm={async () => {
          if (!cancelTarget) return;
          try {
            await onCancel(cancelTarget.id);
            setCancelTarget(null);
          } catch {
            // A página mantém a confirmação aberta e já apresenta a mensagem do backend.
          }
        }}
        title="Cancelar conciliação"
        message="O lançamento financeiro será cancelado e os pagamentos voltarão a ficar disponíveis para uma nova conciliação. O histórico será preservado."
        confirmText="Cancelar conciliação"
        isDestructive
        isLoading={saving}
      />

      {proofGallery && (
        <PaymentProofGalleryModal
          title={proofGallery.title}
          entityName={proofGallery.entityName}
          urls={proofGallery.urls}
          onClose={() => setProofGallery(null)}
        />
      )}
    </section>
  );
}
