import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface DashboardChart {
  id: string;
  dashboard_id: string;
  title: string;
  sql_query: string;
  chart_type: string;
  config: any;
  position: number;
  created_at: string;
}

export const useDashboardCharts = (dashboardId?: string) => {
  const queryClient = useQueryClient();

  const { data: charts, isLoading } = useQuery({
    queryKey: ['dashboard-charts', dashboardId],
    queryFn: async () => {
      if (!dashboardId) return [];

      const { data, error } = await supabase
        .from('dashboard_charts')
        .select('*')
        .eq('dashboard_id', dashboardId)
        .order('position', { ascending: true });

      if (error) throw error;
      return data as DashboardChart[];
    },
    enabled: !!dashboardId,
  });

  const addChart = useMutation({
    mutationFn: async (chart: {
      dashboard_id: string;
      title: string;
      sql_query: string;
      chart_type: string;
      config: any;
    }) => {
      // Get the next position
      const { data: existingCharts } = await supabase
        .from('dashboard_charts')
        .select('position')
        .eq('dashboard_id', chart.dashboard_id)
        .order('position', { ascending: false })
        .limit(1);

      const nextPosition = existingCharts && existingCharts.length > 0 
        ? existingCharts[0].position + 1 
        : 0;

      const { data, error } = await supabase
        .from('dashboard_charts')
        .insert([{ ...chart, position: nextPosition }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-charts', variables.dashboard_id] });
      toast({
        title: 'Saved to dashboard',
        description: 'Query has been saved to your dashboard.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to save to dashboard: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const updateChart = useMutation({
    mutationFn: async ({ id, title, config }: { id: string; title?: string; config?: any }) => {
      const updates: any = {};
      if (title !== undefined) updates.title = title;
      if (config !== undefined) updates.config = config;

      const { data, error } = await supabase
        .from('dashboard_charts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-charts'] });
      toast({
        title: 'Chart updated',
        description: 'Chart has been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update chart: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const deleteChart = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('dashboard_charts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-charts'] });
      toast({
        title: 'Chart removed',
        description: 'Chart has been removed from dashboard.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to delete chart: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const refreshChart = useMutation({
    mutationFn: async ({ id, sql_query }: { id: string; sql_query: string }) => {
      const { data, error } = await supabase.rpc('execute_safe_query', {
        query_text: String(sql_query),
      });

      if (error) throw error;
      
      // Check if data contains an error from the function
      if (data && typeof data === 'object' && 'error' in data) {
        throw new Error(String(data.error));
      }

      // Update the config with last refreshed timestamp
      const chart = charts?.find(c => c.id === id);
      if (chart) {
        const updatedConfig = {
          ...chart.config,
          lastRefreshed: new Date().toISOString(),
          lastResult: data || [],
        };

        await supabase
          .from('dashboard_charts')
          .update({ config: updatedConfig })
          .eq('id', id);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-charts'] });
      toast({
        title: 'Chart refreshed',
        description: 'Data has been updated with the latest results.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Refresh failed',
        description: `Failed to refresh data: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  return {
    charts,
    isLoading,
    addChart: addChart.mutate,
    updateChart: updateChart.mutate,
    deleteChart: deleteChart.mutate,
    refreshChart: refreshChart.mutate,
    isAdding: addChart.isPending,
    isUpdating: updateChart.isPending,
    isDeleting: deleteChart.isPending,
    isRefreshing: refreshChart.isPending,
  };
};
