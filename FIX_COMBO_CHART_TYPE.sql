-- FIX FOR: dashboard_charts_chart_type_check constraint violation
-- 
-- PROBLEM: Cannot save charts with type 'combo' (used by canonical charts)
-- because the database constraint only allows: 'bar', 'line', 'pie', 'area', 'table'
--
-- SOLUTION: Add 'combo' to the allowed chart types
--
-- HOW TO RUN:
-- 1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/YOUR_PROJECT
-- 2. Click "SQL Editor" in left sidebar
-- 3. Click "New query"
-- 4. Paste this SQL and click "Run"

-- Drop the existing constraint
ALTER TABLE public.dashboard_charts 
DROP CONSTRAINT IF EXISTS dashboard_charts_chart_type_check;

-- Add new constraint with 'combo' included
ALTER TABLE public.dashboard_charts 
ADD CONSTRAINT dashboard_charts_chart_type_check 
CHECK (chart_type IN ('bar', 'line', 'pie', 'area', 'table', 'combo'));

-- Verify the constraint was added
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'dashboard_charts_chart_type_check';
