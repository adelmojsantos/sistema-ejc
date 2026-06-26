export type PesquisaSatisfacaoStatus = 'rascunho' | 'enviado' | 'pendente';
export type PesquisaSatisfacaoOpcao = 'sim' | 'nao' | 'em_partes';
export type PesquisaSatisfacaoQuestionType = 'sim_nao_partes' | 'texto' | 'nota' | 'sim_nao';

export interface PesquisaSatisfacaoQuestion {
  id: string;
  encontro_id?: string;
  ordem?: number;
  sectionId: string;
  sectionTitle: string;
  title: string;
  type: PesquisaSatisfacaoQuestionType;
  required?: boolean;
  active?: boolean;
}

export interface PesquisaSatisfacaoPerguntaFormData {
  encontro_id: string;
  ordem: number;
  section_id: string;
  section_title: string;
  title: string;
  type: PesquisaSatisfacaoQuestionType;
  required: boolean;
  active: boolean;
}

export interface PesquisaSatisfacaoResposta {
  opcao?: PesquisaSatisfacaoOpcao;
  observacao?: string;
  texto?: string;
  nota?: number;
  simNao?: 'sim' | 'nao';
}

export type PesquisaSatisfacaoRespostas = Record<string, PesquisaSatisfacaoResposta>;

export interface PesquisaSatisfacaoEnvio {
  id: string;
  encontro_id: string;
  equipe_id: string;
  participacao_id: string;
  respostas: PesquisaSatisfacaoRespostas;
  status: Exclude<PesquisaSatisfacaoStatus, 'pendente'>;
  enviado_em: string | null;
}

export interface PesquisaSatisfacaoPublicParticipante {
  participacao_id: string;
  nome: string;
}

export interface PesquisaSatisfacaoPublicInfo {
  encontro_id: string;
  encontro_nome: string;
  equipe_id: string;
  equipe_nome: string;
  participantes: PesquisaSatisfacaoPublicParticipante[];
}

export interface PesquisaSatisfacaoAcesso {
  participacao_id: string;
  nome: string;
  status: PesquisaSatisfacaoStatus;
  respostas: PesquisaSatisfacaoRespostas;
  enviado_em: string | null;
}

export interface PesquisaSatisfacaoResumoEquipe {
  totalParticipantes: number;
  totalRascunhos: number;
  totalEnviados: number;
  totalPendentes: number;
  integrantes: PesquisaSatisfacaoIntegranteStatus[];
}

export interface PesquisaSatisfacaoIntegranteStatus {
  participacaoId: string;
  nome: string;
  status: PesquisaSatisfacaoStatus;
}

