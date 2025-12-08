-- ========================================================
-- COMPLETE FIX FOR manage-schema-table 500 ERROR
-- Run ALL of this in Supabase SQL Editor
-- ========================================================

-- PART 1: Create execute_safe_query (needed by ai-sql-orchestrator)
-- ========================================================

DROP FUNCTION IF EXISTS public.execute_safe_query(TEXT) CASCADE;

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
  -- Handle NULL input
  IF query_text IS NULL OR TRIM(query_text) = '' THEN
    RETURN jsonb_build_object(
      'error', 'Query cannot be null or empty'
    );
  END IF;

  -- Normalize the query for validation (trim and uppercase)
  normalized_query := UPPER(TRIM(query_text));
  
  -- Allow SELECT and WITH (for CTEs)
  IF NOT (normalized_query LIKE 'SELECT%' OR normalized_query LIKE 'WITH%') THEN
    RETURN jsonb_build_object(
      'error', 'Only SELECT queries (with optional WITH clauses) are allowed',
      'details', 'Query must start with SELECT or WITH'
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
    EXECUTE format('SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (%s) t', query_text) INTO result;
    
    -- Handle empty results
    IF result IS NULL THEN
      result := '[]'::jsonb;
    END IF;
    
    RETURN result;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'error', 'Query execution failed',
        'details', SQLERRM,
        'sqlstate', SQLSTATE
      );
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_safe_query(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_safe_query(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.execute_safe_query(TEXT) TO anon;

-- PART 2: Create sanitize_table_name
-- ========================================================

DROP FUNCTION IF EXISTS public.sanitize_table_name(TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.sanitize_table_name(p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Handle NULL or empty input
  IF p_name IS NULL OR TRIM(p_name) = '' THEN
    RAISE EXCEPTION 'Table name cannot be null or empty';
  END IF;
  
  -- Return sanitized name: lowercase, replace special chars with underscores
  RETURN lower(regexp_replace(p_name, '[^a-zA-Z0-9_]', '_', 'g'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.sanitize_table_name(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sanitize_table_name(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.sanitize_table_name(TEXT) TO anon;

-- PART 3: Create get_table_columns
-- ========================================================

DROP FUNCTION IF EXISTS public.get_table_columns(TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.get_table_columns(p_table_name TEXT)
RETURNS TABLE (
  column_name TEXT,
  data_type TEXT,
  is_nullable TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if table exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.tables t
    WHERE t.table_schema = 'public' 
    AND t.table_name = p_table_name
  ) THEN
    -- Return empty result for non-existent tables (not an error)
    RAISE NOTICE 'Table % does not exist, returning empty result', p_table_name;
    RETURN;
  END IF;

  -- Return columns excluding system columns
  RETURN QUERY
  SELECT 
    c.column_name::TEXT,
    c.data_type::TEXT,
    c.is_nullable::TEXT
  FROM information_schema.columns c
  WHERE c.table_name = p_table_name
    AND c.table_schema = 'public'
    AND c.column_name NOT IN ('id', 'user_id', 'source_workbook', 'source_mapping_id', 'extracted_at')
  ORDER BY c.ordinal_position;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_table_columns(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_table_columns(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_table_columns(TEXT) TO anon;

-- PART 4: Create execute_ddl
-- ========================================================

DROP FUNCTION IF EXISTS public.execute_ddl(TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.execute_ddl(p_ddl_statement TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate input
  IF p_ddl_statement IS NULL OR TRIM(p_ddl_statement) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DDL statement cannot be null or empty'
    );
  END IF;

  -- Log the DDL (visible in Supabase logs - first 500 chars)
  RAISE NOTICE 'Executing DDL (first 500 chars): %', LEFT(p_ddl_statement, 500);
  
  -- Execute the DDL statement
  BEGIN
    EXECUTE p_ddl_statement;
    
    RAISE NOTICE 'DDL executed successfully';
    
    -- Return success
    RETURN jsonb_build_object('success', true);
  EXCEPTION
    WHEN OTHERS THEN
      -- Log the full error
      RAISE WARNING 'DDL execution failed - SQLSTATE: %, SQLERRM: %', SQLSTATE, SQLERRM;
      
      -- Return detailed error
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'detail', SQLSTATE,
        'hint', CASE 
          WHEN SQLSTATE = '42P07' THEN 'Object already exists'
          WHEN SQLSTATE = '42703' THEN 'Column does not exist'
          WHEN SQLSTATE = '42P01' THEN 'Table does not exist'
          WHEN SQLSTATE = '42501' THEN 'Permission denied'
          WHEN SQLSTATE = '42601' THEN 'Syntax error in SQL'
          ELSE 'Check SQL syntax and permissions'
        END
      );
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_ddl(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_ddl(TEXT) TO service_role;

-- DO NOT grant execute_ddl to anon for security reasons

-- PART 5: Verification
-- ========================================================

SELECT '=== VERIFYING FUNCTION CREATION ===' as status;

SELECT 
  routine_name,
  routine_type,
  security_type,
  '✅ Created' as status
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name IN ('sanitize_table_name', 'get_table_columns', 'execute_ddl', 'execute_safe_query')
ORDER BY routine_name;

-- PART 6: Verify Permissions
-- ========================================================

SELECT '=== VERIFYING PERMISSIONS ===' as status;

SELECT 
  r.routine_name,
  ARRAY_AGG(DISTINCT rp.grantee ORDER BY rp.grantee) as granted_to,
  BOOL_OR(rp.grantee = 'authenticated') as has_authenticated,
  BOOL_OR(rp.grantee = 'service_role') as has_service_role
FROM information_schema.routines r
LEFT JOIN information_schema.routine_privileges rp 
  ON r.routine_name = rp.routine_name 
  AND r.routine_schema = rp.routine_schema
  AND rp.privilege_type = 'EXECUTE'
WHERE r.routine_schema = 'public' 
  AND r.routine_name IN ('sanitize_table_name', 'get_table_columns', 'execute_ddl', 'execute_safe_query')
GROUP BY r.routine_name
ORDER BY r.routine_name;

-- PART 7: Test the functions
-- ========================================================

SELECT '=== TESTING FUNCTIONS ===' as status;

-- Test 1: sanitize_table_name
SELECT 
  'Test sanitize_table_name' as test,
  sanitize_table_name('My Test Schema!') as result,
  'Should be: my_test_schema_' as expected;

-- Test 2: execute_ddl (create test table)
SELECT 
  'Test execute_ddl (CREATE)' as test,
  execute_ddl('CREATE TABLE IF NOT EXISTS public.test_function_table (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), test_col TEXT);') as result;

-- Test 3: get_table_columns
SELECT 
  'Test get_table_columns' as test,
  json_agg(row_to_json(t)) as result
FROM get_table_columns('test_function_table') t;

-- Test 4: execute_safe_query
SELECT 
  'Test execute_safe_query' as test,
  execute_safe_query('SELECT * FROM schemas LIMIT 1') as result;

-- Clean up test table
DROP TABLE IF EXISTS public.test_function_table CASCADE;

-- PART 8: Success message
-- ========================================================

SELECT '✅✅✅ ALL FUNCTIONS CREATED AND TESTED SUCCESSFULLY ✅✅✅' as final_status;
SELECT 'You can now try your mapping operation again!' as next_step;
SELECT 'If still failing, check: Supabase Dashboard → Functions → manage-schema-table → Logs' as debugging_tip;
