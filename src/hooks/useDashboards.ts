import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  user_id: string;
  position?: number;
}

export const useDashboards = () => {
  const queryClient = useQueryClient();

  const { data: dashboards, isLoading } = useQuery({
    queryKey: ['dashboards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dashboards')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Dashboard[];
    },
  });

  const createDashboard = useMutation({
    mutationFn: async (dashboard: { name: string; description?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get current dashboard count to assign position
      const { count } = await supabase
        .from('dashboards')
        .select('*', { count: 'exact', head: true });

      const nextPosition = count || 0;

      const { data, error } = await supabase
        .from('dashboards')
        .insert([{ ...dashboard, user_id: user.id, position: nextPosition }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboards'] });
      toast({
        title: 'Dashboard created',
        description: 'Your new dashboard has been created successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to create dashboard: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const updateDashboard = useMutation({
    mutationFn: async ({ id, name, description }: { id: string; name: string; description?: string }) => {
      const { data, error } = await supabase
        .from('dashboards')
        .update({ name, description })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboards'] });
      toast({
        title: 'Dashboard updated',
        description: 'Dashboard has been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update dashboard: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const deleteDashboard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('dashboards')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboards'] });
      toast({
        title: 'Dashboard deleted',
        description: 'Dashboard has been removed successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to delete dashboard: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const reorderDashboards = useMutation({
    mutationFn: async (dashboardUpdates: { id: string; position: number }[]) => {
      // For now, reorder by updating created_at timestamps in reverse order
      // This is a workaround until position column is added to database
      const now = new Date();
      const promises = dashboardUpdates.map(({ id, position }, index) =>
        supabase
          .from('dashboards')
          .update({ created_at: new Date(now.getTime() - (position * 1000)).toISOString() })
          .eq('id', id)
      );

      const results = await Promise.all(promises);
      const errors = results.filter(result => result.error);
      if (errors.length > 0) {
        throw new Error('Failed to reorder some dashboards');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboards'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to reorder dashboards: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  return {
    dashboards,
    isLoading,
    createDashboard: createDashboard.mutate,
    updateDashboard: updateDashboard.mutate,
    deleteDashboard: deleteDashboard.mutate,
    reorderDashboards: reorderDashboards.mutate,
    isCreating: createDashboard.isPending,
    isUpdating: updateDashboard.isPending,
    isDeleting: deleteDashboard.isPending,
    isReordering: reorderDashboards.isPending,
  };
};
