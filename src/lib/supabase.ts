import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_KEY;

/**
 * LGPD Art. 46 — Segurança dos dados.
 * detectSessionInUrl: false → impede que tokens JWT apareçam em URLs
 *   (e portanto em logs de servidor / histórico do navegador).
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        detectSessionInUrl: false,
        autoRefreshToken: true,
    },
});
