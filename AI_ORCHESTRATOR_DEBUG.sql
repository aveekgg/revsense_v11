-- ========================================================
-- AI SQL ORCHESTRATOR DEBUG TEST
-- Run this to simulate what the AI orchestrator does step by step
-- ========================================================

-- Step 1: Test what the AI orchestrator sees for schemas
SELECT '=== WHAT AI ORCHESTRATOR SEES ===' as test_section;

-- Simulate the schemas fetch (like line 79 in the function)
SELECT 
  id,
  name,
  description,
  user_id,
  'Schema accessible by user: ' || COALESCE(user_id::text, 'NULL') as note
FROM public.schemas 
ORDER BY name;

-- Step 2: Test table name sanitization for each schema
SELECT '=== TABLE NAME SANITIZATION ===' as test_section;

SELECT 
  name as original_schema_name,
  sanitize_table_name(name) as sanitized_name,
  'clean_' || sanitize_table_name(name) as expected_table_name
FROM public.schemas
ORDER BY name;

-- Step 3: Check which clean tables actually exist
SELECT '=== ACTUAL CLEAN TABLES ===' as test_section;

SELECT 
  tablename,
  'Table exists' as status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE 'clean_%'
ORDER BY tablename;

-- Step 4: Test get_table_columns for existing tables
SELECT '=== COLUMN ACCESS TEST ===' as test_section;

DO $$
DECLARE
  table_rec record;
  col_count integer;
BEGIN
  FOR table_rec IN 
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' AND tablename LIKE 'clean_%'
  LOOP
    BEGIN
      SELECT COUNT(*) INTO col_count 
      FROM get_table_columns(table_rec.tablename);
      
      RAISE NOTICE 'Table %. has % columns accessible', table_rec.tablename, col_count;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'ERROR accessing columns for table %: %', table_rec.tablename, SQLERRM;
    END;
  END LOOP;
END $$;

-- Step 5: Test sample data access
SELECT '=== SAMPLE DATA ACCESS TEST ===' as test_section;

DO $$
DECLARE
  table_rec record;
  sample_count integer;
  test_query text;
BEGIN
  FOR table_rec IN 
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' AND tablename LIKE 'clean_%'
    LIMIT 3  -- Test first 3 tables only
  LOOP
    BEGIN
      test_query := format('SELECT COUNT(*) FROM public.%I LIMIT 5', table_rec.tablename);
      EXECUTE test_query INTO sample_count;
      
      RAISE NOTICE 'Table % has % rows of sample data', table_rec.tablename, sample_count;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'ERROR accessing sample data for table %: %', table_rec.tablename, SQLERRM;
    END;
  END LOOP;
END $$;

-- Step 6: Test execute_safe_query with a real clean table query
SELECT '=== EXECUTE_SAFE_QUERY WITH CLEAN TABLE ===' as test_section;

DO $$
DECLARE
  test_table text;
  query_result jsonb;
  test_sql text;
BEGIN
  -- Get first clean table
  SELECT tablename INTO test_table
  FROM pg_tables 
  WHERE schemaname = 'public' AND tablename LIKE 'clean_%'
  LIMIT 1;
  
  IF test_table IS NOT NULL THEN
    test_sql := format('SELECT * FROM public.%I LIMIT 3', test_table);
    
    RAISE NOTICE 'Testing execute_safe_query with: %', test_sql;
    
    SELECT execute_safe_query(test_sql) INTO query_result;
    
    RAISE NOTICE 'execute_safe_query result type: %', pg_typeof(query_result);
    RAISE NOTICE 'execute_safe_query sample: %', 
      CASE 
        WHEN query_result IS NULL THEN 'NULL' 
        ELSE substring(query_result::text, 1, 200) || '...'
      END;
  ELSE
    RAISE NOTICE 'No clean tables found for testing';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'execute_safe_query test failed: %', SQLERRM;
END $$;

-- Step 7: Show current user context
SELECT '=== USER CONTEXT ===' as test_section;

SELECT 
  current_user,
  auth.uid() as current_auth_uid,
  (SELECT COUNT(*) FROM public.schemas WHERE user_id = auth.uid()) as my_schemas,
  (SELECT COUNT(*) FROM public.schemas WHERE user_id != auth.uid()) as other_user_schemas;

SELECT '=== DIAGNOSTIC COMPLETE ===' as status;