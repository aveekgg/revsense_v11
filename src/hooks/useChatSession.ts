import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sql_query?: string;
  query_result?: any;
  chart_suggestion?: {
    chartType: string;
    config: any;
    data?: any;
  };
  data_summary?: string;
  metadata?: {
    originalQuery?: string;
    cleanedQuery?: string;
  };
  created_at: string;
}

export const useChatSession = (sessionId?: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(sessionId);

  // Fetch all sessions for the user
  const { data: sessions = [], isLoading: isLoadingSessions } = useQuery({
    queryKey: ['chat-sessions'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await (supabase as any)
        .from('chat_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['chat-messages', currentSessionId],
    queryFn: async () => {
      if (!currentSessionId) return [];

      const { data, error } = await (supabase as any)
        .from('chat_messages')
        .select('*')
        .eq('session_id', currentSessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as ChatMessage[];
    },
    enabled: !!currentSessionId,
  });

  const createSession = useMutation({
    mutationFn: async (title: string = 'New Chat') => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await (supabase as any)
        .from('chat_sessions')
        .insert({ user_id: user.id, title } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      setCurrentSessionId(data?.id);
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create chat session', description: error.message, variant: 'destructive' });
    },
  });

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      if (!currentSessionId) throw new Error('No active session');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Save user message
      const { error: userMsgError } = await (supabase as any)
        .from('chat_messages')
        .insert({
          session_id: currentSessionId,
          role: 'user',
          content,
        } as any);

      if (userMsgError) throw userMsgError;

      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      console.log('📡 Calling ai-sql-orchestrator edge function...');
      console.log('📝 Request body:', {
        userQuery: content,
        sessionId: currentSessionId,
        chatHistoryLength: messages.length,
      });

      // Call AI orchestrator - change this to ai-sql-orchestrator for production
      const { data, error } = await supabase.functions.invoke('ai-sql-gen', {
        body: {
          userQuery: content,
          sessionId: currentSessionId,
          chatHistory: messages.map(m => ({ role: m.role, content: m.content })),
        },
      });

      console.log('📨 Edge function response:', { data, error });

      if (error) {
        console.error('❌ Edge function error:', error);
        throw error;
      }
      
      console.log('✅ Edge function success:', data);
      return data;
    },
    onMutate: async (content: string) => {
      console.log('🚀 onMutate called - adding optimistic user message');
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['chat-messages', currentSessionId] });

      // Snapshot the previous value
      const previousMessages = queryClient.getQueryData(['chat-messages', currentSessionId]);
      console.log('📸 Previous messages:', previousMessages);

      // Optimistically update to show user message immediately
      const newMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content,
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData(['chat-messages', currentSessionId], (old: ChatMessage[] = []) => {
        const updated = [...old, newMessage];
        console.log('✅ Optimistically updated messages:', updated);
        return updated;
      });

      return { previousMessages };
    },
    onSuccess: () => {
      console.log('✨ Message sent successfully - refetching messages');
      queryClient.invalidateQueries({ queryKey: ['chat-messages', currentSessionId] });
    },
    onError: (error: Error, _variables, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(['chat-messages', currentSessionId], context.previousMessages);
      }
      toast({ title: 'Failed to send message', description: error.message, variant: 'destructive' });
    },
  });

  const switchSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
  };

  const deleteSession = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await (supabase as any)
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
      if (sessions.length > 0) {
        setCurrentSessionId(sessions[0]?.id);
      }
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete session', description: error.message, variant: 'destructive' });
    },
  });

  return {
    messages,
    isLoading,
    sessions,
    isLoadingSessions,
    currentSessionId,
    createSession: createSession.mutate,
    sendMessage: sendMessage.mutate,
    switchSession,
    deleteSession: deleteSession.mutate,
    isCreatingSession: createSession.isPending,
    isSendingMessage: sendMessage.isPending,
    isDeletingSession: deleteSession.isPending,
  };
};
