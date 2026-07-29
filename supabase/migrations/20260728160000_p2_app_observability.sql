-- P2: privacy-conscious client error observability.
-- Remote logging is opt-in through VITE_ENABLE_REMOTE_ERROR_LOGS=true.

CREATE TABLE IF NOT EXISTS public.app_error_logs (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (char_length(source) BETWEEN 1 AND 80),
  route text NOT NULL CHECK (char_length(route) BETWEEN 1 AND 300),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 1800),
  stack text CHECK (stack IS NULL OR char_length(stack) <= 9000)
);

CREATE INDEX IF NOT EXISTS app_error_logs_created_at_idx
  ON public.app_error_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS app_error_logs_user_created_at_idx
  ON public.app_error_logs (user_id, created_at DESC);

ALTER TABLE public.app_error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_insert_own_app_errors"
  ON public.app_error_logs;
CREATE POLICY "authenticated_insert_own_app_errors"
ON public.app_error_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admins_read_app_errors"
  ON public.app_error_logs;
CREATE POLICY "admins_read_app_errors"
ON public.app_error_logs
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

REVOKE ALL ON TABLE public.app_error_logs FROM anon;
GRANT INSERT, SELECT ON TABLE public.app_error_logs TO authenticated;

NOTIFY pgrst, 'reload schema';
