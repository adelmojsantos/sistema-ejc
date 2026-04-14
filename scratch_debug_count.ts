import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugCount() {
    console.log("--- DEBUGGING REGISTRATION COUNT ---");
    
    // 1. Get active encounter
    const { data: encontros } = await supabase.from('encontros').select('*').eq('ativo', true);
    if (!encontros || encontros.length === 0) {
        console.log("No active encounter found!");
        return;
    }
    const active = encontros[0];
    console.log(`Active Encounter: ${active.nome} (ID: ${active.id})`);
    console.log(`Limit: ${active.limite_vagas_online}`);

    // 2. Count on lista_espera with detailed origins
    const { data: entries, error } = await supabase
        .from('lista_espera')
        .select('id, origem, status')
        .eq('encontro_id', active.id);

    if (error) {
        console.error("Error fetching entries:", error);
        return;
    }

    console.log(`Total entries for this encounter: ${entries.length}`);
    
    const origins = entries.reduce((acc: any, curr) => {
        acc[curr.origem] = (acc[curr.origem] || 0) + 1;
        return acc;
    }, {});
    
    console.log("Entries by origin:", origins);

    // 3. Current count logic used by the page
    const { count } = await supabase
        .from('lista_espera')
        .select('*', { count: 'exact', head: true })
        .eq('encontro_id', active.id)
        .eq('origem', 'online');

    console.log(`Count that the page is seeing (origem=online): ${count}`);
    
    if (count < active.limite_vagas_online) {
        console.log("RESULT: FORM IS OPEN");
    } else {
        console.log("RESULT: FORM IS FULL/CLOSED");
    }
}

debugCount();
