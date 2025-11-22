-- ========================================================
-- COMPREHENSIVE CROSS-USER ACCESS DIAGNOSTIC
-- Run this as different users to identify the exact issue
-- ========================================================

-- Test 1: Check if RLS policies exist and are correct
SELECT '=== CURRENT RLS POLICIES ===' as test_section;

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  CASE 
    WHEN qual LIKE '%auth.uid()%' THEN 'USER-SPECIFIC' 
    WHEN qual = 'true' THEN 'GLOBAL ACCESS'
    ELSE 'OTHER: ' || COALESCE(qual, 'NULL')
  END as access_type,
  qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND (tablename IN ('schemas', 'business_context', 'mappings', 'clean_data') OR tablename LIKE 'clean_%')
ORDER BY tablename, policyname;

-- Test 2: Check table permissions and RLS status
SELECT '=== TABLE RLS STATUS ===' as test_section;

SELECT 
  schemaname,
  tablename,
  rowsecurity,
  CASE 
    WHEN rowsecurity THEN 'RLS ENABLED' 
    ELSE 'RLS DISABLED' 
  END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
AND (tablename IN ('schemas', 'business_context', 'mappings', 'clean_data') OR tablename LIKE 'clean_%')
ORDER BY tablename;

-- Test 3: Check function permissions
SELECT '=== FUNCTION PERMISSIONS ===' as test_section;

SELECT 
  routine_name,
  routine_type,
  security_type,
  CASE 
    WHEN 'authenticated' = ANY(ARRAY(
      SELECT grantee 
      FROM information_schema.routine_privileges 
      WHERE routine_name = r.routine_name 
      AND privilege_type = 'EXECUTE'
    )) THEN 'ACCESSIBLE'
    ELSE 'NOT ACCESSIBLE'
  END as auth_access
FROM information_schema.routines r
WHERE routine_schema = 'public' 
AND routine_name IN ('sanitize_table_name', 'get_table_columns', 'execute_safe_query')
ORDER BY routine_name;

-- Test 4: Try to access schemas table (should work for all users)
SELECT '=== SCHEMAS ACCESS TEST ===' as test_section;

BEGIN;
  -- This should work for all authenticated users
  SELECT COUNT(*) as schema_count FROM public.schemas;
  
  -- Show sample schemas
  SELECT id, name, description, user_id FROM public.schemas LIMIT 5;
COMMIT;

-- Test 5: Try to access clean_data table (should work for all users)  
SELECT '=== CLEAN_DATA ACCESS TEST ===' as test_section;

BEGIN;
  -- This should work for all authenticated users
  SELECT COUNT(*) as clean_data_count FROM public.clean_data;
  
  -- Show sample clean_data entries
  SELECT id, schema_name, table_name, user_id FROM public.clean_data LIMIT 5;
COMMIT;

-- Test 6: Try RPC functions
SELECT '=== RPC FUNCTION TESTS ===' as test_section;

-- Test sanitize_table_name function
SELECT 'sanitize_table_name test' as function_name, sanitize_table_name('Test Hotel Data') as result;

-- Test get_table_columns function (this might fail if tables don't exist)
-- We'll just try it and see what happens
DO $$
DECLARE
  rec record;
  test_table text;
BEGIN
  -- Find a clean_ table to test with
  SELECT tablename INTO test_table 
  FROM pg_tables 
  WHERE schemaname = 'public' AND tablename LIKE 'clean_%' 
  LIMIT 1;
  
  IF test_table IS NOT NULL THEN
    RAISE NOTICE 'Testing get_table_columns with table: %', test_table;
    -- Try to call the function
    PERFORM * FROM get_table_columns(test_table) LIMIT 1;
    RAISE NOTICE 'get_table_columns function works!';
  ELSE
    RAISE NOTICE 'No clean_ tables found to test get_table_columns';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'get_table_columns function failed: %', SQLERRM;
END $$;

-- Test 7: Current user information
SELECT '=== CURRENT USER INFO ===' as test_section;

SELECT 
  current_user as database_user,
  session_user,
  current_setting('request.jwt.claims', true)::json->>'sub' as jwt_user_id,
  auth.uid() as auth_uid;

-- Test 8: Try execute_safe_query function
SELECT '=== EXECUTE_SAFE_QUERY TEST ===' as test_section;

SELECT execute_safe_query('SELECT COUNT(*) as test_count FROM public.schemas') as safe_query_result;

-- Final summary
SELECT '=== DIAGNOSTIC COMPLETE ===' as test_section;