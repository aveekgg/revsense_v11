import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SavedMapping } from '@/types/excel';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export const useSupabaseMappings = (schemaId?: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: mappings = [], isLoading, error } = useQuery({
    queryKey: ['supabase-mappings', schemaId],
    queryFn: async () => {
      let query = (supabase as any)
        .from('mappings')
        .select('*')
        .order('created_at', { ascending: false });

      if (schemaId) {
        query = query.eq('schema_id', schemaId);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      return (data || []).map((m: any) => ({
        ...m,
        schemaId: m.schema_id,
        fieldMappings: m.field_mappings,
        workbookFormat: m.workbook_format,
        createdAt: new Date(m.created_at),
        updatedAt: new Date(m.updated_at),
      })) as SavedMapping[];
    },
    enabled: !!user, // Only run query when user is authenticated
  });

  const createMapping = useMutation({
    mutationFn: async (mapping: {
      name: string;
      description: string;
      tags: string[];
      schemaId: string;
      fieldMappings: any[];
      workbookFormat?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await (supabase as any)
        .from('mappings')
        .insert({
          user_id: user.id,
          schema_id: mapping.schemaId,
          name: mapping.name,
          description: mapping.description,
          tags: mapping.tags,
          workbook_format: mapping.workbookFormat,
          field_mappings: mapping.fieldMappings,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-mappings'] });
      toast({ title: 'Mapping created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create mapping', description: error.message, variant: 'destructive' });
    },
  });

  const updateMapping = useMutation({
    mutationFn: async ({ id, updates }: {
      id: string;
      updates: {
        name?: string;
        description?: string;
        tags?: string[];
        fieldMappings?: any[];
        workbookFormat?: string;
      };
    }) => {
      const { data, error } = await (supabase as any)
        .from('mappings')
        .update({
          name: updates.name,
          description: updates.description,
          tags: updates.tags,
          field_mappings: updates.fieldMappings,
          workbook_format: updates.workbookFormat,
        } as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-mappings'] });
      toast({ title: 'Mapping updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update mapping', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMapping = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('mappings')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-mappings'] });
      toast({ title: 'Mapping deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete mapping', description: error.message, variant: 'destructive' });
    },
  });

  return {
    mappings,
    isLoading,
    error,
    createMapping: createMapping.mutateAsync,
    updateMapping: updateMapping.mutateAsync,
    deleteMapping: deleteMapping.mutateAsync,
  };
};
