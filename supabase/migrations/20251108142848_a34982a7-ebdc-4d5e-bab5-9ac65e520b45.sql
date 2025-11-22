-- Add metadata column to store original and cleaned queries
ALTER TABLE chat_messages 
ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;

-- Enable real-time for chat_messages table
ALTER TABLE chat_messages REPLICA IDENTITY FULL;

-- Add the table to realtime publication (if not already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
  END IF;
END $$;