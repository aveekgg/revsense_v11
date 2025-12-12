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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-charts'] });
      toast({
        title: 'Chart added',
        description: 'Chart has been added to your dashboard.',
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
    mutationFn: async ({ id, title, config, position, sql_query }: { id: string; title?: string; config?: any; position?: number; sql_query?: string }) => {
      const updates: any = {};
      if (title !== undefined) updates.title = title;
      if (config !== undefined) updates.config = config;
      if (position !== undefined) updates.position = position;
      if (sql_query !== undefined) updates.sql_query = sql_query;

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

  const duplicateChart = useMutation({
    mutationFn: async ({ chartId, targetDashboardId, newTitle }: { chartId: string; targetDashboardId: string; newTitle?: string }) => {
      // Get the original chart
      const originalChart = charts?.find(c => c.id === chartId);
      if (!originalChart) throw new Error('Chart not found');

      // Get the next position in the target dashboard
      const { data: existingCharts } = await supabase
        .from('dashboard_charts')
        .select('position')
        .eq('dashboard_id', targetDashboardId)
        .order('position', { ascending: false })
        .limit(1);

      const nextPosition = existingCharts && existingCharts.length > 0
        ? existingCharts[0].position + 1
        : 0;

      // Create the duplicated chart
      const { data, error } = await supabase
        .from('dashboard_charts')
        .insert([{
          dashboard_id: targetDashboardId,
          title: newTitle || `${originalChart.title} (Copy)`,
          sql_query: originalChart.sql_query,
          chart_type: originalChart.chart_type,
          config: originalChart.config,
          position: nextPosition,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-charts'] });
      toast({
        title: 'Chart duplicated',
        description: 'Chart has been duplicated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to duplicate chart: ${error.message}`,
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

  const reorderCharts = useMutation({
    mutationFn: async (chartUpdates: { id: string; position: number }[]) => {
      const promises = chartUpdates.map(({ id, position }) =>
        supabase
          .from('dashboard_charts')
          .update({ position })
          .eq('id', id)
      );

      const results = await Promise.all(promises);
      const errors = results.filter(result => result.error);
      if (errors.length > 0) {
        throw new Error('Failed to reorder some charts');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-charts'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to reorder charts: ${error.message}`,
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
    duplicateChart: duplicateChart.mutate,
    refreshChart: refreshChart.mutate,
    reorderCharts: reorderCharts.mutate,
    isAdding: addChart.isPending,
    isUpdating: updateChart.isPending,
    isDeleting: deleteChart.isPending,
    isDuplicating: duplicateChart.isPending,
    isRefreshing: refreshChart.isPending,
    isReordering: reorderCharts.isPending,
  };
};
