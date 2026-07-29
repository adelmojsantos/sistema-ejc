import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

/**
 * LGPD Art. 46 — Segurança dos dados.
 * Links de convite e recuperação do Supabase precisam ser processados pelo
 * cliente. A página de redefinição remove os parâmetros sensíveis da URL logo
 * após a sessão ser reconhecida.
 */
export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: true,
        detectSessionInUrl: true,
        autoRefreshToken: true,
    },
});
