import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type EntityType = 'hotel' | 'operator' | 'legal_entity' | 'metric';

export interface ChatEntity {
  id: string;
  user_id: string;
  name: string;
  type: EntityType;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateEntityInput {
  name: string;
  type: EntityType;
  description?: string;
}

export interface UpdateEntityInput {
  name?: string;
  description?: string;
}

/**
 * Hook to fetch and manage chat entities and metrics
 */
export const useChatEntities = (type?: EntityType | EntityType[]) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch entities based on type filter
  const { data: entities = [], isLoading, error } = useQuery({
    queryKey: ['chat-entities', type],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      let query = supabase
        .from('chat_entities')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      // Apply type filter if provided
      if (type) {
        if (Array.isArray(type)) {
          query = query.in('type', type);
        } else {
          query = query.eq('type', type);
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ChatEntity[];
    },
  });

  // Create new entity
  const createEntity = useMutation({
    mutationFn: async (input: CreateEntityInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('chat_entities')
        .insert({
          user_id: user.id,
          name: input.name,
          type: input.type,
          description: input.description,
        })
        .select()
        .single();

      if (error) throw error;
      return data as ChatEntity;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-entities'] });
      toast({
        title: 'Entity created',
        description: 'Successfully created new entity',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create entity',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update entity
  const updateEntity = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateEntityInput }) => {
      const { data, error } = await supabase
        .from('chat_entities')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as ChatEntity;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-entities'] });
      toast({
        title: 'Entity updated',
        description: 'Successfully updated entity',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update entity',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete entity
  const deleteEntity = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('chat_entities')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-entities'] });
      toast({
        title: 'Entity deleted',
        description: 'Successfully deleted entity',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete entity',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    entities,
    isLoading,
    error,
    createEntity: createEntity.mutate,
    updateEntity: updateEntity.mutate,
    deleteEntity: deleteEntity.mutate,
    isCreating: createEntity.isPending,
    isUpdating: updateEntity.isPending,
    isDeleting: deleteEntity.isPending,
  };
};

/**
 * Hook specifically for searching entities based on a search query
 * Useful for autocomplete/mention functionality
 */
export const useEntitySearch = (searchQuery: string, type?: EntityType | EntityType[]) => {
  const { data: entities = [], isLoading } = useQuery({
    queryKey: ['chat-entities-search', searchQuery, type],
    queryFn: async () => {
      console.log('🔎 useEntitySearch called:', { searchQuery, type });
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('⚠️ No user authenticated');
        return [];
      }

      console.log('✅ User authenticated:', user.id);

      let query = supabase
        .from('chat_entities')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true })
        .limit(10);

      // Apply search filter if provided
      if (searchQuery && searchQuery.length > 0) {
        query = query.ilike('name', `%${searchQuery}%`);
      }

      // Apply type filter if provided
      if (type) {
        if (Array.isArray(type)) {
          query = query.in('type', type);
        } else {
          query = query.eq('type', type);
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Entity search error:', error);
        return [];
      }
      
      console.log('✅ Entity search results:', data);
      return data as ChatEntity[];
    },
    enabled: type !== undefined, // Enable as long as we have a type (@ or ~)
  });

  return { entities, isLoading };
};
