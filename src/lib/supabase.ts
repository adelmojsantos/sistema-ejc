import { createClient } from '@supabase/supabase-js';

function normalizeEnvValue(value: unknown) {
    if (typeof value !== 'string') return '';
    return value.trim().replace(/^(["'])(.*)\1$/, '$2').trim();
}

const supabaseUrl = normalizeEnvValue(import.meta.env.VITE_SUPABASE_URL);
const supabaseKey = normalizeEnvValue(import.meta.env.VITE_SUPABASE_KEY);

try {
    const parsedUrl = new URL(supabaseUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('protocolo inválido');
} catch {
    throw new Error('Configuração inválida: VITE_SUPABASE_URL deve ser uma URL HTTPS válida.');
}

if (!supabaseKey) {
    throw new Error('Configuração inválida: VITE_SUPABASE_KEY não foi definida.');
}

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
