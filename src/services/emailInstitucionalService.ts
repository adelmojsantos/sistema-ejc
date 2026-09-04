import { supabase } from '../lib/supabase';
import type {
  EmailInstitucionalAnexo,
  EmailInstitucionalConversaResumo,
  EmailInstitucionalMensagem,
  EmailInstitucionalMensagemCompleta,
  EmailInstitucionalStatus,
} from '../types/emailInstitucional';

const emailWorkerUrl = (import.meta.env.VITE_EMAIL_WORKER_URL as string | undefined)?.replace(/\/+$/, '');
type EmailContent = { html: string | null; text: string | null };
const contentRequests = new Map<string, Promise<EmailContent>>();

async function sessionToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error('Sua sessão expirou. Entre novamente.');
  return data.session.access_token;
}

function workerUrl(path: string): string {
  if (!emailWorkerUrl) throw new Error('A caixa institucional ainda não foi configurada neste ambiente.');
  return `${emailWorkerUrl}${path}`;
}

export const emailInstitucionalService = {
  async contarNovas(): Promise<number> {
    const { data, error } = await supabase.rpc('contar_email_institucional_novas');
    if (error) throw error;
    return Number(data || 0);
  },

  async listar(params?: { busca?: string; status?: EmailInstitucionalStatus | null }) {
    const { data, error } = await supabase.rpc('listar_email_institucional_conversas', {
      p_busca: params?.busca?.trim() || null,
      p_status: params?.status || null,
      p_limite: 100,
      p_offset: 0,
    });
    if (error) throw error;
    return (data || []) as EmailInstitucionalConversaResumo[];
  },

  async obterMensagens(conversaId: string): Promise<EmailInstitucionalMensagemCompleta[]> {
    const { data: messages, error } = await supabase
      .from('email_institucional_mensagens')
      .select('id,conversa_id,direcao,provider_message_id,remetente_email,remetente_nome,destinatarios,copias,assunto,previa,r2_texto_key,r2_html_key,tamanho_bytes,status_envio,erro_envio,criado_por,recebida_em,enviada_em,criada_em')
      .eq('conversa_id', conversaId)
      .order('criada_em', { ascending: true });
    if (error) throw error;

    const typedMessages = (messages || []) as EmailInstitucionalMensagem[];
    if (typedMessages.length === 0) return [];
    const { data: attachments, error: attachmentsError } = await supabase
      .from('email_institucional_anexos')
      .select('id,mensagem_id,nome,mime_type,tamanho_bytes,content_id')
      .in('mensagem_id', typedMessages.map((message) => message.id));
    if (attachmentsError) throw attachmentsError;
    const typedAttachments = (attachments || []) as EmailInstitucionalAnexo[];
    return typedMessages.map((message) => ({
      ...message,
      anexos: typedAttachments.filter((attachment) => attachment.mensagem_id === message.id),
    }));
  },

  async marcarComoLida(conversaId: string): Promise<void> {
    const { error } = await supabase.rpc('marcar_email_institucional_como_lido', {
      p_conversa_id: conversaId,
    });
    if (error) throw error;
  },

  async atualizarAtendimento(
    conversaId: string,
    params: { status?: EmailInstitucionalStatus; responsavelId?: string | null; alterarResponsavel?: boolean },
  ): Promise<void> {
    const { error } = await supabase.rpc('atualizar_atendimento_email_institucional', {
      p_conversa_id: conversaId,
      p_status: params.status || null,
      p_responsavel_id: params.responsavelId ?? null,
      p_alterar_responsavel: params.alterarResponsavel || false,
    });
    if (error) throw error;
  },

  async obterConteudo(mensagem: EmailInstitucionalMensagem): Promise<EmailContent> {
    const format = mensagem.r2_html_key ? 'html' : 'text';
    if (!mensagem.r2_html_key && !mensagem.r2_texto_key) return { html: null, text: mensagem.previa };
    const cacheKey = `${mensagem.id}:${format}`;
    const cached = contentRequests.get(cacheKey);
    if (cached) return cached;

    const request = (async (): Promise<EmailContent> => {
      const token = await sessionToken();
      const response = await fetch(workerUrl(`/messages/${mensagem.id}/content/${format}`), {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        if (response.status !== 404) contentRequests.delete(cacheKey);
        throw new Error('Não foi possível carregar o conteúdo da mensagem.');
      }
      const content = await response.text();
      return format === 'html' ? { html: content, text: null } : { html: null, text: content };
    })();
    contentRequests.set(cacheKey, request);
    return request;
  },

  async baixarAnexo(anexo: EmailInstitucionalAnexo): Promise<void> {
    const token = await sessionToken();
    const response = await fetch(workerUrl(`/attachments/${anexo.id}`), {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Não foi possível baixar o anexo.');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = anexo.nome;
    anchor.click();
    URL.revokeObjectURL(url);
  },

  async responder(conversaId: string, mensagem: string, requestId: string): Promise<void> {
    const token = await sessionToken();
    const response = await fetch(workerUrl('/reply'), {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ conversaId, mensagem, requestId }),
    });
    const result = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) throw new Error(result?.error || 'Não foi possível enviar a resposta.');
  },

  subscribe(onChange: () => void) {
    return supabase
      .channel('email-institucional-ui')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'email_institucional_conversas' }, onChange)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'email_institucional_mensagens' }, onChange)
      .subscribe();
  },

  subscribeConversations(onChange: () => void) {
    return supabase
      .channel('email-institucional-header')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'email_institucional_conversas' }, onChange)
      .subscribe();
  },
};
