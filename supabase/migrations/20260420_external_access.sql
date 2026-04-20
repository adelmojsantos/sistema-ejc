-- Migration: External Form Access
-- Date: 2026-04-20

-- 1. Add formulario_publico_ativo to encontros
ALTER TABLE public.encontros 
ADD COLUMN IF NOT EXISTS formulario_publico_ativo BOOLEAN DEFAULT false;

-- 2. Create external_sessions table
CREATE TABLE IF NOT EXISTS public.external_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participacao_id UUID NOT NULL REFERENCES public.participacoes(id) ON DELETE CASCADE,
    encontro_id UUID NOT NULL REFERENCES public.encontros(id) ON DELETE CASCADE,
    token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create indices for performance
CREATE INDEX IF NOT EXISTS idx_participacoes_lookup ON public.participacoes (encontro_id, equipe_id);
CREATE INDEX IF NOT EXISTS idx_pessoas_nascimento ON public.pessoas (data_nascimento);
CREATE INDEX IF NOT EXISTS idx_pessoas_telefone ON public.pessoas USING btree (telefone);
CREATE INDEX IF NOT EXISTS idx_external_sessions_token ON public.external_sessions (token);
CREATE INDEX IF NOT EXISTS idx_external_sessions_expires ON public.external_sessions (expires_at);

-- 4. Enable RLS on external_sessions
ALTER TABLE public.external_sessions ENABLE ROW LEVEL SECURITY;

-- Allow public to select their own session by token (needed for validation)
DROP POLICY IF EXISTS "Allow public select by token" ON public.external_sessions;
CREATE POLICY "Allow public select by token" 
ON public.external_sessions FOR SELECT 
TO public 
USING (expires_at > now());

-- 5. Rate limiting table
CREATE TABLE IF NOT EXISTS public.external_access_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT,
    last_attempt TIMESTAMPTZ DEFAULT now(),
    attempts_count INTEGER DEFAULT 1
);

-- 6. RPC: validate_external_access
CREATE OR REPLACE FUNCTION public.validate_external_access(
    p_encontro_id UUID,
    p_equipe_id UUID,
    p_nome TEXT,
    p_data_nascimento DATE,
    p_telefone_fim TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_participacao_id UUID;
    v_token UUID;
    v_is_active BOOLEAN;
BEGIN
    -- Check if form is active
    SELECT formulario_publico_ativo INTO v_is_active 
    FROM public.encontros 
    WHERE id = p_encontro_id;

    IF v_is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'Formulário não está ativo para este encontro.';
    END IF;

    -- Search for the participant
    -- We normalize the name (lower case) and check the last 4 digits of the phone
    -- phone stored in DB might have symbols, so we strip them
    SELECT pa.id INTO v_participacao_id
    FROM public.participacoes pa
    JOIN public.pessoas p ON p.id = pa.pessoa_id
    WHERE pa.encontro_id = p_encontro_id
      AND pa.equipe_id = p_equipe_id
      AND unaccent(p.nome_completo) ILIKE '%' || unaccent(trim(p_nome)) || '%'
      AND p.data_nascimento = p_data_nascimento
      AND right(regexp_replace(p.telefone, '\D', '', 'g'), 4) = p_telefone_fim
    LIMIT 1;

    IF v_participacao_id IS NULL THEN
        RAISE EXCEPTION 'Não foi possível validar seus dados.';
    END IF;

    -- Create session
    INSERT INTO public.external_sessions (
        participacao_id,
        encontro_id,
        expires_at
    ) VALUES (
        v_participacao_id,
        p_encontro_id,
        now() + interval '2 hours'
    )
    RETURNING token INTO v_token;

    RETURN v_token;
EXCEPTION
    WHEN OTHERS THEN
        -- Re-raise with generic message to avoid detail leakage
        -- if it's not our custom active check
        IF SQLERRM = 'Formulário não está ativo para este encontro.' THEN
            RAISE EXCEPTION '%', SQLERRM;
        ELSE
            RAISE EXCEPTION 'Não foi possível validar seus dados.';
        END IF;
END;
$$;

-- Note: 'unaccent' extension might need to be enabled
CREATE EXTENSION IF NOT EXISTS unaccent;
