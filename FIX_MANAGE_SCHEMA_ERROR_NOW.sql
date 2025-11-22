-- ========================================================
-- EMERGENCY FIX FOR manage-schema-table EDGE FUNCTION
-- Run this in Supabase SQL Editor RIGHT NOW
-- ========================================================

-- This ensures all required functions exist and have proper permissions

-- Step 1: Drop and recreate sanitize_table_name with proper error handling
DROP FUNCTION IF EXISTS public.sanitize_table_name(TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.sanitize_table_name(name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Handle NULL or empty input
  IF name IS NULL OR TRIM(name) = '' THEN
    RAISE EXCEPTION 'Table name cannot be null or empty';
  END IF;
  
  -- Return sanitized name
  RETURN lower(regexp_replace(name, '[^a-zA-Z0-9_]', '_', 'g'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.sanitize_table_name(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sanitize_table_name(TEXT) TO service_role;

-- Step 2: Drop and recreate get_table_columns with better error handling
DROP FUNCTION IF EXISTS public.get_table_columns(TEXT) CASCADE;

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
BEGIN
  -- Check if table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = get_table_columns.table_name
  ) THEN
    -- Return empty result instead of error for non-existent tables
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    c.column_name::TEXT,
    c.data_type::TEXT,
    c.is_nullable::TEXT
  FROM information_schema.columns c
  WHERE c.table_name = get_table_columns.table_name
    AND c.table_schema = 'public'
    AND c.column_name NOT IN ('id', 'user_id', 'source_workbook', 'source_mapping_id', 'extracted_at')
  ORDER BY c.ordinal_position;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_table_columns(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_table_columns(TEXT) TO service_role;

-- Step 3: Drop and recreate execute_ddl with better logging
DROP FUNCTION IF EXISTS public.execute_ddl(TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.execute_ddl(ddl_statement TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate input
  IF ddl_statement IS NULL OR TRIM(ddl_statement) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DDL statement cannot be null or empty'
    );
  END IF;

  -- Log the DDL (visible in Supabase logs)
  RAISE NOTICE 'Executing DDL: %', LEFT(ddl_statement, 200);
  
  -- Execute the DDL statement
  BEGIN
    EXECUTE ddl_statement;
    
    RAISE NOTICE 'DDL executed successfully';
    
    -- Return success
    RETURN jsonb_build_object('success', true);
  EXCEPTION
    WHEN OTHERS THEN
      -- Log the error
      RAISE NOTICE 'DDL execution failed: % - %', SQLSTATE, SQLERRM;
      
      -- Return error details
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'detail', SQLSTATE,
        'hint', CASE 
          WHEN SQLSTATE = '42P07' THEN 'Table already exists'
          WHEN SQLSTATE = '42703' THEN 'Column does not exist'
          WHEN SQLSTATE = '42P01' THEN 'Table does not exist'
          ELSE 'Check SQL syntax and permissions'
        END
      );
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_ddl(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_ddl(TEXT) TO service_role;

-- Step 4: Verify all functions are created and accessible
SELECT 
  routine_name,
  routine_type,
  security_type,
  'Created successfully' as status
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name IN ('sanitize_table_name', 'get_table_columns', 'execute_ddl')
ORDER BY routine_name;

-- Step 5: Verify permissions
SELECT 
  r.routine_name,
  BOOL_OR(rp.grantee = 'authenticated') as has_authenticated,
  BOOL_OR(rp.grantee = 'service_role') as has_service_role
FROM information_schema.routines r
LEFT JOIN information_schema.routine_privileges rp 
  ON r.routine_name = rp.routine_name 
  AND rp.privilege_type = 'EXECUTE'
WHERE r.routine_schema = 'public' 
  AND r.routine_name IN ('sanitize_table_name', 'get_table_columns', 'execute_ddl')
GROUP BY r.routine_name
ORDER BY r.routine_name;

-- Success message
SELECT '✅ All functions created and permissions granted!' as result;

-- ========================================================
-- NEXT STEPS AFTER RUNNING THIS:
-- ========================================================
-- 1. Try your mapping operation again
-- 2. If still failing, check Supabase Dashboard → Functions → manage-schema-table → Logs
-- 3. The logs should now show more detailed error messages
-- ========================================================
