ALTER TABLE public.permissoes
ADD COLUMN IF NOT EXISTS nome text;

INSERT INTO public.permissoes (chave, nome, descricao)
VALUES
  (
    'modulo_cuidados',
    'Acesso aos Cuidados',
    'Permite acessar o módulo Cuidados com restrições alimentares e observações de saúde.'
  )
ON CONFLICT (chave) DO UPDATE
SET nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao;

DELETE FROM public.grupo_permissoes gp
USING public.permissoes p
WHERE gp.permissao_id = p.id
  AND p.chave IN ('cuidados_alimentacao', 'cuidados_saude');

DELETE FROM public.permissoes
WHERE chave IN ('cuidados_alimentacao', 'cuidados_saude');

INSERT INTO public.grupos (nome, descricao)
VALUES
  ('Equipe Cozinha', 'Acesso ao módulo Cuidados para apoiar alimentação e saúde dos encontristas.'),
  ('Equipe Boa Vontade', 'Acesso ao módulo Cuidados para apoiar alimentação e saúde dos encontristas.')
ON CONFLICT (nome) DO UPDATE
SET descricao = EXCLUDED.descricao;

INSERT INTO public.grupo_permissoes (grupo_id, permissao_id)
SELECT g.id, p.id
FROM public.grupos g
JOIN public.permissoes p
  ON p.chave IN ('modulo_dashboard', 'modulo_cuidados')
WHERE g.nome = 'Equipe Cozinha'
ON CONFLICT DO NOTHING;

INSERT INTO public.grupo_permissoes (grupo_id, permissao_id)
SELECT g.id, p.id
FROM public.grupos g
JOIN public.permissoes p
  ON p.chave IN ('modulo_dashboard', 'modulo_cuidados')
WHERE g.nome = 'Equipe Boa Vontade'
ON CONFLICT DO NOTHING;

INSERT INTO public.grupo_permissoes (grupo_id, permissao_id)
SELECT g.id, p.id
FROM public.grupos g
JOIN public.permissoes p
  ON p.chave IN ('modulo_cuidados')
WHERE g.nome = 'Administrador'
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
