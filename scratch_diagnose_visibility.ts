import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    console.log("--- DIAGNOSING lista_espera RECORDS ---");
    
    // 1. Get active encounter
    const { data: encontros } = await supabase.from('encontros').select('*').eq('ativo', true);
    if (!encontros || encontros.length === 0) {
        console.log("No active encounter found!");
        return;
    }
    const active = encontros[0];
    console.log(`Active Encounter: ${active.nome} (ID: ${active.id})`);

    // 2. Query ALL records for this encounter
    const { data: entries, error } = await supabase
        .from('lista_espera')
        .select('*')
        .eq('encontro_id', active.id);

    if (error) {
        console.error("Error fetching entries:", error);
        return;
    }

    console.log(`Found ${entries.length} total records for this encounter.`);
    
    if (entries.length > 0) {
        entries.forEach((e, i) => {
            console.log(`[${i+1}] Name: ${e.nome_completo}, Status: ${e.status}, Origin: ${e.origem}, Created: ${e.created_at}`);
        });
    } else {
        // Double check if there are ANY records in the table at all
        const { count } = await supabase.from('lista_espera').select('*', { count: 'exact', head: true });
        console.log(`Total records in table across ALL encounters: ${count}`);
    }
}

diagnose();
