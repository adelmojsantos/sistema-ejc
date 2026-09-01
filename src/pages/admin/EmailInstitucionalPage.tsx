import DOMPurify from 'dompurify';
import {
  ArchiveRestore,
  ArrowLeft,
  CheckCircle2,
  Download,
  Inbox,
  LoaderCircle,
  Mail,
  MoreVertical,
  Paperclip,
  RefreshCw,
  Reply,
  Search,
  Send,
  UserRoundCheck,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { emailInstitucionalService } from '../../services/emailInstitucionalService';
import type {
  EmailInstitucionalConversaResumo,
  EmailInstitucionalMensagemCompleta,
  EmailInstitucionalStatus,
} from '../../types/emailInstitucional';
import './EmailInstitucionalPage.css';

const statusLabels: Record<EmailInstitucionalStatus, string> = {
  novo: 'Novo',
  em_atendimento: 'Em atendimento',
  resolvido: 'Resolvido',
};

function formatDate(value: string): string {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
  }
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function MessageBody({ message }: { message: EmailInstitucionalMensagemCompleta }) {
  const [content, setContent] = useState<{ html: string | null; text: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    emailInstitucionalService.obterConteudo(message)
      .then((result) => active && setContent(result))
      .catch(() => {
        if (!active) return;
        if (message.direcao === 'saida') {
          setContent({ html: null, text: message.previa });
          return;
        }
        setError(true);
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [message]);

  if (loading) return <div className="institutional-email-message__loading"><LoaderCircle className="is-spinning" size={18} /> Carregando mensagem...</div>;
  if (error) return <p className="institutional-email-message__error">Não foi possível carregar o conteúdo. A prévia disponível é: {message.previa}</p>;
  if (content?.html) {
    return <div className="institutional-email-message__html" dangerouslySetInnerHTML={{
      __html: DOMPurify.sanitize(content.html, {
        FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe', 'object', 'embed', 'img'],
        FORBID_ATTR: ['style'],
      }),
    }} />;
  }
  return <div className="institutional-email-message__text">{content?.text || message.previa}</div>;
}

export function EmailInstitucionalPage() {
  const { profile, hasPermission } = useAuth();
  const [conversations, setConversations] = useState<EmailInstitucionalConversaResumo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<EmailInstitucionalMensagemCompleta[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<EmailInstitucionalStatus | 'todos'>('todos');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyOpen, setReplyOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const realtimeRefreshTimer = useRef<number | null>(null);
  const readThroughMessage = useRef(new Map<string, string>());

  const canReply = hasPermission('email_institucional_responder') || hasPermission('modulo_admin');
  const selected = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) || null,
    [conversations, selectedId],
  );

  const loadConversations = useCallback(async (showLoader = false) => {
    if (showLoader) setLoadingList(true);
    try {
      const data = await emailInstitucionalService.listar({
        busca: search,
        status: status === 'todos' ? null : status,
      });
      setConversations(data);
      if (selectedId && !data.some((conversation) => conversation.id === selectedId)) setSelectedId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar a caixa de entrada.');
    } finally {
      setLoadingList(false);
    }
  }, [search, selectedId, status]);

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true);
    try {
      const data = await emailInstitucionalService.obterMensagens(conversationId);
      setMessages(data);
      const latestIncoming = [...data].reverse().find((message) => message.direcao === 'entrada');
      if (latestIncoming && readThroughMessage.current.get(conversationId) !== latestIncoming.id) {
        readThroughMessage.current.set(conversationId, latestIncoming.id);
        try {
          await emailInstitucionalService.marcarComoLida(conversationId);
          setConversations((current) => current.map((item) => item.id === conversationId ? { ...item, nao_lida: false } : item));
        } catch (error) {
          readThroughMessage.current.delete(conversationId);
          throw error;
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível abrir a conversa.');
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadConversations(true), 300);
    return () => window.clearTimeout(timer);
  }, [loadConversations]);

  useEffect(() => {
    const subscription = emailInstitucionalService.subscribe(() => {
      if (realtimeRefreshTimer.current !== null) window.clearTimeout(realtimeRefreshTimer.current);
      realtimeRefreshTimer.current = window.setTimeout(() => {
        realtimeRefreshTimer.current = null;
        void loadConversations();
        if (selectedId) void loadMessages(selectedId);
      }, 250);
    });
    return () => {
      if (realtimeRefreshTimer.current !== null) window.clearTimeout(realtimeRefreshTimer.current);
      void subscription.unsubscribe();
    };
  }, [loadConversations, loadMessages, selectedId]);

  const openConversation = (conversationId: string) => {
    setSelectedId(conversationId);
    setReplyText('');
    setReplyOpen(false);
    void loadMessages(conversationId);
  };

  const updateConversation = async (params: Parameters<typeof emailInstitucionalService.atualizarAtendimento>[1]) => {
    if (!selected) return;
    setUpdating(true);
    try {
      await emailInstitucionalService.atualizarAtendimento(selected.id, params);
      await loadConversations();
      toast.success('Atendimento atualizado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar o atendimento.');
    } finally {
      setUpdating(false);
    }
  };

  const sendReply = async () => {
    if (!selected || !replyText.trim() || sending) return;
    setSending(true);
    try {
      await emailInstitucionalService.responder(selected.id, replyText.trim(), crypto.randomUUID());
      setReplyText('');
      setReplyOpen(false);
      await Promise.all([loadMessages(selected.id), loadConversations()]);
      toast.success('Resposta enviada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível enviar a resposta.');
    } finally {
      setSending(false);
    }
  };

  return (
    <main className={`institutional-email-page animate-fade-in ${selected ? 'has-selection' : ''}`}>
      <header className="institutional-email-header">
        <div>
          <span className="institutional-email-eyebrow">E-mail institucional</span>
          <h1><Mail size={32} /> Caixa de entrada</h1>
          <p>Receba e responda mensagens enviadas para contato@ejccapelinha.com.br.</p>
        </div>
        <button
          type="button"
          className="btn-secondary institutional-email-refresh"
          onClick={() => void loadConversations(true)}
          disabled={loadingList}
          aria-label={loadingList ? 'Atualizando caixa de entrada' : 'Atualizar caixa de entrada'}
          title={loadingList ? 'Atualizando caixa de entrada' : 'Atualizar caixa de entrada'}
        >
          <RefreshCw size={18} className={loadingList ? 'is-spinning' : undefined} />
          <span>{loadingList ? 'Atualizando...' : 'Atualizar'}</span>
        </button>
      </header>

      <section className={`institutional-email-shell ${selected ? 'has-selection' : ''}`}>
        <aside className="institutional-email-inbox" aria-label="Caixa de entrada">
          <div className="institutional-email-filters">
            <label className="institutional-email-search">
              <Search size={18} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar e-mails..." />
              {search && <button type="button" onClick={() => setSearch('')} aria-label="Limpar busca"><X size={16} /></button>}
            </label>
            <select value={status} onChange={(event) => setStatus(event.target.value as EmailInstitucionalStatus | 'todos')} aria-label="Filtrar por status">
              <option value="todos">Todos os status</option>
              <option value="novo">Novos</option>
              <option value="em_atendimento">Em atendimento</option>
              <option value="resolvido">Resolvidos</option>
            </select>
          </div>

          <div className="institutional-email-list">
            {loadingList && conversations.length === 0 && <div className="institutional-email-empty"><LoaderCircle className="is-spinning" /> Carregando mensagens...</div>}
            {!loadingList && conversations.length === 0 && <div className="institutional-email-empty"><Inbox size={36} /><strong>Nenhuma mensagem</strong><span>Quando um e-mail chegar, ele aparecerá aqui automaticamente.</span></div>}
            {conversations.map((conversation) => (
              <button
                type="button"
                key={conversation.id}
                className={`institutional-email-list-item ${conversation.id === selectedId ? 'is-selected' : ''} ${conversation.nao_lida ? 'is-unread' : ''}`}
                onClick={() => openConversation(conversation.id)}
              >
                <span className="institutional-email-list-item__top">
                  <strong>{conversation.contato_nome || conversation.contato_email}</strong>
                  <time>{formatDate(conversation.ultima_mensagem_em)}</time>
                </span>
                <span className="institutional-email-list-item__subject">{conversation.assunto}</span>
                <span className={`institutional-email-status institutional-email-status--${conversation.status}`}>{statusLabels[conversation.status]}</span>
              </button>
            ))}
          </div>
        </aside>

        <article className="institutional-email-conversation">
          {!selected && <div className="institutional-email-placeholder"><Mail size={48} /><h2>Selecione uma conversa</h2><p>Escolha uma mensagem para visualizar seu conteúdo e responder.</p></div>}
          {selected && (
            <>
              <header className="institutional-email-conversation__header">
                <button type="button" className="institutional-email-back" onClick={() => setSelectedId(null)}>
                  <ArrowLeft size={20} /><span>Caixa de entrada</span>
                </button>
                <div>
                  <h2>{selected.assunto}</h2>
                  <p>{selected.contato_nome ? `${selected.contato_nome} · ` : ''}{selected.contato_email}</p>
                </div>
                {canReply && (
                  <>
                    <div className="institutional-email-actions institutional-email-actions--desktop">
                      <button type="button" onClick={() => void updateConversation({ responsavelId: profile?.id || null, alterarResponsavel: true, status: 'em_atendimento' })} disabled={updating}>
                        <UserRoundCheck size={17} /> {selected.responsavel_id === profile?.id ? 'Atribuído a mim' : 'Assumir'}
                      </button>
                      {selected.status === 'resolvido' ? (
                        <button type="button" onClick={() => void updateConversation({ status: 'em_atendimento' })} disabled={updating}><ArchiveRestore size={17} /> Reabrir</button>
                      ) : (
                        <button type="button" onClick={() => void updateConversation({ status: 'resolvido' })} disabled={updating}><CheckCircle2 size={17} /> Resolver</button>
                      )}
                    </div>
                    <details className="institutional-email-actions-menu">
                      <summary aria-label="Abrir ações da conversa" title="Ações da conversa"><MoreVertical size={20} /></summary>
                      <div className="institutional-email-actions">
                        <button type="button" onClick={() => void updateConversation({ responsavelId: profile?.id || null, alterarResponsavel: true, status: 'em_atendimento' })} disabled={updating}>
                          <UserRoundCheck size={17} /> {selected.responsavel_id === profile?.id ? 'Atribuído a mim' : 'Assumir'}
                        </button>
                        {selected.status === 'resolvido' ? (
                          <button type="button" onClick={() => void updateConversation({ status: 'em_atendimento' })} disabled={updating}><ArchiveRestore size={17} /> Reabrir</button>
                        ) : (
                          <button type="button" onClick={() => void updateConversation({ status: 'resolvido' })} disabled={updating}><CheckCircle2 size={17} /> Resolver</button>
                        )}
                      </div>
                    </details>
                  </>
                )}
              </header>

              <div className="institutional-email-thread">
                {loadingMessages && <div className="institutional-email-empty"><LoaderCircle className="is-spinning" /> Carregando conversa...</div>}
                {!loadingMessages && messages.map((message) => (
                  <section key={message.id} className={`institutional-email-message institutional-email-message--${message.direcao}`}>
                    <header>
                      <div>
                        <strong>{message.remetente_nome || message.remetente_email}</strong>
                        <span>{message.remetente_email}</span>
                      </div>
                      <time>{formatDate(message.recebida_em || message.enviada_em || message.criada_em)}</time>
                    </header>
                    <MessageBody message={message} />
                    {message.anexos.length > 0 && (
                      <div className="institutional-email-attachments">
                        {message.anexos.map((attachment) => (
                          <button type="button" key={attachment.id} onClick={() => void emailInstitucionalService.baixarAnexo(attachment).catch((error) => toast.error(error.message))}>
                            <Paperclip size={16} /><span>{attachment.nome}<small>{formatBytes(attachment.tamanho_bytes)}</small></span><Download size={16} />
                          </button>
                        ))}
                      </div>
                    )}
                    {message.status_envio === 'falhou' && <p className="institutional-email-send-error">Falha no envio: {message.erro_envio || 'tente novamente'}</p>}
                  </section>
                ))}
              </div>

              {canReply && (
                <footer className={`institutional-email-reply ${replyOpen ? 'is-open' : ''}`}>
                  {!replyOpen ? (
                    <button type="button" className="institutional-email-reply-trigger" onClick={() => setReplyOpen(true)}>
                      <Reply size={18} /> Responder
                    </button>
                  ) : (
                    <>
                      <div className="institutional-email-reply__header">
                        <label htmlFor="institutional-email-reply"><Reply size={17} /> Responder para {selected.contato_email}</label>
                        <button type="button" className="institutional-email-reply__close" onClick={() => setReplyOpen(false)} aria-label="Fechar resposta" title="Fechar resposta">
                          <X size={18} />
                        </button>
                      </div>
                      <textarea autoFocus id="institutional-email-reply" value={replyText} onChange={(event) => setReplyText(event.target.value)} placeholder="Escreva sua resposta..." rows={3} maxLength={50_000} disabled={sending} />
                      <div className="institutional-email-reply__footer">
                        <span>{replyText.length.toLocaleString('pt-BR')} / 50.000</span>
                        <button type="button" className="btn-primary" onClick={() => void sendReply()} disabled={!replyText.trim() || sending}>
                          {sending ? <LoaderCircle className="is-spinning" size={18} /> : <Send size={18} />}
                          {sending ? 'Enviando...' : 'Enviar resposta'}
                        </button>
                      </div>
                    </>
                  )}
                </footer>
              )}
            </>
          )}
        </article>
      </section>
    </main>
  );
}
