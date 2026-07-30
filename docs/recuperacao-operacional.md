# Recuperação operacional

## Princípios

- O banco de produção não é ambiente de teste.
- Migration já publicada não deve ser editada; a correção é uma nova migration.
- Reversão de frontend usa uma versão anterior já validada.
- Mudanças de banco preferem correção para frente. Uma reversão destrutiva exige
  cópia verificada dos dados e validação fora de produção.
- Backup só é confiável depois de um teste de restauração.

## Antes de uma publicação de risco

- [ ] Confirmar CI aprovada.
- [ ] Executar `supabase db push --linked --dry-run`.
- [ ] Conferir se apenas as migrations esperadas aparecem.
- [ ] Verificar no painel do Supabase qual proteção de backup está disponível para
  o plano atual e quando ocorreu a última cópia.
- [ ] Exportar os dados críticos afetados quando a mudança transformar ou remover
  informações.
- [ ] Registrar a versão atual do frontend e as migrations que serão aplicadas.

O banco isolado da CI comprova que o esquema pode ser reconstruído pelas migrations,
mas não substitui um backup dos dados de produção.

## Incidente apenas no frontend

1. Confirmar o erro em Diagnósticos sem expor dados pessoais.
2. Restaurar na Vercel a última versão aprovada.
3. Validar login, rota afetada e uma rota pública no celular.
4. Corrigir em uma nova versão e executar toda a CI.

## Incidente após migration

1. Interromper novas operações no módulo afetado.
2. Não apagar a migration nem alterar o histórico remoto.
3. Identificar tabelas, funções, políticas e dados afetados.
4. Criar uma migration corretiva idempotente.
5. Validar a correção no banco isolado da CI.
6. Conferir o `dry-run` vinculado e aplicar somente a migration corretiva.
7. Executar o roteiro manual do módulo.

Se houver perda ou corrupção de dados, não improvisar comandos em produção. Preservar
o estado atual, identificar a cópia recuperável e testar a restauração em ambiente
separado antes de qualquer substituição.

## Incidente de autorização

1. Remover temporariamente do usuário o grupo ou permissão que amplia o acesso.
2. Preservar registros de auditoria e Diagnósticos.
3. Reproduzir o caso com um usuário descartável no banco isolado.
4. Corrigir frontend e backend juntos.
5. Adicionar um teste que prove o acesso permitido e o acesso negado.

## Evidências mínimas

- commit e execução da CI;
- saída do `db push --linked --dry-run`;
- migration aplicada;
- contagens ou consultas de integridade antes e depois;
- responsável e horário da homologação.
