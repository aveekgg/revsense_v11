import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Schema } from '@/types/excel';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export const useSupabaseSchemas = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: schemas = [], isLoading, error } = useQuery({
    queryKey: ['supabase-schemas'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('schemas')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return (data || []).map((s: any) => ({
        ...s,
        createdAt: new Date(s.created_at),
        updatedAt: new Date(s.updated_at),
      })) as Schema[];
    },
    enabled: !!user, // Only run query when user is authenticated
  });

  const createSchema = useMutation({
    mutationFn: async (schema: Omit<Schema, 'id' | 'createdAt' | 'updatedAt'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // 1. Create schema record
      const { data: schemaData, error: schemaError } = await (supabase as any)
        .from('schemas')
        .insert({
          user_id: user.id,
          name: schema.name,
          description: schema.description,
          fields: schema.fields,
        } as any)
        .select()
        .single();

      if (schemaError) throw schemaError;

      // 2. Create corresponding database table
      try {
        const { data: tableResult, error: tableError } = await supabase.functions.invoke('manage-schema-table', {
          body: {
            operation: 'create',
            schemaId: schemaData.id,
            schemaName: schema.name,
            fields: schema.fields
          }
        });

        if (tableError || !tableResult?.success) {
          // Rollback: delete schema record
          await (supabase as any).from('schemas').delete().eq('id', schemaData.id);
          throw new Error(tableResult?.error || tableError?.message || 'Failed to create table');
        }

        console.log('Created schema table:', tableResult.tableName);
      } catch (err) {
        // Rollback: delete schema record
        await (supabase as any).from('schemas').delete().eq('id', schemaData.id);
        throw err;
      }

      return schemaData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-schemas'] });
      toast({ title: 'Schema created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create schema', description: error.message, variant: 'destructive' });
    },
  });

  const updateSchema = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Schema> }) => {
      // 1. Update schema record
      const { data: schemaData, error: schemaError } = await (supabase as any)
        .from('schemas')
        .update({
          name: updates.name,
          description: updates.description,
          fields: updates.fields,
        } as any)
        .eq('id', id)
        .select()
        .single();

      if (schemaError) throw schemaError;

      // 2. Update corresponding database table if fields changed
      if (updates.fields) {
        try {
          const { data: tableResult, error: tableError } = await supabase.functions.invoke('manage-schema-table', {
            body: {
              operation: 'update',
              schemaId: id,
              schemaName: schemaData.name,
              fields: updates.fields
            }
          });

          if (tableError || !tableResult?.success) {
            console.error('Failed to update table schema:', tableResult?.error || tableError);
            toast({ 
              title: 'Warning', 
              description: 'Schema updated but table structure update failed. Data insertion may not work correctly.',
              variant: 'destructive' 
            });
          } else {
            console.log('Updated schema table:', tableResult.tableName);
          }
        } catch (err) {
          console.error('Error updating table:', err);
        }
      }

      return schemaData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-schemas'] });
      toast({ title: 'Schema updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update schema', description: error.message, variant: 'destructive' });
    },
  });

  const deleteSchema = useMutation({
    mutationFn: async ({ id, deleteTable }: { id: string; deleteTable: boolean }) => {
      // 1. Optionally delete the database table first
      if (deleteTable) {
        const { data: schema } = await (supabase as any)
          .from('schemas')
          .select('name')
          .eq('id', id)
          .single();

        if (schema) {
          try {
            const { error: tableError } = await supabase.functions.invoke('manage-schema-table', {
              body: {
                operation: 'delete',
                schemaId: id,
                schemaName: schema.name
              }
            });

            if (tableError) {
              console.error('Failed to delete table:', tableError);
              toast({ 
                title: 'Warning', 
                description: 'Failed to delete associated table. Continuing with schema deletion.',
                variant: 'destructive' 
              });
            }
          } catch (err) {
            console.error('Error deleting table:', err);
          }
        }
      }

      // 2. Delete the schema record
      const { error } = await (supabase as any)
        .from('schemas')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-schemas'] });
      toast({ title: 'Schema deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete schema', description: error.message, variant: 'destructive' });
    },
  });

  return {
    schemas,
    isLoading,
    error,
    createSchema: createSchema.mutateAsync,
    updateSchema: updateSchema.mutateAsync,
    deleteSchema: deleteSchema.mutateAsync,
  };
};
