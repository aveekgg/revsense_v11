-- ========================================================
-- DIAGNOSTIC SCRIPT FOR manage-schema-table EDGE FUNCTION ERROR
-- Run this in Supabase SQL Editor to diagnose the 500 error
-- ========================================================

-- Step 1: Check if all required database functions exist
SELECT '=== CHECKING DATABASE FUNCTIONS ===' as step;

SELECT 
  routine_name,
  routine_type,
  security_type,
  specific_name
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'sanitize_table_name', 
    'get_table_columns', 
    'execute_ddl'
  )
ORDER BY routine_name;

-- Expected: Should see all 3 functions listed
-- If any are missing, you need to run CREATE_REQUIRED_FUNCTIONS.sql

-- Step 2: Check function permissions
SELECT '=== CHECKING FUNCTION PERMISSIONS ===' as step;

SELECT 
  r.routine_name,
  ARRAY_AGG(DISTINCT rp.grantee) as granted_to,
  BOOL_OR(rp.grantee = 'authenticated') as has_authenticated_access
FROM information_schema.routines r
LEFT JOIN information_schema.routine_privileges rp 
  ON r.routine_name = rp.routine_name 
  AND r.routine_schema = rp.routine_schema
  AND rp.privilege_type = 'EXECUTE'
WHERE r.routine_schema = 'public' 
  AND r.routine_name IN (
    'sanitize_table_name', 
    'get_table_columns', 
    'execute_ddl'
  )
GROUP BY r.routine_name
ORDER BY r.routine_name;

-- Expected: has_authenticated_access should be TRUE for all functions
-- If FALSE, you need to run FUNCTION_PERMISSIONS_FIX.sql

-- Step 3: Test sanitize_table_name function
SELECT '=== TESTING sanitize_table_name ===' as step;

SELECT 
  'Test Input' as test_case,
  'My Test Schema!' as input,
  sanitize_table_name('My Test Schema!') as output;

-- Expected: Should return 'my_test_schema_' (lowercase, underscores)
-- If error, the function is broken or missing

-- Step 4: Test execute_ddl function with a safe test
SELECT '=== TESTING execute_ddl (CREATE TEST TABLE) ===' as step;

SELECT execute_ddl('
  CREATE TABLE IF NOT EXISTS public.test_edge_function_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_column TEXT
  );
') as create_result;

-- Expected: Should return {"success": true}
-- If error, execute_ddl is broken or user lacks permissions

-- Step 5: Test get_table_columns on the test table
SELECT '=== TESTING get_table_columns ===' as step;

SELECT * FROM get_table_columns('test_edge_function_table');

-- Expected: Should return test_column with TEXT type
-- If error, get_table_columns is broken

-- Step 6: Clean up test table
SELECT '=== CLEANING UP TEST TABLE ===' as step;

DROP TABLE IF EXISTS public.test_edge_function_table CASCADE;

SELECT 'Test table cleaned up' as status;

-- Step 7: Check if there are any existing clean_* tables
SELECT '=== CHECKING EXISTING CLEAN TABLES ===' as step;

SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'clean_%'
ORDER BY table_name;

-- Step 8: Check for any RLS issues
SELECT '=== CHECKING RLS CONFIGURATION ===' as step;

SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'clean_%'
ORDER BY tablename;

-- Step 9: Verify current user permissions
SELECT '=== CHECKING CURRENT USER ===' as step;

SELECT 
  current_user as database_user,
  session_user,
  current_schema();

-- Step 10: Check if schemas table exists and has data
SELECT '=== CHECKING SCHEMAS TABLE ===' as step;

SELECT 
  id,
  name,
  description,
  user_id,
  created_at
FROM public.schemas
ORDER BY created_at DESC
LIMIT 5;

-- Step 11: Summary and recommendations
SELECT '=== DIAGNOSTIC SUMMARY ===' as step;

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name = 'sanitize_table_name'
    ) THEN '✅ sanitize_table_name exists'
    ELSE '❌ sanitize_table_name MISSING - Run CREATE_REQUIRED_FUNCTIONS.sql'
  END as check_1,
  
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name = 'get_table_columns'
    ) THEN '✅ get_table_columns exists'
    ELSE '❌ get_table_columns MISSING - Run CREATE_REQUIRED_FUNCTIONS.sql'
  END as check_2,
  
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name = 'execute_ddl'
    ) THEN '✅ execute_ddl exists'
    ELSE '❌ execute_ddl MISSING - Run CREATE_REQUIRED_FUNCTIONS.sql'
  END as check_3;

-- ========================================================
-- INSTRUCTIONS BASED ON RESULTS:
-- ========================================================
-- 
-- If any functions are MISSING:
--   1. Run CREATE_REQUIRED_FUNCTIONS.sql
--
-- If functions exist but has_authenticated_access is FALSE:
--   1. Run FUNCTION_PERMISSIONS_FIX.sql
--
-- If all checks pass but edge function still fails:
--   1. Check Supabase Dashboard → Functions → manage-schema-table → Logs
--   2. Look for specific error messages
--   3. Verify SUPABASE_URL and SUPABASE_ANON_KEY are set
--
-- ========================================================
