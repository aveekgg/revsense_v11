import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CleanTableRecord } from '@/types/excel';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export const useSupabaseCleanData = (schemaId?: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: cleanData = [], isLoading, error } = useQuery({
    queryKey: ['supabase-clean-data', schemaId],
    queryFn: async () => {
      let query = (supabase as any)
        .from('clean_data')
        .select('*')
        .order('extracted_at', { ascending: false });

      if (schemaId) {
        query = query.eq('schema_id', schemaId);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      return (data || []).map((record: any) => ({
        id: record.id,
        schemaId: record.schema_id,
        data: record.data,
        sourceWorkbook: record.source_workbook,
        sourceMappingId: record.source_mapping_id,
        extractedAt: new Date(record.extracted_at),
      })) as CleanTableRecord[];
    },
    enabled: !!user, // Only run query when user is authenticated
  });

  const createCleanData = useMutation({
    mutationFn: async (record: {
      schemaId: string;
      data: Record<string, any>;
      sourceWorkbook: string;
      sourceMappingId: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await (supabase as any)
        .from('clean_data')
        .insert({
          user_id: user.id,
          schema_id: record.schemaId,
          data: record.data,
          source_workbook: record.sourceWorkbook,
          source_mapping_id: record.sourceMappingId,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-clean-data'] });
      toast({ title: 'Data saved successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to save data', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCleanData = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('clean_data')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-clean-data'] });
      toast({ title: 'Record deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete record', description: error.message, variant: 'destructive' });
    },
  });

  const clearCleanData = useMutation({
    mutationFn: async (schemaId: string) => {
      const { error } = await (supabase as any)
        .from('clean_data')
        .delete()
        .eq('schema_id', schemaId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-clean-data'] });
      toast({ title: 'Table cleared successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to clear table', description: error.message, variant: 'destructive' });
    },
  });

  return {
    cleanData,
    isLoading,
    error,
    createCleanData: createCleanData.mutateAsync,
    deleteCleanData: deleteCleanData.mutateAsync,
    clearCleanData: clearCleanData.mutateAsync,
  };
};
