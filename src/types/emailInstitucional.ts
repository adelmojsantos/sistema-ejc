export type EmailInstitucionalStatus = 'novo' | 'em_atendimento' | 'resolvido';
export type EmailInstitucionalDirecao = 'entrada' | 'saida';

export interface EmailInstitucionalConversaResumo {
  id: string;
  assunto: string;
  contato_email: string;
  contato_nome: string | null;
  status: EmailInstitucionalStatus;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  ultima_mensagem_em: string;
  ultima_previa: string | null;
  ultima_direcao: EmailInstitucionalDirecao | null;
  nao_lida: boolean;
}

export interface EmailInstitucionalMensagem {
  id: string;
  conversa_id: string;
  direcao: EmailInstitucionalDirecao;
  provider_message_id: string | null;
  remetente_email: string;
  remetente_nome: string | null;
  destinatarios: string[];
  copias: string[];
  assunto: string;
  previa: string;
  r2_texto_key: string | null;
  r2_html_key: string | null;
  tamanho_bytes: number;
  status_envio: 'enviando' | 'enviado' | 'falhou' | null;
  erro_envio: string | null;
  criado_por: string | null;
  recebida_em: string | null;
  enviada_em: string | null;
  criada_em: string;
}

export interface EmailInstitucionalAnexo {
  id: string;
  mensagem_id: string;
  nome: string;
  mime_type: string;
  tamanho_bytes: number;
  content_id: string | null;
}

export interface EmailInstitucionalMensagemCompleta extends EmailInstitucionalMensagem {
  anexos: EmailInstitucionalAnexo[];
}
