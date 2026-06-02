CREATE TABLE IF NOT EXISTS public.dirigencias (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    status text NOT NULL CHECK (status IN ('indicacao', 'ativa', 'encerrada')),
    data_inicio date,
    data_fim date,
    indicacoes_finalizadas_em timestamptz,
    ativada_em timestamptz,
    encerrada_em timestamptz,
    created_by uuid REFERENCES public.profiles(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS dirigencias_unica_ativa_idx
ON public.dirigencias (status)
WHERE status = 'ativa';

CREATE UNIQUE INDEX IF NOT EXISTS dirigencias_unica_em_indicacao_idx
ON public.dirigencias (status)
WHERE status = 'indicacao';

DROP TRIGGER IF EXISTS dirigencias_set_updated_at ON public.dirigencias;
CREATE TRIGGER dirigencias_set_updated_at
BEFORE UPDATE ON public.dirigencias
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.dirigencia_membros (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dirigencia_id uuid NOT NULL REFERENCES public.dirigencias(id) ON DELETE CASCADE,
    pessoa_id uuid NOT NULL REFERENCES public.pessoas(id),
    ativo boolean NOT NULL DEFAULT true,
    entrou_em timestamptz NOT NULL DEFAULT now(),
    saiu_em timestamptz,
    motivo_saida text,
    created_by uuid REFERENCES public.profiles(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (dirigencia_id, pessoa_id)
);

CREATE TABLE IF NOT EXISTS public.dirigencia_indicacoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dirigencia_origem_id uuid NOT NULL REFERENCES public.dirigencias(id),
    dirigencia_destino_id uuid NOT NULL REFERENCES public.dirigencias(id) ON DELETE CASCADE,
    indicador_membro_id uuid REFERENCES public.dirigencia_membros(id),
    indicado_pessoa_id uuid NOT NULL REFERENCES public.pessoas(id),
    tipo text NOT NULL DEFAULT 'regular' CHECK (tipo IN ('regular', 'adicional')),
    motivo text,
    status text NOT NULL DEFAULT 'indicada' CHECK (status IN ('indicada', 'selecionada', 'descartada')),
    created_by uuid REFERENCES public.profiles(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (tipo = 'adicional' OR indicador_membro_id IS NOT NULL),
    UNIQUE (dirigencia_destino_id, indicado_pessoa_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS dirigencia_indicacoes_regular_por_dirigente_idx
ON public.dirigencia_indicacoes (dirigencia_destino_id, indicador_membro_id)
WHERE tipo = 'regular';

DROP TRIGGER IF EXISTS dirigencia_indicacoes_set_updated_at ON public.dirigencia_indicacoes;
CREATE TRIGGER dirigencia_indicacoes_set_updated_at
BEFORE UPDATE ON public.dirigencia_indicacoes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.dirigencia_eventos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dirigencia_id uuid NOT NULL REFERENCES public.dirigencias(id) ON DELETE CASCADE,
    tipo text NOT NULL,
    descricao text NOT NULL,
    executado_por uuid REFERENCES public.profiles(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.encontros
ADD COLUMN IF NOT EXISTS dirigencia_id uuid REFERENCES public.dirigencias(id);

CREATE UNIQUE INDEX IF NOT EXISTS encontros_unico_ativo_idx
ON public.encontros (ativo)
WHERE ativo = true;

CREATE OR REPLACE FUNCTION public.vincular_dirigencia_ativa_ao_encontro()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.dirigencia_id IS NULL THEN
        SELECT id INTO NEW.dirigencia_id
          FROM public.dirigencias
         WHERE status = 'ativa';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS encontros_vincular_dirigencia_ativa ON public.encontros;
CREATE TRIGGER encontros_vincular_dirigencia_ativa
BEFORE INSERT ON public.encontros
FOR EACH ROW EXECUTE FUNCTION public.vincular_dirigencia_ativa_ao_encontro();

CREATE OR REPLACE FUNCTION public.is_dirigente_atual(check_user uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
          FROM public.profiles pr
          JOIN public.pessoas pe ON LOWER(pe.email) = LOWER(pr.email)
          JOIN public.dirigencia_membros dm ON dm.pessoa_id = pe.id
          JOIN public.dirigencias d ON d.id = dm.dirigencia_id
         WHERE pr.id = check_user
           AND dm.ativo = true
           AND d.status = 'ativa'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(check_user uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
          FROM public.profiles
         WHERE id = check_user
           AND role = 'admin'
    ) OR public.is_dirigente_atual(check_user);
$$;

CREATE OR REPLACE FUNCTION public.registrar_dirigencia_evento(
    p_dirigencia_id uuid,
    p_tipo text,
    p_descricao text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    INSERT INTO public.dirigencia_eventos (dirigencia_id, tipo, descricao, executado_por)
    VALUES (p_dirigencia_id, p_tipo, p_descricao, auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.criar_dirigencia(
    p_nome text,
    p_status text DEFAULT 'indicacao'
)
RETURNS public.dirigencias
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_dirigencia public.dirigencias;
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Somente administradores podem criar uma dirigência.';
    END IF;

    IF p_status NOT IN ('indicacao', 'ativa') THEN
        RAISE EXCEPTION 'Status inicial inválido.';
    END IF;

    INSERT INTO public.dirigencias (nome, status, ativada_em, created_by)
    VALUES (
        NULLIF(BTRIM(p_nome), ''),
        p_status,
        CASE WHEN p_status = 'ativa' THEN now() ELSE NULL END,
        auth.uid()
    )
    RETURNING * INTO v_dirigencia;

    PERFORM public.registrar_dirigencia_evento(
        v_dirigencia.id,
        'dirigencia_criada',
        CASE
            WHEN p_status = 'ativa' THEN 'Dirigência atual cadastrada.'
            ELSE 'Nova dirigência aberta para indicações.'
        END
    );

    RETURN v_dirigencia;
END;
$$;

CREATE OR REPLACE FUNCTION public.adicionar_membro_dirigencia(
    p_dirigencia_id uuid,
    p_pessoa_id uuid
)
RETURNS public.dirigencia_membros
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_membro public.dirigencia_membros;
    v_dirigencia public.dirigencias;
    v_usuario_id uuid;
    v_nome text;
    v_admin_grupo_id uuid := '00000000-0000-0000-0002-000000000001'::uuid;
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Somente administradores podem adicionar dirigentes.';
    END IF;

    SELECT * INTO v_dirigencia
      FROM public.dirigencias
     WHERE id = p_dirigencia_id;

    IF v_dirigencia.id IS NULL OR v_dirigencia.status = 'encerrada' THEN
        RAISE EXCEPTION 'A dirigência informada não aceita novos membros.';
    END IF;

    SELECT pe.nome_completo, pr.id
      INTO v_nome, v_usuario_id
      FROM public.pessoas pe
      LEFT JOIN public.profiles pr ON LOWER(pr.email) = LOWER(pe.email)
     WHERE pe.id = p_pessoa_id;

    IF v_nome IS NULL THEN
        RAISE EXCEPTION 'Pessoa não encontrada.';
    END IF;

    IF v_dirigencia.status = 'ativa' AND v_usuario_id IS NULL THEN
        RAISE EXCEPTION 'A pessoa precisa possuir uma conta de acesso antes de entrar na dirigência atual.';
    END IF;

    INSERT INTO public.dirigencia_membros (dirigencia_id, pessoa_id, ativo, entrou_em, created_by)
    VALUES (p_dirigencia_id, p_pessoa_id, true, now(), auth.uid())
    ON CONFLICT (dirigencia_id, pessoa_id)
    DO UPDATE SET ativo = true, entrou_em = now(), saiu_em = NULL, motivo_saida = NULL
    RETURNING * INTO v_membro;

    IF v_dirigencia.status = 'ativa' THEN
        INSERT INTO public.usuario_grupos (usuario_id, grupo_id, encontro_id)
        SELECT v_usuario_id, v_admin_grupo_id, NULL
         WHERE NOT EXISTS (
            SELECT 1
              FROM public.usuario_grupos
             WHERE usuario_id = v_usuario_id
               AND grupo_id = v_admin_grupo_id
               AND encontro_id IS NULL
         );

        UPDATE public.profiles SET role = 'admin' WHERE id = v_usuario_id;
    END IF;

    PERFORM public.registrar_dirigencia_evento(
        p_dirigencia_id,
        'membro_adicionado',
        FORMAT('%s foi adicionado(a) à dirigência.', v_nome)
    );

    RETURN v_membro;
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_saida_dirigente(
    p_membro_id uuid,
    p_motivo text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_membro public.dirigencia_membros;
    v_dirigencia public.dirigencias;
    v_usuario_id uuid;
    v_nome text;
    v_admin_grupo_id uuid := '00000000-0000-0000-0002-000000000001'::uuid;
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Somente administradores podem registrar a saída de dirigentes.';
    END IF;

    SELECT * INTO v_membro FROM public.dirigencia_membros WHERE id = p_membro_id;
    SELECT * INTO v_dirigencia FROM public.dirigencias WHERE id = v_membro.dirigencia_id;

    IF v_membro.id IS NULL OR NOT v_membro.ativo THEN
        RAISE EXCEPTION 'Membro ativo não encontrado.';
    END IF;

    IF v_dirigencia.status = 'ativa' AND (
        SELECT COUNT(*) FROM public.dirigencia_membros
         WHERE dirigencia_id = v_dirigencia.id AND ativo = true
    ) <= 1 THEN
        RAISE EXCEPTION 'Não é possível remover o último dirigente ativo.';
    END IF;

    SELECT pe.nome_completo, pr.id
      INTO v_nome, v_usuario_id
      FROM public.pessoas pe
      LEFT JOIN public.profiles pr ON LOWER(pr.email) = LOWER(pe.email)
     WHERE pe.id = v_membro.pessoa_id;

    UPDATE public.dirigencia_membros
       SET ativo = false, saiu_em = now(), motivo_saida = NULLIF(BTRIM(p_motivo), '')
     WHERE id = p_membro_id;

    IF v_dirigencia.status = 'ativa' AND v_usuario_id IS NOT NULL THEN
        DELETE FROM public.usuario_grupos
         WHERE usuario_id = v_usuario_id
           AND grupo_id = v_admin_grupo_id
           AND encontro_id IS NULL;

        UPDATE public.profiles
           SET role = 'viewer'
         WHERE id = v_usuario_id
           AND NOT public.is_dirigente_atual(v_usuario_id);
    END IF;

    PERFORM public.registrar_dirigencia_evento(
        v_dirigencia.id,
        'membro_removido',
        FORMAT('%s deixou a dirigência.%s', v_nome, CASE WHEN p_motivo IS NULL THEN '' ELSE ' Motivo: ' || p_motivo END)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.adicionar_indicacao_dirigencia(
    p_dirigencia_destino_id uuid,
    p_indicador_membro_id uuid,
    p_indicado_pessoa_id uuid,
    p_tipo text DEFAULT 'regular',
    p_motivo text DEFAULT NULL
)
RETURNS public.dirigencia_indicacoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_destino public.dirigencias;
    v_origem_id uuid;
    v_indicacao public.dirigencia_indicacoes;
    v_indicado_nome text;
    v_indicador_nome text;
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Somente administradores podem registrar indicações.';
    END IF;

    SELECT * INTO v_destino FROM public.dirigencias WHERE id = p_dirigencia_destino_id;
    SELECT id INTO v_origem_id FROM public.dirigencias WHERE status = 'ativa';

    IF v_destino.id IS NULL OR v_destino.status <> 'indicacao' OR v_destino.indicacoes_finalizadas_em IS NOT NULL THEN
        RAISE EXCEPTION 'As indicações desta dirigência não estão abertas.';
    END IF;

    IF v_origem_id IS NULL THEN
        RAISE EXCEPTION 'Cadastre a dirigência atual antes de registrar sucessores.';
    END IF;

    IF p_tipo NOT IN ('regular', 'adicional') THEN
        RAISE EXCEPTION 'Tipo de indicação inválido.';
    END IF;

    IF p_tipo = 'regular' AND NOT EXISTS (
        SELECT 1
          FROM public.dirigencia_membros
         WHERE id = p_indicador_membro_id
           AND dirigencia_id = v_origem_id
           AND ativo = true
    ) THEN
        RAISE EXCEPTION 'O responsável pela indicação deve ser um dirigente atual.';
    END IF;

    INSERT INTO public.dirigencia_indicacoes (
        dirigencia_origem_id,
        dirigencia_destino_id,
        indicador_membro_id,
        indicado_pessoa_id,
        tipo,
        motivo,
        created_by
    )
    VALUES (
        v_origem_id,
        p_dirigencia_destino_id,
        p_indicador_membro_id,
        p_indicado_pessoa_id,
        p_tipo,
        NULLIF(BTRIM(p_motivo), ''),
        auth.uid()
    )
    RETURNING * INTO v_indicacao;

    SELECT nome_completo INTO v_indicado_nome FROM public.pessoas WHERE id = p_indicado_pessoa_id;
    IF p_tipo = 'regular' THEN
        SELECT pe.nome_completo INTO v_indicador_nome
          FROM public.dirigencia_membros dm
          JOIN public.pessoas pe ON pe.id = dm.pessoa_id
         WHERE dm.id = p_indicador_membro_id;
    END IF;

    PERFORM public.registrar_dirigencia_evento(
        p_dirigencia_destino_id,
        CASE WHEN p_tipo = 'adicional' THEN 'indicacao_adicional' ELSE 'indicacao' END,
        CASE
            WHEN p_tipo = 'adicional' THEN FORMAT('%s foi incluído(a) como indicação adicional por consenso.', v_indicado_nome)
            ELSE FORMAT('%s indicou %s.', v_indicador_nome, v_indicado_nome)
        END
    );

    RETURN v_indicacao;
END;
$$;

CREATE OR REPLACE FUNCTION public.atualizar_status_indicacao_dirigencia(
    p_indicacao_id uuid,
    p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_dirigencia_id uuid;
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Somente administradores podem selecionar sucessores.';
    END IF;

    IF p_status NOT IN ('indicada', 'selecionada', 'descartada') THEN
        RAISE EXCEPTION 'Status de indicação inválido.';
    END IF;

    SELECT dirigencia_destino_id INTO v_dirigencia_id
      FROM public.dirigencia_indicacoes
     WHERE id = p_indicacao_id;

    IF NOT EXISTS (
        SELECT 1 FROM public.dirigencias
         WHERE id = v_dirigencia_id
           AND status = 'indicacao'
           AND indicacoes_finalizadas_em IS NULL
    ) THEN
        RAISE EXCEPTION 'As indicações desta dirigência não estão abertas.';
    END IF;

    UPDATE public.dirigencia_indicacoes SET status = p_status WHERE id = p_indicacao_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalizar_indicacoes_dirigencia(p_dirigencia_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Somente administradores podem finalizar indicações.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.dirigencias WHERE id = p_dirigencia_id AND status = 'indicacao'
    ) THEN
        RAISE EXCEPTION 'Dirigência em indicação não encontrada.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.dirigencia_indicacoes
         WHERE dirigencia_destino_id = p_dirigencia_id AND status = 'selecionada'
    ) THEN
        RAISE EXCEPTION 'Selecione ao menos uma pessoa para a nova dirigência.';
    END IF;

    UPDATE public.dirigencias SET indicacoes_finalizadas_em = now() WHERE id = p_dirigencia_id;
    PERFORM public.registrar_dirigencia_evento(p_dirigencia_id, 'indicacoes_finalizadas', 'As indicações foram finalizadas para conferência.');
END;
$$;

CREATE OR REPLACE FUNCTION public.reabrir_indicacoes_dirigencia(p_dirigencia_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Somente administradores podem reabrir indicações.';
    END IF;

    UPDATE public.dirigencias
       SET indicacoes_finalizadas_em = NULL
     WHERE id = p_dirigencia_id
       AND status = 'indicacao';

    PERFORM public.registrar_dirigencia_evento(p_dirigencia_id, 'indicacoes_reabertas', 'As indicações foram reabertas para ajustes.');
END;
$$;

CREATE OR REPLACE FUNCTION public.ativar_nova_dirigencia(p_dirigencia_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_atual_id uuid;
    v_admin_grupo_id uuid := '00000000-0000-0000-0002-000000000001'::uuid;
    v_sem_acesso text;
BEGIN
    IF NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Somente administradores podem ativar a nova dirigência.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.dirigencias
         WHERE id = p_dirigencia_id
           AND status = 'indicacao'
           AND indicacoes_finalizadas_em IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Finalize as indicações antes de ativar a nova dirigência.';
    END IF;

    SELECT STRING_AGG(pe.nome_completo, ', ' ORDER BY pe.nome_completo)
      INTO v_sem_acesso
      FROM public.dirigencia_indicacoes di
      JOIN public.pessoas pe ON pe.id = di.indicado_pessoa_id
      LEFT JOIN public.profiles pr ON LOWER(pr.email) = LOWER(pe.email)
     WHERE di.dirigencia_destino_id = p_dirigencia_id
       AND di.status = 'selecionada'
       AND pr.id IS NULL;

    IF v_sem_acesso IS NOT NULL THEN
        RAISE EXCEPTION 'Crie uma conta de acesso antes de ativar a nova dirigência para: %', v_sem_acesso;
    END IF;

    SELECT id INTO v_atual_id FROM public.dirigencias WHERE status = 'ativa';

    INSERT INTO public.dirigencia_membros (dirigencia_id, pessoa_id, ativo, entrou_em, created_by)
    SELECT p_dirigencia_id, indicado_pessoa_id, true, now(), auth.uid()
      FROM public.dirigencia_indicacoes
     WHERE dirigencia_destino_id = p_dirigencia_id
       AND status = 'selecionada'
    ON CONFLICT (dirigencia_id, pessoa_id)
    DO UPDATE SET ativo = true, entrou_em = now(), saiu_em = NULL, motivo_saida = NULL;

    IF v_atual_id IS NOT NULL THEN
        UPDATE public.dirigencias
           SET status = 'encerrada', encerrada_em = now()
         WHERE id = v_atual_id;

        DELETE FROM public.usuario_grupos ug
         USING public.dirigencia_membros dm
         JOIN public.pessoas pe ON pe.id = dm.pessoa_id
         JOIN public.profiles pr ON LOWER(pr.email) = LOWER(pe.email)
         WHERE dm.dirigencia_id = v_atual_id
           AND ug.usuario_id = pr.id
           AND ug.grupo_id = v_admin_grupo_id
           AND ug.encontro_id IS NULL;

        UPDATE public.profiles pr
           SET role = 'viewer'
          FROM public.dirigencia_membros dm
          JOIN public.pessoas pe ON pe.id = dm.pessoa_id
         WHERE dm.dirigencia_id = v_atual_id
           AND LOWER(pr.email) = LOWER(pe.email);
    END IF;

    UPDATE public.dirigencias
       SET status = 'ativa', ativada_em = now(), encerrada_em = NULL
     WHERE id = p_dirigencia_id;

    INSERT INTO public.usuario_grupos (usuario_id, grupo_id, encontro_id)
    SELECT pr.id, v_admin_grupo_id, NULL
      FROM public.dirigencia_membros dm
      JOIN public.pessoas pe ON pe.id = dm.pessoa_id
      JOIN public.profiles pr ON LOWER(pr.email) = LOWER(pe.email)
     WHERE dm.dirigencia_id = p_dirigencia_id
       AND dm.ativo = true
       AND NOT EXISTS (
           SELECT 1 FROM public.usuario_grupos ug
            WHERE ug.usuario_id = pr.id
              AND ug.grupo_id = v_admin_grupo_id
              AND ug.encontro_id IS NULL
       );

    UPDATE public.profiles pr
       SET role = 'admin'
      FROM public.dirigencia_membros dm
      JOIN public.pessoas pe ON pe.id = dm.pessoa_id
     WHERE dm.dirigencia_id = p_dirigencia_id
       AND dm.ativo = true
       AND LOWER(pr.email) = LOWER(pe.email);

    PERFORM public.registrar_dirigencia_evento(p_dirigencia_id, 'dirigencia_ativada', 'A nova dirigência assumiu a administração do sistema.');
END;
$$;

ALTER TABLE public.dirigencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dirigencia_membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dirigencia_indicacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dirigencia_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_can_manage_dirigencias" ON public.dirigencias;
CREATE POLICY "admin_can_manage_dirigencias"
ON public.dirigencias FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_can_manage_dirigencia_membros" ON public.dirigencia_membros;
CREATE POLICY "admin_can_manage_dirigencia_membros"
ON public.dirigencia_membros FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_can_manage_dirigencia_indicacoes" ON public.dirigencia_indicacoes;
CREATE POLICY "admin_can_manage_dirigencia_indicacoes"
ON public.dirigencia_indicacoes FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_can_read_dirigencia_eventos" ON public.dirigencia_eventos;
CREATE POLICY "admin_can_read_dirigencia_eventos"
ON public.dirigencia_eventos FOR SELECT TO authenticated
USING (public.is_admin());

REVOKE ALL ON FUNCTION public.is_dirigente_atual(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_dirigencia_evento(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.criar_dirigencia(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adicionar_membro_dirigencia(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_saida_dirigente(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adicionar_indicacao_dirigencia(uuid, uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atualizar_status_indicacao_dirigencia(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalizar_indicacoes_dirigencia(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reabrir_indicacoes_dirigencia(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ativar_nova_dirigencia(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_dirigente_atual(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_dirigencia(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adicionar_membro_dirigencia(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_saida_dirigente(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adicionar_indicacao_dirigencia(uuid, uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_status_indicacao_dirigencia(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalizar_indicacoes_dirigencia(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reabrir_indicacoes_dirigencia(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ativar_nova_dirigencia(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
