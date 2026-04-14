import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnosePublicAccess() {
    console.log("--- DIAGNOSING PUBLIC ACCESS ---");
    
    // 1. Can anon see encontros?
    const { data: encontros, error: encError } = await supabase
        .from('encontros')
        .select('*')
        .eq('ativo', true);

    if (encError) {
        console.error("Error fetching encontros as anon:", encError.message);
    } else {
        console.log(`Found ${encontros?.length || 0} active encounter(s) as anon.`);
        if (encontros && encontros.length > 0) {
            console.log(`Encontro: ${encontros[0].nome}, Limite: ${encontros[0].limite_vagas_online}`);
        }
    }

    // 2. Can anon call the RPC?
    if (encontros && encontros.length > 0) {
        const { data: count, error: rpcError } = await supabase
            .rpc('get_public_waitlist_count', { p_encontro_id: encontros[0].id });

        if (rpcError) {
            console.error("Error calling RPC as anon:", rpcError.message);
        } else {
            console.log(`RPC result (count) as anon: ${count}`);
        }
    }
}

diagnosePublicAccess();
