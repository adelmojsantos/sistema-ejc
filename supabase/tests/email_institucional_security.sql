BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(11);

INSERT INTO auth.users (
  id, email, aud, role, encrypted_password, email_confirmed_at,
  created_at, updated_at, is_sso_user, is_anonymous
)
VALUES
  ('1e000000-0000-0000-0000-000000000001', 'email.sem.acesso@example.test', 'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')), now(), now(), now(), false, false),
  ('1e000000-0000-0000-0000-000000000002', 'email.visualizador@example.test', 'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')), now(), now(), now(), false, false),
  ('1e000000-0000-0000-0000-000000000003', 'email.operador@example.test', 'authenticated', 'authenticated', crypt('fixture-password', gen_salt('bf')), now(), now(), now(), false, false);

INSERT INTO public.grupos (id, nome, descricao)
VALUES
  ('2e000000-0000-0000-0000-000000000001', 'Leitores de e-mail - teste', 'Fixture'),
  ('2e000000-0000-0000-0000-000000000002', 'Operadores de e-mail - teste', 'Fixture');

INSERT INTO public.grupo_permissoes (grupo_id, permissao_id)
SELECT '2e000000-0000-0000-0000-000000000001', id
FROM public.permissoes WHERE chave = 'modulo_email_institucional';

INSERT INTO public.grupo_permissoes (grupo_id, permissao_id)
SELECT '2e000000-0000-0000-0000-000000000002', id
FROM public.permissoes WHERE chave IN ('modulo_email_institucional', 'email_institucional_responder');

INSERT INTO public.usuario_grupos (usuario_id, grupo_id)
VALUES
  ('1e000000-0000-0000-0000-000000000002', '2e000000-0000-0000-0000-000000000001'),
  ('1e000000-0000-0000-0000-000000000003', '2e000000-0000-0000-0000-000000000002');

INSERT INTO public.email_institucional_conversas (
  id, assunto, contato_email, status
)
VALUES (
  '3e000000-0000-0000-0000-000000000001',
  'Conversa de teste',
  'remetente@example.test',
  'novo'
);

INSERT INTO public.email_institucional_mensagens (
  id, conversa_id, direcao, remetente_email, destinatarios, assunto, previa, recebida_em
)
VALUES (
  '4e000000-0000-0000-0000-000000000001',
  '3e000000-0000-0000-0000-000000000001',
  'entrada',
  'remetente@example.test',
  ARRAY['contato@ejccapelinha.com.br'],
  'Conversa de teste',
  'Conteúdo de teste',
  now()
);

INSERT INTO public.email_institucional_anexos (
  id, mensagem_id, nome, mime_type, tamanho_bytes, r2_key
)
VALUES (
  '5e000000-0000-0000-0000-000000000001',
  '4e000000-0000-0000-0000-000000000001',
  'anexo.txt',
  'text/plain',
  10,
  'emails/teste/anexo.txt'
);

SELECT set_config('request.jwt.claim.sub', '1e000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;
SELECT extensions.ok(NOT public.pode_visualizar_email_institucional(), 'usuário comum não visualiza a caixa');
SELECT extensions.is((SELECT count(*) FROM public.email_institucional_conversas), 0::bigint, 'RLS oculta conversas do usuário sem acesso');
SELECT extensions.throws_ok(
  $$SELECT public.marcar_email_institucional_como_lido('3e000000-0000-0000-0000-000000000001')$$,
  '42501', 'Acesso não autorizado.', 'usuário sem acesso não marca leitura'
);
SELECT extensions.throws_ok(
  $$SELECT public.contar_email_institucional_novas()$$,
  '42501', 'Acesso não autorizado.', 'usuário sem acesso não consulta o contador'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '1e000000-0000-0000-0000-000000000002', true);
SET LOCAL ROLE authenticated;
SELECT extensions.ok(public.pode_visualizar_email_institucional(), 'leitor autorizado visualiza a caixa');
SELECT extensions.ok(NOT public.pode_responder_email_institucional(), 'leitor não recebe permissão de resposta implicitamente');
SELECT extensions.is(
  public.contar_email_institucional_novas(),
  1::bigint,
  'leitor autorizado recebe a quantidade de conversas novas'
);
SELECT extensions.lives_ok(
  $$SELECT public.marcar_email_institucional_como_lido('3e000000-0000-0000-0000-000000000001')$$,
  'leitor autorizado marca a conversa como lida'
);
SELECT extensions.lives_ok(
  $$SELECT public.registrar_download_email_institucional('5e000000-0000-0000-0000-000000000001')$$,
  'download autorizado é registrado na auditoria'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '1e000000-0000-0000-0000-000000000003', true);
SET LOCAL ROLE authenticated;
SELECT extensions.ok(public.pode_responder_email_institucional(), 'operador autorizado pode responder');
SELECT extensions.lives_ok(
  $$SELECT public.atualizar_atendimento_email_institucional('3e000000-0000-0000-0000-000000000001', 'em_atendimento', auth.uid(), true)$$,
  'operador autorizado assume o atendimento'
);

RESET ROLE;
SELECT * FROM extensions.finish();
ROLLBACK;
