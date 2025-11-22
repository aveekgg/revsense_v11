-- Enable RLS on tables that have policies but RLS is disabled
ALTER TABLE public.schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_context ENABLE ROW LEVEL SECURITY;

-- Enable RLS on other public tables
ALTER TABLE public.mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clean_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_charts ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for mappings table
CREATE POLICY "Users can view their own mappings"
ON public.mappings FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own mappings"
ON public.mappings FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own mappings"
ON public.mappings FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own mappings"
ON public.mappings FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Add RLS policies for clean_data table
CREATE POLICY "Users can view their own clean data"
ON public.clean_data FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own clean data"
ON public.clean_data FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clean data"
ON public.clean_data FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clean data"
ON public.clean_data FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Add RLS policies for dashboards table
CREATE POLICY "Users can view their own dashboards"
ON public.dashboards FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own dashboards"
ON public.dashboards FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dashboards"
ON public.dashboards FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dashboards"
ON public.dashboards FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Add RLS policies for dashboard_charts table
CREATE POLICY "Users can view charts in their own dashboards"
ON public.dashboard_charts FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.dashboards 
  WHERE dashboards.id = dashboard_charts.dashboard_id 
  AND dashboards.user_id = auth.uid()
));

CREATE POLICY "Users can create charts in their own dashboards"
ON public.dashboard_charts FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.dashboards 
  WHERE dashboards.id = dashboard_charts.dashboard_id 
  AND dashboards.user_id = auth.uid()
));

CREATE POLICY "Users can update charts in their own dashboards"
ON public.dashboard_charts FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.dashboards 
  WHERE dashboards.id = dashboard_charts.dashboard_id 
  AND dashboards.user_id = auth.uid()
));

CREATE POLICY "Users can delete charts in their own dashboards"
ON public.dashboard_charts FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.dashboards 
  WHERE dashboards.id = dashboard_charts.dashboard_id 
  AND dashboards.user_id = auth.uid()
));

-- Fix the search_path issue for execute_safe_query function
CREATE OR REPLACE FUNCTION public.execute_safe_query(query_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result JSONB;
  normalized_query TEXT;
BEGIN
  -- Normalize the query for validation (trim and uppercase)
  normalized_query := UPPER(TRIM(query_text));
  
  -- Validate that the query is a SELECT statement
  IF NOT normalized_query LIKE 'SELECT%' THEN
    RETURN jsonb_build_object(
      'error', 'Only SELECT queries are allowed',
      'details', 'Query must start with SELECT'
    );
  END IF;
  
  -- Check for dangerous keywords that could modify data
  IF normalized_query ~ '(DELETE|INSERT|UPDATE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)' THEN
    RETURN jsonb_build_object(
      'error', 'Query contains forbidden operations',
      'details', 'Only SELECT queries are permitted'
    );
  END IF;
  
  -- Execute the query and convert results to JSON
  BEGIN
    EXECUTE format('SELECT jsonb_agg(row_to_json(t)) FROM (%s) t', query_text) INTO result;
    
    -- Handle empty results
    IF result IS NULL THEN
      result := '[]'::jsonb;
    END IF;
    
    RETURN result;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'error', 'Query execution failed',
        'details', SQLERRM
      );
  END;
END;
$function$;