-- O grupo foi criado exclusivamente para a demonstração da verificação OAuth.
-- A exclusão remove seus vínculos em grupo_permissoes e usuario_grupos por CASCADE,
-- sem alterar o cliente OAuth, a conta oficial do Drive ou as permissões permanentes.

DELETE FROM public.grupos
WHERE nome = 'Verificação Google';
