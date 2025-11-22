import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  user_id: string;
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

      const { data, error } = await supabase
        .from('dashboards')
        .insert([{ ...dashboard, user_id: user.id }])
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

  return {
    dashboards,
    isLoading,
    createDashboard: createDashboard.mutate,
    updateDashboard: updateDashboard.mutate,
    deleteDashboard: deleteDashboard.mutate,
    isCreating: createDashboard.isPending,
    isUpdating: updateDashboard.isPending,
    isDeleting: deleteDashboard.isPending,
  };
};
