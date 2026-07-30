import { supabase } from '../lib/supabase';
import type { DashboardSummary } from '../types/dashboard';

export const dashboardService = {
  async obterResumo(encontroId: string): Promise<DashboardSummary> {
    const { data, error } = await supabase.rpc('get_my_dashboard_summary', {
      p_encontro_id: encontroId,
    });

    if (error) throw error;
    return data as DashboardSummary;
  },
};
