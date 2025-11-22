-- Create function to sanitize table names (prevent SQL injection)
CREATE OR REPLACE FUNCTION public.sanitize_table_name(name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Convert to lowercase, replace spaces with underscores, remove special chars
  RETURN regexp_replace(
    regexp_replace(lower(trim(name)), '[^a-z0-9_]', '_', 'g'),
    '_+', '_', 'g'
  );
END;
$$;

-- Create function to get table columns (for AI query generation)
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
  -- Validate table name exists and user has access
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = $1
  ) THEN
    RAISE EXCEPTION 'Table does not exist: %', $1;
  END IF;

  RETURN QUERY
  SELECT 
    c.column_name::TEXT,
    c.data_type::TEXT,
    c.is_nullable::TEXT
  FROM information_schema.columns c
  WHERE c.table_name = $1
    AND c.table_schema = 'public'
    AND c.column_name NOT IN ('id', 'user_id', 'source_workbook', 'source_mapping_id', 'extracted_at');
END;
$$;

-- Create function to execute dynamic DDL (used by manage-schema-table edge function)
CREATE OR REPLACE FUNCTION public.execute_ddl(ddl_statement TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Execute the DDL statement
  EXECUTE ddl_statement;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'DDL executed successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;