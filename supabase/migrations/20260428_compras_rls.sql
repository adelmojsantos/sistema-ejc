-- Habilitar RLS nas tabelas do módulo de compras
ALTER TABLE camiseta_modelos ENABLE ROW LEVEL SECURITY;
ALTER TABLE camiseta_tamanhos ENABLE ROW LEVEL SECURITY;
ALTER TABLE camiseta_pedidos ENABLE ROW LEVEL SECURITY;

-- 1. Políticas para camiseta_modelos
-- Qualquer usuário autenticado pode ver os modelos
CREATE POLICY "Permitir leitura de modelos para usuários autenticados" 
ON camiseta_modelos FOR SELECT 
TO authenticated 
USING (true);

-- Apenas admins podem inserir/editar modelos
CREATE POLICY "Permitir gestão de modelos para admins" 
ON camiseta_modelos FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM usuarios 
    WHERE id = auth.uid() 
    AND (perfil = 'admin' OR permissions @> '["modulo_admin"]')
  )
);

-- 2. Políticas para camiseta_tamanhos
-- Qualquer usuário autenticado pode ver os tamanhos
CREATE POLICY "Permitir leitura de tamanhos para usuários autenticados" 
ON camiseta_tamanhos FOR SELECT 
TO authenticated 
USING (true);

-- Apenas admins podem gerenciar tamanhos
CREATE POLICY "Permitir gestão de tamanhos para admins" 
ON camiseta_tamanhos FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM usuarios 
    WHERE id = auth.uid() 
    AND (perfil = 'admin' OR permissions @> '["modulo_admin"]')
  )
);

-- 3. Políticas para camiseta_pedidos
-- Qualquer usuário autenticado pode ver os pedidos (para os relatórios)
CREATE POLICY "Permitir leitura de pedidos para usuários autenticados" 
ON camiseta_pedidos FOR SELECT 
TO authenticated 
USING (true);

-- Usuários com permissão de compras ou admin podem gerenciar pedidos
CREATE POLICY "Permitir gestão de pedidos para autorizados" 
ON camiseta_pedidos FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM usuarios 
    WHERE id = auth.uid() 
    AND (perfil = 'admin' OR permissions @> '["modulo_admin"]' OR permissions @> '["modulo_compras"]')
  )
);
