import { supabase } from '../lib/supabase';
import type { EncounterReadinessSummary } from '../types/encounterReadiness';

export const encounterReadinessService = {
  async getSummary(encontroId: string): Promise<EncounterReadinessSummary> {
    const { data, error } = await supabase.rpc('get_encounter_readiness', {
      p_encontro_id: encontroId,
    });

    if (error) throw error;
    return data as EncounterReadinessSummary;
  },
};
