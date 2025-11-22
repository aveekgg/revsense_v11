-- Add data_summary column to chat_messages table
ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS data_summary TEXT;