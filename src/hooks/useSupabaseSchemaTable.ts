import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export const useSupabaseSchemaTable = (schemaName?: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const tableName = schemaName 
    ? `clean_${schemaName.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`
    : null;

  const { data: records = [], isLoading, error } = useQuery({
    queryKey: ['schema-table-data', tableName],
    queryFn: async () => {
      if (!tableName) {
        console.log('No table name provided');
        return [];
      }

      if (!user) {
        console.error('User not authenticated');
        throw new Error('User not authenticated');
      }

      console.log('Querying table:', tableName, 'for all users');
      
      // Get current session to ensure we have fresh auth
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('No active session found');
        throw new Error('No active session');
      }

      console.log('Session valid, executing query...');
      
      const { data, error } = await (supabase as any)
        .from(tableName)
        .select('*')
        .order('extracted_at', { ascending: false });

      if (error) {
        console.error('Error fetching from table:', tableName, error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        
        // If table doesn't exist (404), return empty array instead of throwing
        if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
          console.warn(`Table ${tableName} does not exist yet. Run RECREATE_CLEAN_TABLES.sql to create it.`);
          return [];
        }
        
        throw error;
      }
      
      console.log('Records fetched:', data?.length, 'from', tableName);
      
      return data || [];
    },
    enabled: !!user && !!tableName,
    retry: 1,
  });

  const deleteRecord = useMutation({
    mutationFn: async (id: string) => {
      if (!tableName) throw new Error('No table selected');
      
      const { error } = await (supabase as any)
        .from(tableName)
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schema-table-data'] });
      toast({ title: 'Record deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete record', description: error.message, variant: 'destructive' });
    },
  });

  const clearTable = useMutation({
    mutationFn: async () => {
      if (!tableName) throw new Error('No table selected');
      
      const { error } = await (supabase as any)
        .from(tableName)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schema-table-data'] });
      toast({ title: 'Table cleared successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to clear table', description: error.message, variant: 'destructive' });
    },
  });

  return {
    records,
    isLoading,
    error,
    deleteRecord: deleteRecord.mutateAsync,
    clearTable: clearTable.mutateAsync,
  };
};
