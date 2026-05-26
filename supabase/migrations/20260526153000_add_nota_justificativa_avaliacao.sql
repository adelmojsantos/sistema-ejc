ALTER TABLE public.avaliacao_perguntas
DROP CONSTRAINT IF EXISTS avaliacao_perguntas_tipo_check;

ALTER TABLE public.avaliacao_perguntas
ADD CONSTRAINT avaliacao_perguntas_tipo_check
CHECK (tipo IN ('texto', 'texto_longo', 'nota', 'nota_justificativa', 'participante_destaque', 'sim_nao', 'multipla_escolha'));