export const PESQUISA_SATISFACAO_QUESTIONS: PesquisaSatisfacaoQuestion[] = [
  { id: 'estrutura_limpeza_organizacao', sectionId: 'estrutura', sectionTitle: 'Estrutura', title: 'A limpeza e organização atenderam às expectativas?', type: 'sim_nao_partes', required: true },
  { id: 'estrutura_alimentacao', sectionId: 'estrutura', sectionTitle: 'Estrutura', title: 'A alimentação foi satisfatória?', type: 'sim_nao_partes', required: true },
  { id: 'estrutura_horarios', sectionId: 'estrutura', sectionTitle: 'Estrutura', title: 'Os horários foram cumpridos?', type: 'sim_nao_partes', required: true },

  { id: 'organizacao_programacao', sectionId: 'organizacao', sectionTitle: 'Organização', title: 'A programação foi bem planejada?', type: 'sim_nao_partes', required: true },
  { id: 'organizacao_comunicacao', sectionId: 'organizacao', sectionTitle: 'Organização', title: 'A comunicação entre as equipes funcionou?', type: 'sim_nao_partes', required: true },
  { id: 'organizacao_materiais', sectionId: 'organizacao', sectionTitle: 'Organização', title: 'Os materiais estavam disponíveis quando necessários?', type: 'sim_nao_partes', required: true },
  { id: 'organizacao_transicoes', sectionId: 'organizacao', sectionTitle: 'Organização', title: 'Houve boa organização dos momentos de transição?', type: 'sim_nao_partes', required: true },

  { id: 'equipe_unidade', sectionId: 'equipe_trabalho', sectionTitle: 'Equipe de Trabalho', title: 'A equipe trabalhou em unidade?', type: 'sim_nao_partes', required: true },
  { id: 'equipe_comprometimento', sectionId: 'equipe_trabalho', sectionTitle: 'Equipe de Trabalho', title: 'Houve comprometimento dos integrantes?', type: 'sim_nao_partes', required: true },
  { id: 'equipe_servico', sectionId: 'equipe_trabalho', sectionTitle: 'Equipe de Trabalho', title: 'A equipe demonstrou espírito de serviço?', type: 'sim_nao_partes', required: true },
  { id: 'equipe_problemas', sectionId: 'equipe_trabalho', sectionTitle: 'Equipe de Trabalho', title: 'Os problemas foram resolvidos com rapidez?', type: 'sim_nao_partes', required: true },

  { id: 'coordenadores_suporte', sectionId: 'coordenadores', sectionTitle: 'Coordenadores', title: 'Os coordenadores deram o suporte necessário?', type: 'sim_nao_partes', required: true },
  { id: 'coordenadores_lideranca', sectionId: 'coordenadores', sectionTitle: 'Coordenadores', title: 'A liderança foi clara e respeitosa?', type: 'sim_nao_partes', required: true },
  { id: 'coordenadores_funcoes', sectionId: 'coordenadores', sectionTitle: 'Coordenadores', title: 'As funções da equipe ficaram claras?', type: 'sim_nao_partes', required: true },
  { id: 'coordenadores_decisoes', sectionId: 'coordenadores', sectionTitle: 'Coordenadores', title: 'As decisões foram tomadas no momento certo?', type: 'sim_nao_partes', required: true },
  { id: 'coordenadores_sugestoes', sectionId: 'coordenadores', sectionTitle: 'Coordenadores', title: 'Houve abertura para ouvir sugestões?', type: 'sim_nao_partes', required: true },
  { id: 'coordenadores_seguranca', sectionId: 'coordenadores', sectionTitle: 'Coordenadores', title: 'A coordenação transmitiu segurança durante o encontro?', type: 'sim_nao_partes', required: true },

  { id: 'espiritualidade_clima', sectionId: 'espiritualidade', sectionTitle: 'Espiritualidade', title: 'O clima espiritual favoreceu o encontro com Deus?', type: 'sim_nao_partes', required: true },
  { id: 'espiritualidade_oracao', sectionId: 'espiritualidade', sectionTitle: 'Espiritualidade', title: 'Os momentos de oração foram bem conduzidos?', type: 'sim_nao_partes', required: true },
  { id: 'espiritualidade_testemunho', sectionId: 'espiritualidade', sectionTitle: 'Espiritualidade', title: 'A equipe viveu aquilo que pregou aos encontristas?', type: 'sim_nao_partes', required: true },
  { id: 'espiritualidade_tema', sectionId: 'espiritualidade', sectionTitle: 'Espiritualidade', title: 'O tema "Meu Coração em Tua Presença" foi percebido durante todo o encontro?', type: 'sim_nao_partes', required: true },

  { id: 'pontos_fortes_marcou', sectionId: 'pontos_fortes', sectionTitle: 'Pontos Fortes', title: 'O que mais marcou positivamente o encontro?', type: 'texto', required: true },
  { id: 'pontos_fortes_equipe_destaque', sectionId: 'pontos_fortes', sectionTitle: 'Pontos Fortes', title: 'Qual equipe merece destaque? Por quê?', type: 'texto', required: true },

  { id: 'melhorias_proximo', sectionId: 'pontos_melhoria', sectionTitle: 'Pontos de Melhoria', title: 'O que precisa ser melhorado para o próximo encontro?', type: 'texto', required: true },
  { id: 'melhorias_dificuldade', sectionId: 'pontos_melhoria', sectionTitle: 'Pontos de Melhoria', title: 'Houve alguma dificuldade que poderia ter sido evitada?', type: 'texto', required: true },
  { id: 'melhorias_sugestoes', sectionId: 'pontos_melhoria', sectionTitle: 'Pontos de Melhoria', title: 'Que sugestões você daria?', type: 'texto', required: true },

  { id: 'avaliacao_final_nota', sectionId: 'avaliacao_final', sectionTitle: 'Avaliação Final', title: 'Nota geral do encontro', type: 'nota', required: true },
  { id: 'avaliacao_final_serviria_mesma_equipe', sectionId: 'avaliacao_final', sectionTitle: 'Avaliação Final', title: 'Você serviria novamente na mesma equipe?', type: 'sim_nao', required: true },
  { id: 'avaliacao_final_mensagem', sectionId: 'avaliacao_final', sectionTitle: 'Avaliação Final', title: 'Deixe uma mensagem', type: 'texto', required: false },
];

export const PESQUISA_SATISFACAO_SECTIONS = Array.from(
  PESQUISA_SATISFACAO_QUESTIONS.reduce((map, question) => {
    if (!map.has(question.sectionId)) {
      map.set(question.sectionId, {
        id: question.sectionId,
        title: question.sectionTitle,
        questions: [] as PesquisaSatisfacaoQuestion[],
      });
    }
    map.get(question.sectionId)!.questions.push(question);
    return map;
  }, new Map<string, { id: string; title: string; questions: PesquisaSatisfacaoQuestion[] }>())
    .values()
);
