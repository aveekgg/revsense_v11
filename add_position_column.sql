-- Add position column to dashboards table for reordering functionality
ALTER TABLE dashboards 
ADD COLUMN position INTEGER;

-- Update existing dashboards with positions based on created_at order
-- This assigns positions starting from 0 for the oldest dashboard
UPDATE dashboards 
SET position = sub.row_num - 1
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as row_num
  FROM dashboards
) sub
WHERE dashboards.id = sub.id;

-- Optional: Create an index for better ordering performance
CREATE INDEX IF NOT EXISTS idx_dashboards_position 
ON dashboards (position);
