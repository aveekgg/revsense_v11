-- Add tags column to chat_entities table
ALTER TABLE chat_entities 
ADD COLUMN tags TEXT[] DEFAULT '{}';

-- Optional: Create an index for better search performance on tags
CREATE INDEX IF NOT EXISTS idx_chat_entities_tags 
ON chat_entities USING GIN (tags);
