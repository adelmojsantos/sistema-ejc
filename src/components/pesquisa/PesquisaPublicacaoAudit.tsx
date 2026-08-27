import { Clock3, History } from 'lucide-react';
import { useEffect, useState } from 'react';

import { pesquisaPublicacaoService } from '../../services/pesquisaPublicacaoService';
import type { PesquisaPublicacaoAuditoria, PesquisaPublicacaoTipo } from '../../types/pesquisaPublicacao';
import { Modal } from '../ui/Modal';

interface PesquisaPublicacaoAuditProps {
  encontroId: string;
  tipo: PesquisaPublicacaoTipo;
  refreshKey: string;
}

function actorLabel(item: PesquisaPublicacaoAuditoria) {
  return item.realizado_por_nome || item.realizado_por_email || 'Autor não registrado';
}

function dateLabel(value: string) {
  return new Date(value).toLocaleString('pt-BR');
}

export function PesquisaPublicacaoAudit({ encontroId, tipo, refreshKey }: PesquisaPublicacaoAuditProps) {
  const [items, setItems] = useState<PesquisaPublicacaoAuditoria[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    pesquisaPublicacaoService.listarAuditoria(encontroId, tipo)
      .then((result) => { if (active) setItems(result); })
      .catch(() => { if (active) setItems([]); });
    return () => { active = false; };
  }, [encontroId, refreshKey, tipo]);

  const latest = items[0];
  return (
    <>
      <div className="pesquisa-publication-audit">
        {latest ? (
          <span><Clock3 size={14} /> {latest.acao === 'publicou' ? 'Publicada' : 'Despublicada'} por {actorLabel(latest)} em {dateLabel(latest.realizado_em)}</span>
        ) : (
          <span><Clock3 size={14} /> Nenhum histórico de publicação registrado.</span>
        )}
        {items.length > 0 && (
          <button type="button" className="btn-text" onClick={() => setOpen(true)}>
            <History size={14} /> Ver histórico
          </button>
        )}
      </div>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Histórico de publicação" maxWidth="620px">
        <ol className="pesquisa-publication-history">
          {items.map((item) => (
            <li key={item.id}>
              <strong>{item.acao === 'publicou' ? 'Publicou' : 'Despublicou'}</strong>
              <span>{actorLabel(item)}</span>
              <time>{dateLabel(item.realizado_em)}</time>
            </li>
          ))}
        </ol>
      </Modal>

      <style>{`
        .pesquisa-publication-audit { align-items: center; display: flex; flex-wrap: wrap; gap: .45rem .75rem; margin-top: .55rem; }
        .pesquisa-publication-audit > span, .pesquisa-publication-audit button { align-items: center; display: inline-flex; gap: .35rem; font-size: .76rem; }
        .pesquisa-publication-history { display: grid; gap: .65rem; list-style: none; margin: 0; padding: 0; }
        .pesquisa-publication-history li { background: var(--secondary-bg); border: 1px solid var(--border-color); border-radius: 10px; display: grid; gap: .2rem; padding: .8rem; }
        .pesquisa-publication-history span, .pesquisa-publication-history time { color: var(--muted-text); font-size: .8rem; }
      `}</style>
    </>
  );
}
