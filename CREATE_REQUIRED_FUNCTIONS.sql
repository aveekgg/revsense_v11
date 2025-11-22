-- ========================================================
-- REQUIRED DATABASE FUNCTIONS FOR SCHEMA MANAGEMENT
-- Run this SQL in your Supabase SQL Editor to fix the issue
-- ========================================================

-- Drop existing functions first (if they exist)
DROP FUNCTION IF EXISTS public.sanitize_table_name(TEXT);
DROP FUNCTION IF EXISTS public.get_table_columns(TEXT);
DROP FUNCTION IF EXISTS public.execute_ddl(TEXT);

-- 1. Function to sanitize table names
CREATE OR REPLACE FUNCTION public.sanitize_table_name(input_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN lower(regexp_replace(input_name, '[^a-zA-Z0-9_]', '_', 'g'));
END;
$$;

-- 2. Function to get table columns (for schema updates)
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
  RETURN QUERY
  SELECT 
    c.column_name::TEXT,
    c.data_type::TEXT,
    c.is_nullable::TEXT
  FROM information_schema.columns c
  WHERE c.table_name = p_table_name
    AND c.table_schema = 'public'
    AND c.column_name NOT IN ('id', 'user_id', 'source_workbook', 'source_mapping_id', 'extracted_at');
END;
$$;

-- 3. Function to execute DDL statements (for creating/updating tables)
CREATE OR REPLACE FUNCTION public.execute_ddl(ddl_statement TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Execute the DDL statement
  EXECUTE ddl_statement;
  
  -- Return success
  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    -- Return error details
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'detail', SQLSTATE
    );
END;
$$;

-- 4. Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.sanitize_table_name(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_table_columns(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_ddl(TEXT) TO authenticated;

-- 5. Verify functions were created
SELECT 
  routine_name,
  routine_type,
  'Created successfully' as status
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name IN ('sanitize_table_name', 'get_table_columns', 'execute_ddl')
ORDER BY routine_name;
