-- Create chat_entities table for storing mention-able entities and metrics
CREATE TABLE IF NOT EXISTS chat_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('hotel', 'operator', 'legal_entity', 'metric')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name, type)
);

-- Create index for faster queries
CREATE INDEX idx_chat_entities_user_type ON chat_entities(user_id, type);
CREATE INDEX idx_chat_entities_name ON chat_entities(name);

-- Enable RLS
ALTER TABLE chat_entities ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own entities"
  ON chat_entities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own entities"
  ON chat_entities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own entities"
  ON chat_entities FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own entities"
  ON chat_entities FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_chat_entities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_chat_entities_timestamp
  BEFORE UPDATE ON chat_entities
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_entities_updated_at();

-- Insert some sample data for demonstration (optional - can be removed)
-- This will only work if there are existing users
-- COMMENT OUT OR DELETE THIS SECTION IF YOU DON'T WANT SAMPLE DATA
/*
INSERT INTO chat_entities (user_id, name, type, description)
SELECT 
  auth.uid(),
  'Grand Hotel',
  'hotel',
  'Main property in downtown'
WHERE auth.uid() IS NOT NULL
ON CONFLICT (user_id, name, type) DO NOTHING;

INSERT INTO chat_entities (user_id, name, type, description)
SELECT 
  auth.uid(),
  'Total Revenue',
  'metric',
  'Sum of all revenue streams'
WHERE auth.uid() IS NOT NULL
ON CONFLICT (user_id, name, type) DO NOTHING;

INSERT INTO chat_entities (user_id, name, type, description)
SELECT 
  auth.uid(),
  'ABC Corp',
  'operator',
  'Primary hotel operator'
WHERE auth.uid() IS NOT NULL
ON CONFLICT (user_id, name, type) DO NOTHING;
*/
