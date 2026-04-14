import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectColumns() {
    console.log("--- INSPECTING lista_espera COLUMNS ---");
    const { data, error } = await supabase
        .from('lista_espera')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error fetching data:", error);
    } else if (data && data.length > 0) {
        console.log("Columns found:", Object.keys(data[0]));
    } else {
        console.log("No data found to inspect columns.");
        // Try another way: maybe a specialized query if we have permissions, but we probably don't.
    }
}

inspectColumns();
