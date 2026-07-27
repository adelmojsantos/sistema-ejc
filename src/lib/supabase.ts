import { createClient } from '@supabase/supabase-js';

const normalizeRequiredEnv = (value: unknown, name: string, removeWhitespace = false) => {
    const normalized = String(value ?? '').trim();
    const cleanValue = removeWhitespace ? normalized.replace(/\s/g, '') : normalized;

    if (!cleanValue) {
        throw new Error(`Variável de ambiente ausente: ${name}`);
    }

    return cleanValue;
};

const supabaseUrl = normalizeRequiredEnv(import.meta.env.VITE_SUPABASE_URL, 'VITE_SUPABASE_URL');
const supabasePublishableKey = normalizeRequiredEnv(
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_KEY,
    'VITE_SUPABASE_PUBLISHABLE_KEY ou VITE_SUPABASE_KEY',
    true
);

/**
 * LGPD Art. 46 — Segurança dos dados.
 * detectSessionInUrl: false → impede que tokens JWT apareçam em URLs
 *   (e portanto em logs de servidor / histórico do navegador).
 */
export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
        persistSession: true,
        detectSessionInUrl: false,
        autoRefreshToken: true,
    },
});
