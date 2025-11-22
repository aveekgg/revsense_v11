-- ========================================================
-- FUNCTION PERMISSIONS FIX - Apply this after RLS fixes
-- Run this SQL in your Supabase SQL Editor
-- ========================================================

-- 1. Ensure all RPC functions have proper permissions for authenticated users
GRANT EXECUTE ON FUNCTION public.sanitize_table_name(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_table_columns(TEXT) TO authenticated;  
GRANT EXECUTE ON FUNCTION public.execute_safe_query(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_ddl(TEXT) TO authenticated;

-- 2. Fix any search_path issues with the functions
CREATE OR REPLACE FUNCTION public.get_table_columns(table_name TEXT)
RETURNS TABLE (
  column_name TEXT,
  data_type TEXT,
  is_nullable TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table_name TEXT := table_name;
BEGIN
  -- Validate table name exists and user has access
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = v_table_name
  ) THEN
    RAISE EXCEPTION 'Table does not exist: %', v_table_name;
  END IF;

  RETURN QUERY
  SELECT 
    c.column_name::TEXT,
    c.data_type::TEXT,
    c.is_nullable::TEXT
  FROM information_schema.columns c
  WHERE c.table_name = v_table_name
    AND c.table_schema = 'public'
    AND c.column_name NOT IN ('id', 'user_id', 'source_workbook', 'source_mapping_id', 'extracted_at')
  ORDER BY c.ordinal_position;
END;
$$;

-- Grant execute permission again after recreation
GRANT EXECUTE ON FUNCTION public.get_table_columns(TEXT) TO authenticated;

-- 3. Ensure execute_safe_query has proper search_path
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

-- Grant execute permission again after recreation
GRANT EXECUTE ON FUNCTION public.execute_safe_query(TEXT) TO authenticated;

-- 4. Create a function to test cross-user access
CREATE OR REPLACE FUNCTION public.test_cross_user_access()
RETURNS TABLE (
  test_name TEXT,
  result TEXT,
  details TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  schema_count INTEGER;
  clean_data_count INTEGER;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  -- Test 1: Schema access
  BEGIN
    SELECT COUNT(*) INTO schema_count FROM public.schemas;
    RETURN QUERY SELECT 'schemas_access'::TEXT, 'SUCCESS'::TEXT, format('Found %s schemas', schema_count)::TEXT;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY SELECT 'schemas_access'::TEXT, 'FAILED'::TEXT, SQLERRM::TEXT;
  END;
  
  -- Test 2: Clean data access  
  BEGIN
    SELECT COUNT(*) INTO clean_data_count FROM public.clean_data;
    RETURN QUERY SELECT 'clean_data_access'::TEXT, 'SUCCESS'::TEXT, format('Found %s clean data records', clean_data_count)::TEXT;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY SELECT 'clean_data_access'::TEXT, 'FAILED'::TEXT, SQLERRM::TEXT;
  END;
  
  -- Test 3: Current user info
  RETURN QUERY SELECT 'current_user'::TEXT, 'INFO'::TEXT, format('Current user ID: %s', current_user_id)::TEXT;
  
END;
$$;

-- Grant execute permission for the test function
GRANT EXECUTE ON FUNCTION public.test_cross_user_access() TO authenticated;

-- 5. Verify permissions are set correctly
SELECT 
  routine_name,
  'authenticated' = ANY(ARRAY(
    SELECT grantee 
    FROM information_schema.routine_privileges 
    WHERE routine_name = r.routine_name 
    AND privilege_type = 'EXECUTE'
    AND grantee = 'authenticated'
  )) as has_auth_permission
FROM information_schema.routines r
WHERE routine_schema = 'public' 
AND routine_name IN ('sanitize_table_name', 'get_table_columns', 'execute_safe_query', 'test_cross_user_access')
ORDER BY routine_name;

-- Success message
SELECT 'Function permissions updated successfully!' as status;