-- Fix: Allow anonymous (external form) access to recepcao_dados
-- The external form runs as anon (no authenticated session) but needs
-- to SELECT, INSERT, UPDATE and DELETE recepcao_dados for its own participacao_id.

-- SELECT (load existing data)
DROP POLICY IF EXISTS "Allow anon to select their recepcao_dados" ON public.recepcao_dados;
CREATE POLICY "Allow anon to select their recepcao_dados"
ON public.recepcao_dados FOR SELECT
TO anon
USING (
    participacao_id IN (
        SELECT es.participacao_id
        FROM public.external_sessions es
        WHERE es.expires_at > now()
    )
);

-- INSERT (save for the first time)
DROP POLICY IF EXISTS "Allow anon to insert their recepcao_dados" ON public.recepcao_dados;
CREATE POLICY "Allow anon to insert their recepcao_dados"
ON public.recepcao_dados FOR INSERT
TO anon
WITH CHECK (
    participacao_id IN (
        SELECT es.participacao_id
        FROM public.external_sessions es
        WHERE es.expires_at > now()
    )
);

-- UPDATE (edit after first save)
DROP POLICY IF EXISTS "Allow anon to update their recepcao_dados" ON public.recepcao_dados;
CREATE POLICY "Allow anon to update their recepcao_dados"
ON public.recepcao_dados FOR UPDATE
TO anon
USING (
    participacao_id IN (
        SELECT es.participacao_id
        FROM public.external_sessions es
        WHERE es.expires_at > now()
    )
)
WITH CHECK (
    participacao_id IN (
        SELECT es.participacao_id
        FROM public.external_sessions es
        WHERE es.expires_at > now()
    )
);

-- DELETE (remove vehicle)
DROP POLICY IF EXISTS "Allow anon to delete their recepcao_dados" ON public.recepcao_dados;
CREATE POLICY "Allow anon to delete their recepcao_dados"
ON public.recepcao_dados FOR DELETE
TO anon
USING (
    participacao_id IN (
        SELECT es.participacao_id
        FROM public.external_sessions es
        WHERE es.expires_at > now()
    )
);
