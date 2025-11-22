import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export interface BusinessContext {
  id: string;
  name: string;
  contextType: string;
  definition: string;
  examples: string[];
  createdAt: Date;
}

export const useSupabaseBusinessContext = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: businessContexts = [], isLoading, error } = useQuery({
    queryKey: ['supabase-business-context'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('business_context')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return (data || []).map((ctx: any) => ({
        id: ctx.id,
        name: ctx.name,
        contextType: ctx.context_type,
        definition: ctx.definition,
        examples: ctx.examples || [],
        createdAt: new Date(ctx.created_at),
      })) as BusinessContext[];
    },
    enabled: !!user, // Only run query when user is authenticated
  });

  const createBusinessContext = useMutation({
    mutationFn: async (context: {
      name: string;
      contextType: string;
      definition: string;
      examples: string[];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const insertData = {
        user_id: user.id,
        name: context.name,
        context_type: context.contextType,
        definition: context.definition,
        examples: context.examples,
      };

      console.log('Creating business context with data:', insertData);

      const { data, error } = await (supabase as any)
        .from('business_context')
        .insert(insertData as any)
        .select()
        .single();

      if (error) {
        console.error('Supabase insert error:', error);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-business-context'] });
      toast({ title: 'Business context created successfully' });
    },
    onError: (error: Error) => {
      console.error('Failed to create business context:', error);
      const errorMessage = error.message || 'Unknown error occurred';
      toast({ title: 'Failed to create business context', description: errorMessage, variant: 'destructive' });
    },
  });

  const updateBusinessContext = useMutation({
    mutationFn: async ({ id, updates }: { 
      id: string; 
      updates: {
        name?: string;
        contextType?: string;
        definition?: string;
        examples?: string[];
      };
    }) => {
      const { data, error } = await (supabase as any)
        .from('business_context')
        .update({
          name: updates.name,
          context_type: updates.contextType,
          definition: updates.definition,
          examples: updates.examples,
        } as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-business-context'] });
      toast({ title: 'Business context updated successfully' });
    },
    onError: (error: Error) => {
      console.error('Failed to update business context:', error);
      const errorMessage = error.message || 'Unknown error occurred';
      toast({ title: 'Failed to update business context', description: errorMessage, variant: 'destructive' });
    },
  });

  const deleteBusinessContext = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('business_context')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-business-context'] });
      toast({ title: 'Business context deleted successfully' });
    },
    onError: (error: Error) => {
      console.error('Failed to delete business context:', error);
      const errorMessage = error.message || 'Unknown error occurred';
      toast({ title: 'Failed to delete business context', description: errorMessage, variant: 'destructive' });
    },
  });

  return {
    businessContexts,
    isLoading,
    error,
    createBusinessContext: createBusinessContext.mutateAsync,
    updateBusinessContext: updateBusinessContext.mutateAsync,
    deleteBusinessContext: deleteBusinessContext.mutateAsync,
  };
};
