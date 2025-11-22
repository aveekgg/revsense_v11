-- Add 'combo' to the allowed chart_type values in dashboard_charts table
-- This is needed for canonical charts that use ComposedChart with multiple series types

-- Drop the existing constraint
ALTER TABLE public.dashboard_charts 
DROP CONSTRAINT IF EXISTS dashboard_charts_chart_type_check;

-- Add new constraint with 'combo' included
ALTER TABLE public.dashboard_charts 
ADD CONSTRAINT dashboard_charts_chart_type_check 
CHECK (chart_type IN ('bar', 'line', 'pie', 'area', 'table', 'combo'));
