-- Add missing UPDATE policy for chat_messages table
-- This allows users to update messages in their own chat sessions
-- Required for saving chart_suggestion after chart generation

CREATE POLICY "Users can update messages in their sessions"
  ON public.chat_messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions
      WHERE chat_sessions.id = chat_messages.session_id
      AND chat_sessions.user_id = auth.uid()
    )
  );

-- Also add DELETE policy for completeness (optional but recommended)
CREATE POLICY "Users can delete messages in their sessions"
  ON public.chat_messages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions
      WHERE chat_sessions.id = chat_messages.session_id
      AND chat_sessions.user_id = auth.uid()
    )
  );
