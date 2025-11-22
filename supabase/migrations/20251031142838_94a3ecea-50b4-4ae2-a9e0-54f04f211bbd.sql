-- Create the execute_safe_query function for safe SQL execution
CREATE OR REPLACE FUNCTION public.execute_safe_query(query_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.execute_safe_query(TEXT) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.execute_safe_query(TEXT) IS 'Safely executes SELECT-only SQL queries and returns results as JSONB. Used by AI orchestrator for dynamic data querying.';