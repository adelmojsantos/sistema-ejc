ALTER TABLE public.permissoes
ADD COLUMN IF NOT EXISTS nome text;

INSERT INTO public.permissoes (chave, nome, descricao)
VALUES (
  'modulo_ligacao',
  'Acesso à Ligação',
  'Permite acessar a listagem operacional de participantes e encontreiros para entrega de correspondências.'
)
ON CONFLICT (chave) DO UPDATE
SET nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao;

INSERT INTO public.grupos (nome, descricao)
VALUES (
  'Equipe Ligação',
  'Acesso ao módulo Ligação para localizar participantes e encontreiros durante o encontro.'
)
ON CONFLICT (nome) DO UPDATE
SET descricao = EXCLUDED.descricao;

INSERT INTO public.grupo_permissoes (grupo_id, permissao_id)
SELECT g.id, p.id
FROM public.grupos g
JOIN public.permissoes p
  ON p.chave IN ('modulo_dashboard', 'modulo_ligacao')
WHERE g.nome = 'Equipe Ligação'
ON CONFLICT DO NOTHING;

INSERT INTO public.grupo_permissoes (grupo_id, permissao_id)
SELECT g.id, p.id
FROM public.grupos g
JOIN public.permissoes p ON p.chave = 'modulo_ligacao'
WHERE g.nome = 'Administrador'
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
